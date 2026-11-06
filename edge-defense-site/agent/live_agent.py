#!/usr/bin/env python3
"""Edge Defense Lab — packet-capture agent.

Sniffs packets (live interface or a .pcap), aggregates them into bidirectional flows and emits the paper's
15-feature canonical record for each finished flow, in CICFlowMeter-style units:

  duration (µs) · pkt_len_min/max/mean/std (L4 payload bytes) · total_bytes (payload) · byte_rate (bytes/s)
  header_len_total (L4 header bytes) · flag_syn/fin/rst/ack/psh (1 if seen) · is_tcp · is_udp

IMPORTANT — extractor mismatch: the paper's two datasets already disagree on what header_len_total and
byte_rate mean, and that alone breaks naive transfer. This agent *re-implements* CICFlowMeter semantics from
packets; validate its output against flows from your training extractor before trusting live scores.

Usage
  sudo python agent/live_agent.py --iface en0 --api http://127.0.0.1:8000        # live capture (needs root)
  python agent/live_agent.py --pcap capture.pcap --api http://127.0.0.1:8000     # offline replay
  python agent/live_agent.py --pcap capture.pcap --jsonl flows.jsonl --no-post   # just write JSON lines
  # JSON lines can be pasted into the site: Connect live traffic → Route 1.

Only capture networks you own or are authorised to monitor.
"""
from __future__ import annotations
import argparse, json, math, queue, sys, threading, time
from dataclasses import dataclass, field

try:
    from scapy.all import IP, IPv6, TCP, UDP, PcapReader, sniff  # type: ignore
except ImportError:  # pragma: no cover
    sys.exit('This agent needs scapy:  pip install scapy')

FEATURES = ['duration', 'pkt_len_min', 'pkt_len_max', 'pkt_len_mean', 'pkt_len_std', 'total_bytes', 'byte_rate',
            'header_len_total', 'flag_syn', 'flag_fin', 'flag_rst', 'flag_ack', 'flag_psh', 'is_tcp', 'is_udp']


@dataclass
class Flow:
    first: float
    last: float
    proto: str
    lens: list = field(default_factory=list)
    header: int = 0
    syn: int = 0; fin: int = 0; rst: int = 0; ack: int = 0; psh: int = 0
    fin_at: float | None = None
    finished: bool = False

    def record(self) -> dict:
        n = len(self.lens)
        total = float(sum(self.lens))
        mean = total / n if n else 0.0
        std = math.sqrt(sum((x - mean) ** 2 for x in self.lens) / (n - 1)) if n > 1 else 0.0
        dur_us = max(0.0, (self.last - self.first) * 1e6)
        return {
            'duration': round(dur_us), 'pkt_len_min': float(min(self.lens)) if n else 0.0, 'pkt_len_max': float(max(self.lens)) if n else 0.0,
            'pkt_len_mean': round(mean, 4), 'pkt_len_std': round(std, 4), 'total_bytes': total,
            'byte_rate': round(total / (dur_us / 1e6), 4) if dur_us > 0 else 0.0, 'header_len_total': float(self.header),
            'flag_syn': self.syn, 'flag_fin': self.fin, 'flag_rst': self.rst, 'flag_ack': self.ack, 'flag_psh': self.psh,
            'is_tcp': int(self.proto == 'tcp'), 'is_udp': int(self.proto == 'udp'),
        }


class FlowTable:
    def __init__(self, emit, idle=15.0, active=120.0, fin_grace=2.0):
        self.flows: dict = {}
        self.emit, self.idle, self.active, self.fin_grace = emit, idle, active, fin_grace
        self.lock = threading.Lock()
        self.npk = 0

    @staticmethod
    def key(src, dst, sp, dp, proto):
        a, b = (src, sp), (dst, dp)
        return (proto,) + ((a, b) if a <= b else (b, a))

    def add(self, pkt):
        ts = float(pkt.time)
        if IP in pkt:
            ip = pkt[IP]; src, dst = ip.src, ip.dst
        elif IPv6 in pkt:
            ip = pkt[IPv6]; src, dst = ip.src, ip.dst
        else:
            return
        if TCP in pkt:
            l4 = pkt[TCP]; proto = 'tcp'; payload = len(l4.payload); hdr = int(l4.dataofs or 5) * 4
        elif UDP in pkt:
            l4 = pkt[UDP]; proto = 'udp'; payload = len(l4.payload); hdr = 8
        else:
            proto = 'other'; l4 = None; payload = 0; hdr = 0
            sp = dp = 0
        if l4 is not None:
            sp, dp = int(l4.sport), int(l4.dport)
        k = self.key(src, dst, sp, dp, proto)
        with self.lock:
            f = self.flows.get(k)
            if f is not None and (ts - f.first > self.active or f.finished and ts - (f.fin_at or ts) > self.fin_grace):
                self._flush(k)
                f = None
            if f is None:
                f = self.flows[k] = Flow(first=ts, last=ts, proto=proto)
            f.last = max(f.last, ts); f.lens.append(payload); f.header += hdr
            if proto == 'tcp':
                fl = int(l4.flags)
                f.syn |= bool(fl & 0x02); f.fin |= bool(fl & 0x01); f.rst |= bool(fl & 0x04); f.ack |= bool(fl & 0x10); f.psh |= bool(fl & 0x08)
                if fl & 0x04:
                    self._flush(k)
                elif fl & 0x01 and not f.finished:
                    f.finished = True; f.fin_at = ts
            self.npk += 1
            if self.npk % 500 == 0:
                self._sweep(ts)

    def _flush(self, k):
        f = self.flows.pop(k, None)
        if f and f.lens:
            self.emit(f.record())

    def _sweep(self, now):
        for k in [k for k, f in self.flows.items() if now - f.last > self.idle or (f.finished and now - (f.fin_at or now) > self.fin_grace)]:
            self._flush(k)

    def sweep(self, now):
        with self.lock:
            self._sweep(now)

    def flush_all(self):
        with self.lock:
            for k in list(self.flows):
                self._flush(k)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--iface', help='network interface to sniff (needs root)')
    src.add_argument('--pcap', help='offline capture file to replay')
    ap.add_argument('--api', default='http://127.0.0.1:8000', help='Edge API base URL')
    ap.add_argument('--api-key', default=None, help='value for the x-api-key header (if the server sets EDGE_API_KEY)')
    ap.add_argument('--jsonl', help='also append each flow as a JSON line to this file')
    ap.add_argument('--no-post', action='store_true', help='do not call the API; print JSON lines to stdout')
    ap.add_argument('--bpf', default=None, help='optional BPF filter, e.g. "tcp or udp"')
    ap.add_argument('--idle-timeout', type=float, default=15.0); ap.add_argument('--active-timeout', type=float, default=120.0)
    a = ap.parse_args()

    out = queue.Queue(maxsize=10000); stats = dict(flows=0, posted=0, failed=0)
    jf = open(a.jsonl, 'a', buffering=1) if a.jsonl else None

    def emit(rec):
        stats['flows'] += 1
        if jf: jf.write(json.dumps(rec) + '\n')
        if a.no_post: print(json.dumps(rec), flush=True)
        else:
            try: out.put_nowait(rec)
            except queue.Full: stats['failed'] += 1

    def poster():
        import urllib.request
        url = a.api.rstrip('/') + '/api/ingest'
        hdr = {'Content-Type': 'application/json'}
        if a.api_key: hdr['x-api-key'] = a.api_key
        while True:
            rec = out.get()
            if rec is None: return
            try:
                req = urllib.request.Request(url, data=json.dumps({'flow': rec}).encode(), headers=hdr, method='POST')
                urllib.request.urlopen(req, timeout=10).read(); stats['posted'] += 1
            except Exception as e:  # keep going; the server may be restarting
                stats['failed'] += 1
                if stats['failed'] in (1, 10, 100): print('post failed:', e, file=sys.stderr)

    th = None
    if not a.no_post:
        th = threading.Thread(target=poster, daemon=True); th.start()
    table = FlowTable(emit, a.idle_timeout, a.active_timeout)
    try:
        if a.pcap:
            n = 0
            with PcapReader(a.pcap) as rd:
                for pkt in rd:
                    table.add(pkt); n += 1
            table.flush_all(); print(f'replayed {n} packets → {stats["flows"]} flows', file=sys.stderr)
        else:
            stop = threading.Event()
            def sweeper():
                while not stop.wait(2.0): table.sweep(time.time())
            threading.Thread(target=sweeper, daemon=True).start()
            print(f'sniffing {a.iface} … Ctrl-C to stop', file=sys.stderr)
            sniff(iface=a.iface, prn=table.add, store=False, filter=a.bpf)
    except KeyboardInterrupt:
        pass
    finally:
        table.flush_all()
        if th:
            while not out.empty(): time.sleep(0.05)
            out.put(None); th.join(timeout=5)
        if jf: jf.close()
        print(f'flows={stats["flows"]} posted={stats["posted"]} failed={stats["failed"]}', file=sys.stderr)


if __name__ == '__main__':
    main()
