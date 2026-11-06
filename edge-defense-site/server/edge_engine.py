"""Edge Defense engine (Python): the same trees, TreeSHAP, PSI monitor and Square-style attack as js/engine.js.

Loads the paper's three XGBoost models from the exported trees in data/models.js, so the server needs only
numpy (no xgboost / shap install). Predictions match xgboost to float32 precision; SHAP matches
shap.TreeExplainer to ~1e-6 (see tests in README).
"""
from __future__ import annotations
import json, math, re
from pathlib import Path
import numpy as np

FEATURES = ['duration', 'pkt_len_min', 'pkt_len_max', 'pkt_len_mean', 'pkt_len_std', 'total_bytes', 'byte_rate',
            'header_len_total', 'flag_syn', 'flag_fin', 'flag_rst', 'flag_ack', 'flag_psh', 'is_tcp', 'is_udp']
NF = len(FEATURES)
N_CONT = 8  # first 8 are log1p-transformed (paper, Sec. III-A)
ALIASES = {
    'duration': ['duration', 'flow duration', 'flow_duration'], 'pkt_len_min': ['pkt_len_min', 'min packet length', 'pkt len min'],
    'pkt_len_max': ['pkt_len_max', 'max packet length', 'pkt len max'], 'pkt_len_mean': ['pkt_len_mean', 'pkt len mean'],
    'pkt_len_std': ['pkt_len_std', 'pkt len std'], 'total_bytes': ['total_bytes', 'tot size'],
    'byte_rate': ['byte_rate', 'flow byts/s', 'rate'], 'header_len_total': ['header_len_total', 'header_length'],
}


def prep(raw) -> np.ndarray:
    """raw canonical flow(s) -> model input space (float32)."""
    a = np.asarray(raw, dtype=np.float64)
    a = np.where(np.isfinite(a), a, 0.0)
    x = a.copy()
    x[..., :N_CONT] = np.log1p(np.maximum(a[..., :N_CONT], 0))
    return x.astype(np.float32)


def flow_to_raw(flow: dict) -> list[float]:
    low = {str(k).lower(): v for k, v in flow.items()}
    out = []
    for f in FEATURES:
        v = None
        for a in ALIASES.get(f, [f]):
            if a in low:
                v = low[a]
                break
        try:
            v = float(v)
        except (TypeError, ValueError):
            v = 0.0
        out.append(v if math.isfinite(v) else 0.0)
    return out


class TreeModel:
    def __init__(self, spec: dict):
        self.base_margin = float(spec['base_margin'])
        T = spec['trees']
        self.n = len(T)
        self.trees = []
        for t in T:
            self.trees.append(dict(
                l=np.array(t['l'], dtype=np.int64), r=np.array(t['r'], dtype=np.int64), f=np.array(t['f'], dtype=np.int64),
                t=np.array(t['t'], dtype=np.float32), v=np.array(t['v'], dtype=np.float64), c=np.array(t['c'], dtype=np.float64),
                d=np.array(t.get('d', [0] * len(t['l'])), dtype=np.int64)))
        self.max_depth = 8
        self.expected = self.base_margin + sum(self._tree_mean(t, 0) for t in self.trees)

    @staticmethod
    def _tree_mean(t, node):
        if t['l'][node] < 0:
            return float(t['v'][node])
        l, r, c = int(t['l'][node]), int(t['r'][node]), float(t['c'][node])
        return (t['c'][l] * TreeModel._tree_mean(t, l) + t['c'][r] * TreeModel._tree_mean(t, r)) / c

    def margin(self, X) -> np.ndarray:
        X = np.atleast_2d(np.asarray(X, dtype=np.float32))
        n = X.shape[0]
        out = np.full(n, self.base_margin, dtype=np.float64)
        rows = np.arange(n)
        for t in self.trees:
            idx = np.zeros(n, dtype=np.int64)
            for _ in range(self.max_depth):
                leaf = t['l'][idx] < 0
                if leaf.all():
                    break
                f = t['f'][idx]
                v = X[rows, np.where(leaf, 0, f)]
                left = np.where(np.isnan(v), t['d'][idx] == 0, v < t['t'][idx])
                nxt = np.where(left, t['l'][idx], t['r'][idx])
                idx = np.where(leaf, idx, nxt)
            out += t['v'][idx]
        return out

    def proba(self, X) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-self.margin(X)))

    # ---- exact path-dependent TreeSHAP (Lundberg et al. 2018), same algorithm as the JS port ----
    def shap(self, x) -> np.ndarray:
        x = np.asarray(x, dtype=np.float32)
        S = self.max_depth + 2
        pf = [0] * (S * S); pz = [0.0] * (S * S); po = [0.0] * (S * S); pw = [0.0] * (S * S)
        phi = [0.0] * NF

        def extend(off, d, zf, of, fi):
            pf[off + d] = fi; pz[off + d] = zf; po[off + d] = of; pw[off + d] = 1.0 if d == 0 else 0.0
            for i in range(d - 1, -1, -1):
                pw[off + i + 1] += of * pw[off + i] * (i + 1) / (d + 1)
                pw[off + i] = zf * pw[off + i] * (d - i) / (d + 1)

        def unwind(off, d, idx):
            of = po[off + idx]; zf = pz[off + idx]; nxt = pw[off + d]
            for i in range(d - 1, -1, -1):
                if of != 0:
                    tmp = pw[off + i]
                    pw[off + i] = nxt * (d + 1) / ((i + 1) * of)
                    nxt = tmp - pw[off + i] * zf * (d - i) / (d + 1)
                else:
                    pw[off + i] = (pw[off + i] * (d + 1)) / (zf * (d - i))
            for i in range(idx, d):
                pf[off + i] = pf[off + i + 1]; pz[off + i] = pz[off + i + 1]; po[off + i] = po[off + i + 1]

        def unwound_sum(off, d, idx):
            of = po[off + idx]; zf = pz[off + idx]; nxt = pw[off + d]; total = 0.0
            for i in range(d - 1, -1, -1):
                if of != 0:
                    tmp = nxt * (d + 1) / ((i + 1) * of)
                    total += tmp
                    nxt = pw[off + i] - tmp * zf * ((d - i) / (d + 1))
                else:
                    total += (pw[off + i] / zf) / ((d - i) / (d + 1))
            return total

        def recurse(t, node, parent_off, d, pzf, pof, pfi, level):
            off = level * S
            for i in range(d):
                pf[off + i] = pf[parent_off + i]; pz[off + i] = pz[parent_off + i]; po[off + i] = po[parent_off + i]; pw[off + i] = pw[parent_off + i]
            extend(off, d, pzf, pof, pfi)
            if t['l'][node] < 0:
                v = float(t['v'][node])
                for i in range(1, d + 1):
                    w = unwound_sum(off, d, i)
                    phi[pf[off + i]] += w * (po[off + i] - pz[off + i]) * v
                return
            sf = int(t['f'][node]); xv = x[sf]
            go_left = (t['d'][node] == 0) if xv != xv else bool(xv < t['t'][node])
            l, r = int(t['l'][node]), int(t['r'][node])
            hot, cold = (l, r) if go_left else (r, l)
            cov = float(t['c'][node]); hz = float(t['c'][hot]) / cov; cz = float(t['c'][cold]) / cov
            inz = 1.0; ino = 1.0; found = -1
            for k in range(d + 1):
                if pf[off + k] == sf:
                    found = k; break
            if found >= 0:
                inz = pz[off + found]; ino = po[off + found]
                unwind(off, d, found); d -= 1
            recurse(t, hot, off, d + 1, hz * inz, ino, sf, level + 1)
            recurse(t, cold, off, d + 1, cz * inz, 0.0, sf, level + 1)

        for t in self.trees:
            recurse(t, 0, 0, 0, 1.0, 1.0, -1, 1)
        return np.array(phi, dtype=np.float64)


def _load_js(path: Path, var: str) -> dict:
    txt = path.read_text(encoding='utf-8')
    body = txt[txt.index('=') + 1:].strip().rstrip(';')
    return json.loads(body)


class Monitor:
    """SHAP-attribution PSI monitor (paper Sec. IV-F): deciles of a reference batch, mean of 15 per-feature PSIs."""
    def __init__(self, spec: dict):
        self.edges = [np.array(e, dtype=np.float64) for e in spec['edges']]
        self.ref = [np.array(r, dtype=np.float64) for r in spec['refPct']]
        self.threshold = float(spec['threshold'])

    @staticmethod
    def _hist(col, edges):
        b = np.searchsorted(edges, col, side='left')  # v > e[b-1] and v <= e[b]
        h = np.bincount(b, minlength=len(edges) + 1).astype(np.float64) / max(len(col), 1)
        return np.maximum(h, 1e-4)

    def psi(self, shap_rows) -> tuple[float, list[float]]:
        S = np.asarray(shap_rows, dtype=np.float64)
        per = []
        for j in range(NF):
            bp = self._hist(S[:, j], self.edges[j]); rp = self.ref[j]
            per.append(float(np.sum((bp - rp) * np.log(bp / rp))))
        return float(np.mean(per)), per


class Engine:
    def __init__(self, data_dir: Path):
        models = _load_js(data_dir / 'models.js', 'EDGE_MODELS')
        self.models = {k: TreeModel(models[k]) for k in ('A', 'B', 'C')}
        mon = _load_js(data_dir / 'monitor.js', 'EDGE_MONITOR')
        self.monitors = {dom: {int(n): Monitor(spec) for n, spec in d.items()} for dom, d in mon.items()}
        pool = _load_js(data_dir / 'pool.js', 'EDGE_POOL')
        self.lo = np.array(pool['lo'], dtype=np.float64); self.hi = np.array(pool['hi'], dtype=np.float64)

    def score(self, raw_rows):
        X = prep(raw_rows)
        return {k: m.proba(X).tolist() for k, m in self.models.items()}

    def shap_c(self, raw_rows):
        X = prep(raw_rows)
        return np.stack([self.models['C'].shap(x) for x in np.atleast_2d(X)])

    def square_attack(self, raw, eps=0.1, max_q=1000, thr=0.5, seed=0):
        """Black-box discrete random search against Model C inside an L-inf budget (fraction of clipped range)."""
        rng = np.random.default_rng(seed)
        m = self.models['C']; x = prep(raw).astype(np.float64)
        rng_ = self.hi - self.lo
        bl = np.maximum(x - eps * rng_, self.lo); bh = np.minimum(x + eps * rng_, self.hi)
        bad = bl > bh; bl[bad] = bh[bad] = x[bad]
        xa = np.where(rng.random(NF) < 0.5, bl, bh)
        best = float(m.proba(xa.astype(np.float32))[0]); q = 1
        while q < max_q and best >= thr:
            frac = max(0.05, 0.8 * (1 - q / max_q) ** 2)
            k = max(1, round(frac * NF)); cand = xa.copy()
            for _ in range(k):
                j = int(rng.integers(NF)); cand[j] = bl[j] if rng.random() < 0.5 else bh[j]
            p = float(m.proba(cand.astype(np.float32))[0]); q += 1
            if p < best:
                best, xa = p, cand
        linf = float(np.max(np.where(rng_ > 0, np.abs(xa - x) / np.where(rng_ > 0, rng_, 1), 0)))
        return dict(success=best < thr, prob=best, queries=q, linf=linf, x_adv=xa.astype(np.float32).tolist())
