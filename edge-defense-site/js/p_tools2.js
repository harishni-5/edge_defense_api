/* Lab tools (2/2): batch scoring, benchmark, connect live traffic, reproduce */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, E = W.EdgeEngine, R = W.EDGE_RESULTS, SD = W.EDGE_SHAPDEP;
  function pctile(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }); return E.quantile(s, q); }

  /* ================= batch scoring ================= */
  function demoCSV() {
    var rr = E.rng(2024), pool = Lab.rows, out = ['domain,attack_type,is_attack,' + E.FEATURES.join(',')];
    for (var i = 0; i < 400; i++) { var r = pool[Math.floor(rr() * pool.length)]; out.push([Lab.DOM[r.d].toLowerCase(), '"' + r.type + '"', r.y].concat(r.raw).join(',')); }
    return out.join('\n');
  }
  U.register('batch', {
    title: 'Batch scoring',
    render: function (root) {
      var st = { dom: 1, rows: null, name: '' }, out = h('div', { class: 'col', style: { gap: '16px' } });
      var ta = h('textarea', { rows: 6, placeholder: 'Paste CSV here — header row with the canonical column names (duration, pkt_len_min, …) and optionally is_attack / domain / attack_type.', 'aria-label': 'CSV text' });
      var file = h('input', { type: 'file', accept: '.csv,text/csv,text/plain', 'aria-label': 'CSV file', style: { display: 'none' } });
      var drop = h('div', { class: 'drop', tabindex: 0, role: 'button' }, U.icon('upload', 22), h('div', { style: { 'font-weight': 700, 'margin-top': '6px' } }, 'Drop a CSV of flows here, or click to choose'), h('div', { class: 'small' }, 'Processed entirely in your browser — nothing is uploaded.'));
      function readFile(f) { var fr = new FileReader(); fr.onload = function () { ta.value = String(fr.result).slice(0, 8e6); st.name = f.name; analyse(); }; fr.readAsText(f); }
      drop.addEventListener('click', function () { file.click(); }); drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
      file.addEventListener('change', function () { if (file.files[0]) readFile(file.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
      var domSeg = U.seg([{ value: 0, label: 'Enterprise' }, { value: 1, label: 'IoT' }], st.dom, function (v) { st.dom = v; if (st.rows) analyse(); }, 'Reference network for the drift check');

      function analyse() {
        var txt = ta.value.trim(); U.clear(out); if (!txt) return;
        var parsed = Lab.rowsFromCSV(txt);
        if (parsed.error) { out.appendChild(U.callout('bad', 'warn', parsed.error)); return; }
        var rows = parsed.rows.slice(0, 20000); st.rows = rows;
        if (parsed.missing.length) out.appendChild(U.callout('warn', 'warn', h('div', null, h('b', null, 'Some columns were not found and are scored as 0: '), parsed.missing.join(', '), '. Column names are matched case-insensitively against the canonical schema and a few CICFlowMeter-style aliases; features that do not mean the same thing in your extractor will silently shift the scores.')));
        var P = { A: [], B: [], C: [] }; rows.forEach(function (r) { var p = Lab.score(r); Lab.KEYS.forEach(function (k) { P[k].push(p[k]); }); });
        var y = rows.map(function (r) { return r.y; }), lab = parsed.hasLabel && y.some(function (v) { return v === 0; }) && y.some(function (v) { return v === 1; });
        var tiles = h('div', { class: 'grid g4' });
        tiles.appendChild(U.tile('Flows scored', F.n(rows.length), st.name || 'pasted text'));
        Lab.KEYS.forEach(function (k) { var fl = P[k].filter(function (v) { return v >= 0.5; }).length; tiles.appendChild(U.tile('Model ' + k + ' flags', F.pct(fl / rows.length, 1), F.n(fl) + ' of ' + F.n(rows.length) + ' flows')); });
        out.appendChild(tiles);
        if (lab) {
          var mt = [['Model', 'AUC', 'F1', 'Recall', 'False-alarm rate', 'Accuracy']];
          Lab.KEYS.forEach(function (k) { var m = Lab.metrics(y, P[k]); mt.push([h('span', { class: 'bigmodel' }, h('span', { class: 'dotm', style: { background: Lab.COLORS[k] } }), Lab.SHORT[k]), F.f(E.auc(y, P[k]), 4), F.f(m.f1, 3), F.pct(m.rec, 1), F.pct(m.fpr, 1), F.pct(m.acc, 1)]); });
          out.appendChild(U.card('Against the labels in your file', 'A model trained on one network will look poor on the other — that is the paper’s cross-domain result.', U.table(mt, { num: [1, 2, 3, 4, 5] })));
        }
        // score histogram
        var bins = 10, hist = { A: new Array(bins).fill(0), B: new Array(bins).fill(0), C: new Array(bins).fill(0) };
        Lab.KEYS.forEach(function (k) { P[k].forEach(function (v) { hist[k][Math.min(bins - 1, Math.floor(v * bins))]++; }); });
        var hb = h('div', { class: 'chart' });
        U.barChart(hb, function () { return { cats: hist.A.map(function (_, i) { return (i / bins).toFixed(1) + '–' + ((i + 1) / bins).toFixed(1); }), height: 230, y: { label: 'flows', fmt: F.n }, series: Lab.KEYS.map(function (k) { return { name: Lab.SHORT[k], color: Lab.COLORS[k], vals: hist[k] }; }) }; });
        out.appendChild(U.card('Distribution of P(attack)', 'Counts per score band. Scores above 0.5 are flagged.', h('div', null, U.legend(Lab.KEYS.map(function (k) { return { label: Lab.SHORT[k], color: Lab.COLORS[k], sq: true }; })), hb)));
        // drift
        var driftBox = h('div', { class: 'col' }, h('div', { class: 'small muted' }, 'Computing SHAP for the drift check…'));
        out.appendChild(U.card('Drift check against a reference network', 'PSI of Model C’s SHAP vectors for (up to) the most representative window of your flows.', h('div', { class: 'col' }, domSeg, driftBox)));
        var N = Lab.nearestN(Math.min(rows.length, 1000)), sub = rows.length <= N ? rows : (function () { var rr = E.rng(5), a = []; for (var i = 0; i < N; i++) a.push(rows[Math.floor(rr() * rows.length)]); return a; })();
        Lab.ensureShap(sub, null, function () {
          var mon = Lab.monitor(st.dom, N), r = mon.mon.psi(sub.map(function (x) { return Lab.shapC(x); })), over = r.psi > mon.thr;
          U.clear(driftBox);
          driftBox.appendChild(h('div', { class: 'alarm ' + (over ? 'fire' : 'ok') }, U.icon(over ? 'warn' : 'check', 20), h('span', null, over ? 'Drift: PSI ' + F.f(r.psi, 3) + ' is ' + (r.psi / mon.thr).toFixed(1) + '× the ' + Lab.DOM[st.dom] + ' threshold (' + F.f(mon.thr, 4) + ' for windows of ' + N + ').' : 'No drift: PSI ' + F.f(r.psi, 4) + ' is under the ' + Lab.DOM[st.dom] + ' threshold (' + F.f(mon.thr, 4) + ' for windows of ' + N + ').')));
          if (rows.length < N) driftBox.appendChild(h('p', { class: 'small muted' }, 'Your file has fewer than ' + N + ' flows, so PSI is noisier than the calibration assumed.'));
          var pf = r.perFeature, idx = Array.from(pf.keys()).sort(function (a, b) { return pf[b] - pf[a]; }).slice(0, 6), box = h('div', { class: 'chart' }); driftBox.appendChild(box);
          U.hbar(box, function () { return { rows: idx.map(function (j) { return { label: Lab.LABELS[E.FEATURES[j]], value: pf[j], color: 'var(--s7)' }; }), fmt: F.sig, labelW: 150, valueName: 'PSI contribution' }; });
        });
        // preview + copy
        var prev = [['#', 'P(A)', 'P(B)', 'P(C)', 'Verdict (C)'].concat(lab ? ['Truth'] : [])];
        for (var i = 0; i < Math.min(rows.length, 100); i++) prev.push([String(i + 1), F.f(P.A[i], 3), F.f(P.B[i], 3), F.f(P.C[i], 3), P.C[i] >= 0.5 ? U.pill('attack', 'attack') : U.pill('benign', 'benign')].concat(lab ? [rows[i].y === 1 ? U.pill('attack', 'attack') : U.pill('benign', 'benign')] : []));
        out.appendChild(U.card('Per-flow scores' + (rows.length > 100 ? ' (first 100 of ' + F.n(rows.length) + ')' : ''), null, h('div', { class: 'col' }, h('div', { class: 'row' }, U.copyBtn(function () {
          return ['row,p_A,p_B,p_C,verdict_C' + (lab ? ',is_attack' : '')].concat(rows.map(function (r, i) { return [i + 1, P.A[i].toFixed(5), P.B[i].toFixed(5), P.C[i].toFixed(5), P.C[i] >= 0.5 ? 'attack' : 'benign'].concat(lab ? [r.y] : []).join(','); })).join('\n');
        }, 'Copy all scores as CSV')), h('div', { style: { 'max-height': '420px', overflow: 'auto' } }, U.table(prev, { num: [1, 2, 3] })))));
      }
      var go = h('button', { class: 'btn primary', type: 'button', onclick: analyse }, U.icon('play', 15), 'Score');
      var demo = h('button', { class: 'btn', type: 'button', onclick: function () { ta.value = demoCSV(); st.name = 'demo sample (400 flows)'; analyse(); } }, 'Use a demo CSV (400 flows)');
      root.appendChild(U.pageHeader('Live lab', 'Batch scoring', 'Drop in a CSV of flows in the canonical 15-feature schema to score it with all three models, compare against labels if you have them, and check it for drift against either network.'));
      root.appendChild(h('div', { class: 'col', style: { gap: '16px' } },
        U.card('Your flows', 'Required columns: ' + E.FEATURES.join(', ') + '. Optional: is_attack (0/1), domain, attack_type.', h('div', { class: 'col' }, drop, file, ta, h('div', { class: 'row' }, go, demo))), out));
    }
  });

  /* ================= benchmark ================= */
  U.register('bench', {
    title: 'Latency benchmark',
    render: function (root) {
      var st = { n: 1000 }, out = h('div', { class: 'col', style: { gap: '16px' } }), busy = false;
      function measure(fn, flows, K) {
        var samples = [], i = 0; for (; i + K <= flows.length; i += K) { var t0 = performance.now(); for (var k = 0; k < K; k++) fn(flows[i + k]); samples.push((performance.now() - t0) / K); }
        return samples;
      }
      function run() {
        if (busy) return; busy = true; U.clear(out); out.appendChild(h('div', { class: 'small muted' }, 'Warming up and measuring…'));
        setTimeout(function () {
          var rr = E.rng(88), pool = Lab.rows, flows = []; for (var i = 0; i < st.n; i++) flows.push(Lab.xOf(pool[Math.floor(rr() * pool.length)]).slice());
          var C = Lab.models.C, mon = Lab.monitor(1, 250), ring = [], idx = 0, sink = 0;
          for (i = 0; i < 100; i++) { sink += C.proba(flows[i % flows.length]); C.shap(flows[i % flows.length]); }
          var s1 = measure(function (x) { sink += C.proba(x); }, flows, 20);
          var s2 = measure(function (x) { sink += C.proba(x); sink += C.shap(x).phi[0]; }, flows, 10);
          var pre = []; for (i = 0; i < 250; i++) pre.push(C.shap(flows[i % flows.length]).phi); ring = pre;
          var s3 = measure(function (x) { sink += C.proba(x); var ph = C.shap(x).phi; ring[idx] = ph; idx = (idx + 1) % 250; sink += mon.mon.psi(ring).psi; }, flows, 5);
          var tiers = [{ name: 'Predict-only', s: s1, paper: R.latency[0] }, { name: '+ SHAP', s: s2, paper: R.latency[1] }, { name: '+ SHAP + drift', s: s3, paper: R.latency[2] }];
          tiers.forEach(function (t) { t.mean = t.s.reduce(function (a, b) { return a + b; }, 0) / t.s.length; t.p50 = pctile(t.s, 0.5); t.p95 = pctile(t.s, 0.95); t.p99 = pctile(t.s, 0.99); });
          U.clear(out);
          out.appendChild(h('div', { class: 'grid g4' },
            U.tile('Predict-only, mean', F.sig(tiers[0].mean * 1000) + ' µs', F.n(1000 / tiers[0].mean) + ' flows/s on this device'),
            U.tile('+ SHAP, mean', F.f(tiers[1].mean, 3) + ' ms', (tiers[1].mean / tiers[0].mean).toFixed(0) + '× predict-only (paper: 2.4×)'),
            U.tile('+ SHAP + drift, mean', F.f(tiers[2].mean, 3) + ' ms', (tiers[2].mean / tiers[0].mean).toFixed(0) + '× predict-only (paper: 4.1×)'),
            U.tile('JS heap', performance.memory ? F.n(performance.memory.usedJSHeapSize / 1048576, 0) + ' MB' : 'n/a', performance.memory ? 'this tab (Chromium only)' : 'not exposed by this browser')));
          var rows = [['Tier', 'mean (ms)', 'p50', 'p95', 'p99', 'paper mean (ms)']].concat(tiers.map(function (t) { return [t.name, F.f(t.mean, 4), F.f(t.p50, 4), F.f(t.p95, 4), F.f(t.p99, 4), F.f(t.paper.mean, 2)]; }));
          out.appendChild(U.card('Results on this device', st.n + ' flows per tier. Timer resolution is limited, so each sample times a small group of flows and divides; percentiles are over those group means.', U.table(rows, { num: [1, 2, 3, 4, 5] })));
          var box = h('div', { class: 'chart' });
          U.hbar(box, function () { return { rows: tiers.map(function (t) { return { label: t.name, value: t.mean * 1000, color: 'var(--s1)' }; }), fmt: function (v) { return F.sig(v) + ' µs'; }, labelW: 130, rowH: 34, valueName: 'mean per flow' }; });
          out.appendChild(U.card('Mean time per flow (µs)', null, box));
          out.appendChild(U.callout('info', 'info', h('div', null, h('b', null, 'How to read this. '), 'This is JavaScript on your own machine, not a Raspberry Pi. Trees evaluated directly cost microseconds; the paper’s 4.31 ms predict-only figure is dominated by per-call Python/XGBoost overhead on a throttled single core, which is why its tier ratios (2.4×, 4.1×) are far smaller than the ones here. Compare the shape — explanations cost more than predictions, and the monitor adds a little on top — not the absolute numbers.')));
          out.appendChild(h('div', { class: 'tbl-wrap' }, U.table([['Model file', 'Trees', 'Size (JSON)'], ['A (Enterprise)', '200', F.n(JSON.stringify(W.EDGE_MODELS.A).length / 1024, 0) + ' KB'], ['B (IoT)', '200', F.n(JSON.stringify(W.EDGE_MODELS.B).length / 1024, 0) + ' KB'], ['C (pooled)', '200', F.n(JSON.stringify(W.EDGE_MODELS.C).length / 1024, 0) + ' KB']], { num: [1, 2] })));
          busy = false; if (sink === Infinity) console.log(sink);
        }, 40);
      }
      var nSeg = U.seg([{ value: 500, label: '500' }, { value: 1000, label: '1,000' }, { value: 3000, label: '3,000' }], st.n, function (v) { st.n = v; }, 'Flows per tier');
      root.appendChild(U.pageHeader('Live lab', 'Latency benchmark', 'Time the paper’s three pipeline tiers — predict, +SHAP, +SHAP+drift — with the real models, on whatever device you are using right now.'));
      root.appendChild(h('div', { class: 'col', style: { gap: '16px' } }, U.card('Run it', null, h('div', { class: 'row' }, nSeg, h('button', { class: 'btn primary', type: 'button', onclick: run }, U.icon('timer', 15), 'Run benchmark'))), out));
      out.appendChild(h('p', { class: 'muted small' }, 'Press “Run benchmark”. It blocks the page for a second or two while it measures.'));
    }
  });

  /* ================= connect live traffic ================= */
  function archSvg() {
    var s = U.s, W_ = 760, H_ = 190, sv = s('svg', { viewBox: '0 0 ' + W_ + ' ' + H_, width: '100%', role: 'img', 'aria-label': 'Architecture: packets to agent to API to browser' });
    var boxes = [[10, 'Network', 'switch mirror / NIC'], [195, 'Capture agent', 'scapy · flow table'], [380, 'Edge API', 'FastAPI · same models'], [565, 'This site', 'static, in your browser']];
    boxes.forEach(function (b, i) {
      sv.appendChild(s('rect', { x: b[0], y: 40, width: 170, height: 84, rx: 12, fill: 'var(--panel2)', stroke: 'var(--line)' }));
      sv.appendChild(s('text', { x: b[0] + 85, y: 78, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)', text: b[1] }));
      sv.appendChild(s('text', { x: b[0] + 85, y: 100, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)', text: b[2] }));
      if (i < 3) { sv.appendChild(s('path', { d: 'M' + (b[0] + 174) + ',82H' + (b[0] + 209), stroke: 'var(--axis)', 'stroke-width': 2, fill: 'none' })); sv.appendChild(s('path', { d: 'M' + (b[0] + 203) + ',76L' + (b[0] + 211) + ',82L' + (b[0] + 203) + ',88', stroke: 'var(--axis)', 'stroke-width': 2, fill: 'none' })); }
    });
    [['packets', 100], ['15 canonical features / flow', 282], ['SSE: scores + SHAP + PSI', 470]].forEach(function (l) { sv.appendChild(s('text', { x: l[1] + 90, y: 150, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'var(--ink2)', text: l[0] })); });
    sv.appendChild(s('text', { x: 380, y: 28, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)', text: 'Optional: only this step needs a server' }));
    return sv;
  }
  function fetchText(path) { return fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  U.register('connect', {
    title: 'Connect live traffic',
    render: function (root) {
      var status = h('div', { class: 'small muted' }, 'Not connected.'), feedStat = h('div', { class: 'small muted' }, Lab.custom.length ? Lab.custom.length + ' flows loaded in “Your feed”.' : 'No custom flows loaded yet.');
      var ta = h('textarea', { rows: 7, placeholder: '{"duration": 2125536, "pkt_len_min": 0, … "is_udp": 0}\n— one JSON object per line, or a CSV with a header row —', 'aria-label': 'Flows to load' });
      function note(t) { U.clear(feedStat); feedStat.textContent = t; }
      function load() {
        var txt = ta.value.trim(); if (!txt) { note('Paste some flows first.'); return; }
        var flows = [];
        if (txt[0] === '{' || txt[0] === '[') {
          try { var arr = txt[0] === '[' ? JSON.parse(txt) : txt.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return JSON.parse(l); }); arr.forEach(function (o) { var f = Lab.flowFromObject(o); if (f) flows.push(f); }); }
          catch (e) { note('Could not parse JSON: ' + e.message); return; }
        } else { var p = Lab.rowsFromCSV(txt); if (p.error) { note(p.error); return; } flows = p.rows.map(function (r) { return { raw: r.raw, y: r.y, d: r.d, type: r.type }; }); }
        if (!flows.length) { note('No usable flows found (need at least 8 recognised feature names).'); return; }
        Lab.setCustom(flows.slice(0, 5000), 'pasted'); note(flows.length + ' flows loaded into “Your feed”.'); go.disabled = false;
      }
      var go = h('button', { class: 'btn primary', type: 'button', disabled: !Lab.custom.length, onclick: function () { Lab.pendingScenario = 'custom'; Lab.autoStart = true; location.hash = '#simulator'; } }, U.icon('pulse', 15), 'Replay in the simulator');
      var ex = h('button', { class: 'btn', type: 'button', onclick: function () {
        var rr = E.rng(11), lines = []; for (var i = 0; i < 40; i++) { var r = Lab.rows[Math.floor(rr() * Lab.rows.length)], o = {}; E.FEATURES.forEach(function (f, j) { o[f] = r.raw[j]; }); o.is_attack = r.y; o.domain = Lab.DOM[r.d].toLowerCase(); lines.push(JSON.stringify(o)); }
        ta.value = lines.join('\n'); } }, 'Fill with an example (40 flows)');

      // live server link
      var url = h('input', { type: 'text', value: (/^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname) ? location.origin : 'http://127.0.0.1:8000'), 'aria-label': 'Server base URL' });
      var es = null, cnt = 0;
      function stopES() { if (es) { es.close(); es = null; } status.textContent = 'Stopped. ' + cnt + ' flows received.'; }
      U.onLeave(function () { if (es) es.close(); });
      var test = h('button', { class: 'btn', type: 'button', onclick: function () {
        status.textContent = 'Checking…'; fetch(url.value.replace(/\/$/, '') + '/api/health').then(function (r) { return r.json(); }).then(function (j) { status.textContent = 'Connected — models: ' + (j.models || []).join(', ') + ' · agent flows seen: ' + (j.flows_ingested || 0); }).catch(function () { status.textContent = 'Could not reach that server. A hosted copy of this page runs in a browser sandbox that blocks calls to other addresses; open the site from your own machine (see “Run it yourself” below) and connect to http://127.0.0.1:8000.'; }); } }, 'Test connection');
      var start = h('button', { class: 'btn primary', type: 'button', onclick: function () {
        if (es) return; try { es = new EventSource(url.value.replace(/\/$/, '') + '/api/stream'); } catch (e) { status.textContent = 'Could not open the stream.'; return; }
        cnt = 0; status.textContent = 'Connecting…'; Lab.setCustom([], 'live');
        es.onopen = function () { status.textContent = 'Streaming — waiting for flows from the agent…'; };
        es.onmessage = function (ev) { try { var o = JSON.parse(ev.data), f = Lab.flowFromObject(o.flow || o); if (f) { Lab.pushCustom(f); cnt++; status.textContent = 'Streaming — ' + cnt + ' flows received.'; go.disabled = false; } } catch (e) { } };
        es.onerror = function () { status.textContent = 'Stream error — is the server running and reachable?'; if (es) { es.close(); es = null; } }; } }, U.icon('plug', 15), 'Start streaming');
      var stop = h('button', { class: 'btn', type: 'button', onclick: stopES }, 'Stop');

      var codeA = h('div', { class: 'small muted' }, 'Loading…'), codeS = h('div', { class: 'small muted' }, 'Loading…');
      fetchText('agent_src/live_agent.py.txt').then(function (t) { U.clear(codeA); codeA.appendChild(U.codeBlock(t)); }).catch(function () { U.clear(codeA); codeA.appendChild(h('p', { class: 'small muted' }, 'The agent source ships in the project folder as agent/live_agent.py.')); });
      fetchText('agent_src/server_app.py.txt').then(function (t) { U.clear(codeS); codeS.appendChild(U.codeBlock(t)); }).catch(function () { U.clear(codeS); codeS.appendChild(h('p', { class: 'small muted' }, 'The API source ships in the project folder as server/app.py.')); });

      root.appendChild(U.pageHeader('Live lab', 'Connect real or captured traffic', 'The simulator replays a labeled sample. To run the models on traffic from a real network, a small agent must turn packets into flows first — a browser cannot sniff packets. Three routes, from zero setup to full capture.'));
      root.appendChild(U.card('How the pieces fit', null, h('div', { class: 'col' }, archSvg(), h('p', { class: 'small muted' }, 'The paper models, SHAP and the drift monitor already run in the page. A server is only needed to capture packets, keep history, or serve several viewers.'))));
      root.appendChild(h('div', { class: 'grid g2' },
        U.card('Route 1 · Paste flows (no setup)', 'JSON lines or a CSV with canonical column names. Replay them through the simulator’s “Your feed” scenario.', h('div', { class: 'col' }, ta, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: load }, U.icon('upload', 15), 'Load flows'), ex, go), feedStat)),
        U.card('Route 2 · Stream from your agent', 'Run the Edge API and capture agent on your machine, open this site from it, and flows appear in “Your feed” as they happen.', h('div', { class: 'col' }, h('label', { class: 'f' }, h('span', null, 'Server base URL'), url), h('div', { class: 'row' }, test, start, stop), status, h('p', { class: 'small muted' }, 'Hosted copies of this page cannot call other servers, so this route works when the site is served from your machine or your own deployment.')))));
      root.appendChild(h('div', { class: 'grid g2' },
        U.card('Run it yourself', 'From the project folder (see README):', U.codeBlock('pip install -r server/requirements.txt\nuvicorn server.app:app --port 8000\n# new terminal — capture live (needs root) or replay a pcap:\nsudo python agent/live_agent.py --iface en0 --api http://127.0.0.1:8000\npython agent/live_agent.py --pcap capture.pcap --api http://127.0.0.1:8000\n# then open  http://127.0.0.1:8000  → Connect live traffic → Start streaming')),
        U.card('Flow format', 'One object per flow, canonical units. Extra keys (is_attack, domain, attack_type) are optional.', U.codeBlock('{"duration": 2125536, "pkt_len_min": 0, "pkt_len_max": 1173,\n "pkt_len_mean": 160.53, "pkt_len_std": 312.04, "total_bytes": 2729,\n "byte_rate": 1283, "header_len_total": 344, "flag_syn": 0,\n "flag_fin": 0, "flag_rst": 0, "flag_ack": 0, "flag_psh": 0,\n "is_tcp": 1, "is_udp": 0}'))));
      root.appendChild(U.callout('warn', 'warn', h('div', null, h('b', null, 'Extractor mismatch is a real risk. '), 'The paper’s own two datasets disagree on what header_len_total and byte_rate mean (Section III-A), and that alone breaks naive transfer. A third extractor — the agent here — reconstructs CICFlowMeter-style features from packets; until its output is validated against the training features, treat live scores as a demonstration, not a detection result.')));
      root.appendChild(h('div', { class: 'grid g2' }, U.card('agent/live_agent.py', 'Sniffs packets (scapy), aggregates them into flows, and posts each finished flow to the API.', codeA), U.card('server/app.py', 'FastAPI wrapper around the same trees: /api/predict, /api/drift, /api/ingest, /api/stream (SSE).', codeS)));
    }
  });

  /* ================= reproduce ================= */
  U.register('reproduce', {
    title: 'Reproduce the paper',
    render: function (root) {
      var rowsBox = h('div'), log = h('div', { class: 'small muted' }, 'Press the button to recompute the numbers in your browser.'), running = false;
      var tol = function (d, a, b) { var x = Math.abs(d); return x <= a ? ['benign', 'matches'] : x <= b ? ['warn', 'close'] : ['attack', 'differs']; };
      function run() {
        if (running) return; running = true; U.clear(rowsBox); var out = [['Quantity', 'Paper', 'Recomputed here', 'Verdict', 'Note']], pill;
        var addRow = function (q, paper, mine, v, note) { out.push([q, paper, mine, v ? U.pill(v[0], v[1]) : '', note || '']); };
        var steps = [];
        steps.push(function () { // AUCs
          var dd = [[0, 'A'], [1, 'B'], [1, 'A'], [0, 'B'], [0, 'C'], [1, 'C']], ids = ['A_ent', 'B_iot', 'A_iot', 'B_ent', 'C_ent', 'C_iot'], aucs = {};
          dd.forEach(function (d, i) { var rows = Lab.rows.filter(function (r) { return r.d === d[0]; }), y = rows.map(function (r) { return r.y; }), p = rows.map(function (r) { return Lab.score(r)[d[1]]; }), a = E.auc(y, p), t = R.table1[i]; aucs[ids[i]] = a;
            addRow('AUC · ' + t.label, F.f(t.auc, 4), F.f(a, 4), tol(a - t.auc, 0.01, 0.03), 'sample, not the paper’s test set'); });
          var yE = Lab.rows.filter(function (r) { return r.d === 0; }), yy = yE.map(function (r) { return r.y; });
          addRow('ΔAUC, C vs A on Enterprise', '0.0023 [0.0019, 0.0027]', F.f(aucs.A_ent - aucs.C_ent, 4), tol((aucs.A_ent - aucs.C_ent) - 0.0023, 0.001, 0.004), 'A minus C; the paper pair-bootstraps the full test set');
        });
        steps.push(function () { // sign flip + spearman
          var c = SD.corr;
          addRow('SHAP vs value corr · A on Enterprise', '+0.508', (c.A_enterprise >= 0 ? '+' : '') + F.f(c.A_enterprise, 3), tol(c.A_enterprise - 0.508, 0.1, 0.25), 'same sign: positive');
          addRow('SHAP vs value corr · B on IoT', '−0.916', F.f(c.B_iot, 3), tol(c.B_iot + 0.916, 0.1, 0.25), 'same sign: negative');
          addRow('Model C: no sign flip across domains', 'no flip', (c.C_enterprise >= 0 ? '+' : '') + F.f(c.C_enterprise, 2) + ' / ' + F.f(c.C_iot, 2), (c.C_enterprise >= 0) === (c.C_iot >= 0) ? ['benign', 'matches'] : ['attack', 'differs'], 'Enterprise / IoT on this balanced sample — a weak flip appears; worth re-checking on the full 500-instance test sets');
          addRow('Spearman ρ, Model C importances', '0.900', F.f(SD.spearman_C, 3), tol(SD.spearman_C - 0.9, 0.03, 0.08), '');
        });
        steps.push(function () { // evasion
          var det = Lab.idx[1][1].filter(function (r) { return Lab.score(r).C >= 0.5; }).slice(0, 400);
          [[0.10, R.evasion.square.e10, '84.5%'], [0.30, R.evasion.square.e30, '100%']].forEach(function (e) {
            var ok = 0; det.forEach(function (r) { if (Lab.evade(r, e[0], 1000).success) ok++; }); var rate = ok / det.length, w = E.wilson(ok, det.length);
            addRow('Square-style evasion, ε ≤ ' + e[0].toFixed(2) + ' (IoT)', e[2] + ' [' + F.f(100 * e[1][1], 1) + ', ' + F.f(100 * e[1][2], 1) + ']', F.pct(rate, 1) + ' [' + F.pct(w[0], 1) + ', ' + F.pct(w[1], 1) + '] (n=' + det.length + ')', tol(rate - e[1][0], 0.03, 0.08), 'JS re-implementation of the search');
          });
        });
        steps.push(function () { // drift
          var shift = {}; Lab.WIN.forEach(function (N) {
            var mon = Lab.monitor(0, N), rr = E.rng(777 + N), rows = Lab.rows.filter(function (r) { return r.d === 1; }), b = []; for (var i = 0; i < N; i++) b.push(Lab.shapC(rows[Math.floor(rr() * rows.length)]));
            var psi = mon.mon.psi(b).psi; addRow('Enterprise → IoT PSI, window ' + N, '2.24 – 2.30', F.f(psi, 3) + ' (' + (psi / mon.thr).toFixed(0) + '× thr ' + F.f(mon.thr, 3) + ')', psi > mon.thr ? ['benign', 'fires'] : ['attack', 'missed'], 'paper: 4/4 shift batches detected');
          });
          addRow('Null PSI is below threshold', '0.0060 – 0.0119 vs 0.0125', F.f(Lab.monitor(0, 1000).nullMean, 4) + ' ± ' + F.f(Lab.monitor(0, 1000).nullStd, 4) + ' (N = 1000)', null, 'PSI under no shift scales ≈ 1/N; the paper’s reference/window sizes differ from these');
        });
        var i = 0; U.clear(log); log.textContent = 'Computing…';
        (function next() { if (i < steps.length) { log.textContent = 'Computing ' + (i + 1) + ' / ' + steps.length + '…'; setTimeout(function () { steps[i++](); next(); }, 30); return; }
          log.textContent = 'Done. Each row recomputes one quantity from the paper using the trained models in this page.'; U.clear(rowsBox); rowsBox.appendChild(U.table(out)); U.$$('td', rowsBox).forEach(function (td) { td.style.whiteSpace = 'normal'; });
          running = false; })();
      }
      root.appendChild(U.pageHeader('Verification', 'Reproduce the paper’s key numbers', 'Recompute headline quantities from the trained models in your browser and compare them with the paper. Differences are expected where the demo sample differs from the paper’s test sets — and informative where they are not expected.'));
      root.appendChild(U.callout('warn', 'info', h('div', null, h('b', null, 'Why numbers will differ. '), 'The sample is 6,070 class-balanced flows drawn with replacement, and some may have been in the models’ training data; the paper’s intervals are on 59k–72k held-out test rows. “Matches” here is a loose tolerance, not statistical agreement.')));
      root.appendChild(U.card('Run the checks', 'Takes a few seconds.', h('div', { class: 'col' }, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: run }, U.icon('check', 15), 'Recompute now')), log, rowsBox)));
    }
  });
})(window);
