/* Lab layer: models, sample pool, scoring caches, scenario streams, evasion, monitors, CSV/JSON ingestion. */
(function (W) {
  'use strict';
  var E = W.EdgeEngine, P = W.EDGE_POOL, M = W.EDGE_MODELS, NF = E.NF;
  var Lab = {};
  W.Lab = Lab;

  Lab.models = { A: new E.TreeModel(M.A), B: new E.TreeModel(M.B), C: new E.TreeModel(M.C) };
  Lab.KEYS = ['A', 'B', 'C'];
  Lab.NAMES = { A: 'Model A · Enterprise-only', B: 'Model B · IoT-only', C: 'Model C · Pooled (proposed)' };
  Lab.SHORT = { A: 'A · Enterprise', B: 'B · IoT', C: 'C · Pooled' };
  Lab.COLORS = { A: 'var(--s1)', B: 'var(--s2)', C: 'var(--s3)' };
  Lab.DOM = ['Enterprise', 'IoT'];
  Lab.FEATURES = E.FEATURES; Lab.LABELS = E.FEATURE_LABELS;
  Lab.lo = Float32Array.from(P.lo); Lab.hi = Float32Array.from(P.hi);
  Lab.UNITS = ['µs', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes/s', 'bytes', '0/1', '0/1', '0/1', '0/1', '0/1', '0/1', '0/1'];
  Lab.THR = 0.5;

  Lab.rows = P.rows.map(function (r, i) { return { i: i, d: r[0], type: P.types[r[1]], y: r[2], raw: r.slice(3) }; });
  Lab.idx = [[[], []], [[], []]]; Lab.rows.forEach(function (r) { Lab.idx[r.d][r.y].push(r); });
  Lab.isDoS = function (t) { return /dos|ddos/i.test(t); };
  Lab.idxDoS = [Lab.idx[0][1].filter(function (r) { return Lab.isDoS(r.type); }), Lab.idx[1][1].filter(function (r) { return Lab.isDoS(r.type); })];
  Lab.attackTypes = function (d) { var m = {}; Lab.idx[d][1].forEach(function (r) { m[r.type] = (m[r.type] || 0) + 1; }); return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (t) { return { type: t, n: m[t] }; }); };

  Lab.xOf = function (row) { return row.x || (row.x = E.prep(row.raw)); };
  Lab.scoreX = function (x) { return { A: Lab.models.A.proba(x), B: Lab.models.B.proba(x), C: Lab.models.C.proba(x) }; };
  Lab.score = function (row) { if (!row.p) row.p = Lab.scoreX(Lab.xOf(row)); return row.p; };
  Lab.shapOf = function (key, x) { return Lab.models[key].shap(x); };
  Lab.shapC = function (row) { if (!row.sC) row.sC = Lab.models.C.shap(Lab.xOf(row)).phi; return row.sC; };
  Lab.verdict = function (p) { return p >= Lab.THR; };
  Lab.rawOf = function (x) { var o = E.unprep(x); return E.FEATURES.map(function (f) { return o[f]; }); };

  /* ----- evasion (Square-style random search against Model C, as in the paper's IoT experiment) ----- */
  Lab.evade = function (row, eps, maxQ) {
    maxQ = maxQ || 1000; row.ev = row.ev || {}; var k = eps + '|' + maxQ;
    if (row.ev[k]) return row.ev[k];
    var r = E.squareAttack(Lab.models.C, Lab.xOf(row), { eps: eps, maxQ: maxQ, threshold: Lab.THR, lo: Lab.lo, hi: Lab.hi, rand: E.rng(9000 + row.i) });
    r.p = Lab.scoreX(r.xadv); r.raw = Lab.rawOf(r.xadv); row.ev[k] = r; return r;
  };

  /* ----- drift monitors ----- */
  var monCache = {};
  Lab.monitor = function (dom, N) {
    var key = dom + '|' + N; if (monCache[key]) return monCache[key];
    var spec = W.EDGE_MONITOR[Lab.DOM[dom].toLowerCase()][String(N)];
    return monCache[key] = { mon: E.Monitor.fromSpec(spec), thr: spec.threshold, nullMean: spec.null_mean, nullStd: spec.null_std, N: N };
  };
  Lab.WIN = [250, 500, 1000];
  Lab.nearestN = function (n) { return Lab.WIN.reduce(function (a, b) { return Math.abs(b - n) < Math.abs(a - n) ? b : a; }); };

  /* ----- scenarios for streams ----- */
  Lab.SCENARIOS = [
    { id: 'steady', label: 'Steady state', blurb: 'Same mix the monitor was calibrated on. Expect no alarm.' },
    { id: 'quiet', label: 'Quiet hours', blurb: 'Only ~10% of flows are attacks. The mix changed, nothing new arrived — watch whether the monitor fires.' },
    { id: 'burst', label: 'DoS / DDoS burst', blurb: '~85% of flows are DoS/DDoS floods in the deployed network.' },
    { id: 'foreign', label: 'Foreign traffic', blurb: 'Flows from the other network type (Enterprise ⇄ IoT) start arriving — the paper\'s domain-shift case.' },
    { id: 'evasion', label: 'Evasive attacker', blurb: 'Steady mix, but every attack flow is perturbed by a Square-style attacker to slip past Model C.' },
    { id: 'custom', label: 'Your feed', blurb: 'Replays flows you pasted or streamed in on the “Connect live traffic” page.' }
  ];
  Lab.custom = []; Lab.customMeta = { source: 'none' };
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  Lab.makeStream = function (cfg) {
    var r = E.rng(cfg.seed || 1), dom = cfg.dom, sc = cfg.scenario, other = 1 - dom, ci = 0, seq = 0;
    var all = function (d) { return Lab.rows.filter(function (x) { return x.d === d; }); }, pool = [all(0), all(1)];
    return {
      next: function () {
        var row, src = dom;
        if (sc === 'foreign') { src = other; row = pick(pool[other], r); }
        else if (sc === 'quiet') { row = r() < 0.10 ? pick(Lab.idx[dom][1], r) : pick(Lab.idx[dom][0], r); }
        else if (sc === 'mix') { row = r() < cfg.pAttack ? pick(Lab.idx[dom][1], r) : pick(Lab.idx[dom][0], r); }
        else if (sc === 'burst') { row = r() < 0.85 ? pick(Lab.idxDoS[dom], r) : pick(Lab.idx[dom][0], r); }
        else if (sc === 'custom' && Lab.custom.length) { var cf = Lab.custom[ci++ % Lab.custom.length]; row = { i: -1 - (seq), d: cf.d == null ? dom : cf.d, type: cf.type || 'custom', y: cf.y == null ? -1 : cf.y, raw: cf.raw }; src = row.d; }
        else row = pick(pool[dom], r);
        var f = { id: ++seq, row: row, d: src, y: row.y, type: row.type, evaded: false, x: Lab.xOf(row), p: Lab.score(row), raw: row.raw };
        if (sc === 'evasion' && row.y === 1) {
          var ev = Lab.evade(row, cfg.eps || 0.1, 1000); f.x = ev.xadv; f.p = ev.p; f.raw = ev.raw; f.evaded = ev.success; f.attempted = true;
        }
        var self = f; f.shap = function (k) { k = k || 'C'; if (k === 'C' && !self.attempted && self.row.i >= 0) return Lab.shapC(self.row); self._s = self._s || {}; return self._s[k] || (self._s[k] = Lab.models[k].shap(self.x).phi); };
        return f;
      }
    };
  };

  /* chunked, non-blocking SHAP precompute for a list of rows (Model C) */
  Lab.ensureShap = function (rows, onProgress, done) {
    var i = 0, need = rows.filter(function (r) { return !r.sC; });
    (function chunk() {
      var t0 = performance.now();
      while (i < need.length && performance.now() - t0 < 24) { Lab.shapC(need[i]); i++; }
      if (onProgress) onProgress(need.length ? i / need.length : 1);
      if (i < need.length) setTimeout(chunk, 0); else if (done) done();
    })();
  };

  /* ----- ingestion of external flows (pasted JSON / CSV / SSE) ----- */
  Lab.ALIASES = {
    duration: ['duration', 'flow duration', 'flow_duration'], pkt_len_min: ['pkt_len_min', 'pkt len min', 'min packet length', 'packet length min'],
    pkt_len_max: ['pkt_len_max', 'pkt len max', 'max packet length', 'packet length max'], pkt_len_mean: ['pkt_len_mean', 'pkt len mean', 'packet length mean'],
    pkt_len_std: ['pkt_len_std', 'pkt len std', 'packet length std'], total_bytes: ['total_bytes', 'tot size', 'totlen'],
    byte_rate: ['byte_rate', 'flow byts/s', 'flow bytes/s', 'rate'], header_len_total: ['header_len_total', 'header_length', 'header len total'],
    flag_syn: ['flag_syn', 'syn flag cnt', 'syn_flag_number', 'syn_count'], flag_fin: ['flag_fin', 'fin flag cnt', 'fin_flag_number', 'fin_count'],
    flag_rst: ['flag_rst', 'rst flag cnt', 'rst_flag_number', 'rst_count'], flag_ack: ['flag_ack', 'ack flag cnt', 'ack_flag_number', 'ack_count'],
    flag_psh: ['flag_psh', 'psh flag cnt', 'psh_flag_number'], is_tcp: ['is_tcp', 'tcp'], is_udp: ['is_udp', 'udp']
  };
  Lab.labelAliases = ['is_attack', 'label', 'y'];
  Lab.parseCSV = function (text) {
    var rows = [], row = [], cur = '', q = false, i = 0, n = text.length;
    for (; i < n; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r.length === 1 && r[0] !== ''); });
  };
  /* map header → canonical indexes; returns {map:{canonIdx:colIdx}, missing:[names], labelCol} */
  Lab.mapHeader = function (header) {
    var low = header.map(function (h) { return String(h).trim().toLowerCase(); }), map = {}, missing = [];
    E.FEATURES.forEach(function (f, j) {
      var cols = Lab.ALIASES[f], k = -1; for (var a = 0; a < cols.length && k < 0; a++) k = low.indexOf(cols[a]);
      if (k >= 0) map[j] = k; else missing.push(f);
    });
    var lc = -1; Lab.labelAliases.forEach(function (a) { if (lc < 0) lc = low.indexOf(a); });
    var dc = low.indexOf('domain'), tc = low.indexOf('attack_type'); if (tc < 0) tc = low.indexOf('type');
    return { map: map, missing: missing, labelCol: lc, domCol: dc, typeCol: tc };
  };
  Lab.rowsFromCSV = function (text) {
    var t = Lab.parseCSV(text); if (t.length < 2) return { error: 'No data rows found.' };
    var hm = Lab.mapHeader(t[0]);
    if (hm.missing.length > 3) return { error: 'Could not find the canonical columns. Missing: ' + hm.missing.join(', ') };
    var out = [];
    for (var i = 1; i < t.length; i++) {
      var r = t[i], raw = new Array(NF), bad = false;
      for (var j = 0; j < NF; j++) { var c = hm.map[j]; var v = c == null ? 0 : parseFloat(r[c]); if (!isFinite(v)) { v = 0; } raw[j] = v; }
      var y = -1; if (hm.labelCol >= 0) { var lv = String(r[hm.labelCol]).trim().toLowerCase(); y = (lv === '1' || lv === 'true' || (lv !== '0' && lv !== 'false' && lv !== 'benign' && lv !== 'benigntraffic' && lv !== '' )) ? 1 : 0; }
      out.push({ i: -1 - i, d: hm.domCol >= 0 ? (String(r[hm.domCol]).toLowerCase().indexOf('iot') === 0 ? 1 : 0) : null, type: hm.typeCol >= 0 ? r[hm.typeCol] : 'uploaded', y: y, raw: raw });
    }
    return { rows: out, missing: hm.missing, hasLabel: hm.labelCol >= 0 };
  };
  Lab.flowFromObject = function (o) {
    var raw = new Array(NF), low = {}; Object.keys(o).forEach(function (k) { low[String(k).toLowerCase()] = o[k]; });
    var found = 0;
    E.FEATURES.forEach(function (f, j) { var al = Lab.ALIASES[f], v; for (var a = 0; a < al.length; a++) if (low[al[a]] != null) { v = low[al[a]]; break; } v = parseFloat(v); if (isFinite(v)) found++; raw[j] = isFinite(v) ? v : 0; });
    if (found < 8) return null;
    var y = low.is_attack != null ? +low.is_attack : (low.label != null ? (/benign/i.test(String(low.label)) ? 0 : 1) : -1);
    return { raw: raw, y: y, d: low.domain != null ? (/iot/i.test(String(low.domain)) ? 1 : 0) : null, type: low.attack_type || low.label || 'live' };
  };
  Lab.setCustom = function (flows, source) { Lab.custom = flows; Lab.customMeta = { source: source || 'pasted', n: flows.length, at: Date.now() }; };
  Lab.pushCustom = function (flow) { Lab.custom.push(flow); if (Lab.custom.length > 5000) Lab.custom.shift(); Lab.customMeta.n = Lab.custom.length; };

  /* ----- metrics ----- */
  Lab.metrics = function (y, p, thr) {
    thr = thr == null ? Lab.THR : thr; var tp = 0, fp = 0, tn = 0, fn = 0;
    for (var i = 0; i < y.length; i++) { var pr = p[i] >= thr; if (y[i] === 1) { if (pr) tp++; else fn++; } else if (y[i] === 0) { if (pr) fp++; else tn++; } }
    var prec = tp / Math.max(tp + fp, 1), rec = tp / Math.max(tp + fn, 1);
    return { tp: tp, fp: fp, tn: tn, fn: fn, prec: prec, rec: rec, f1: 2 * prec * rec / Math.max(prec + rec, 1e-12), acc: (tp + tn) / Math.max(tp + tn + fp + fn, 1), fpr: fp / Math.max(fp + tn, 1) };
  };

  /* top contributors of a SHAP vector for display */
  Lab.topShap = function (phi, k) {
    var idx = Array.from(phi.keys()).sort(function (a, b) { return Math.abs(phi[b]) - Math.abs(phi[a]); }), top = idx.slice(0, k), rest = idx.slice(k).reduce(function (s, j) { return s + phi[j]; }, 0);
    var rows = top.map(function (j) { return { j: j, label: Lab.LABELS[E.FEATURES[j]], value: phi[j] }; });
    if (idx.length > k) rows.push({ j: -1, label: (idx.length - k) + ' other features', value: rest, color: 'var(--muted)' });
    return rows;
  };
  Lab.fmtRaw = function (j, v) { if (j >= 8) return v >= 0.5 ? '1' : '0'; return W.UI.F.raw(v); };
  Lab.sigmoid = function (m) { return 1 / (1 + Math.exp(-m)); };
  Lab.tmplFlowText = function (raw) { return E.FEATURES.map(function (f, j) { return f + '=' + raw[j]; }).join(', '); };
})(window);
