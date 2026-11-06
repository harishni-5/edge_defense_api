/* Lab tools (1/2): flow builder, attack lab, drift lab */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, E = W.EdgeEngine;
  function more(links) { return h('div', { class: 'row' }, links.map(function (l) { return h('a', { class: 'btn', href: '#' + l[0] }, U.icon(l[2] || 'arrow', 15), l[1]); })); }
  var INTEGERS = { 0: 1, 1: 1, 2: 1, 5: 1, 7: 1 };
  function xticks(lo, hi) { var t = [0], v = 1; while (Math.log1p(v) <= hi + 1e-9) { t.push(Math.log1p(v)); v *= 10; } return t; }

  function scoreBars(p, y) {
    return h('div', { class: 'col', style: { gap: '10px' } }, Lab.KEYS.map(function (k) {
      var flagged = p[k] >= Lab.THR;
      return h('div', { style: { display: 'grid', 'grid-template-columns': '120px minmax(60px,1fr) 150px', gap: '10px', 'align-items': 'center' } },
        h('span', { class: 'bigmodel small' }, h('span', { class: 'dotm', style: { background: Lab.COLORS[k] } }), Lab.SHORT[k]),
        h('span', { class: 'pbar thr', style: { '--thr': '50%', width: '100%', height: '12px', 'margin-right': 0 } }, h('i', { style: { width: Math.max(1.5, p[k] * 100) + '%', background: Lab.COLORS[k] } })),
        h('span', { class: 'row', style: { gap: '8px', 'flex-wrap': 'nowrap' } }, h('span', { class: 'mono num small' }, F.f(p[k], 3)), flagged ? U.pill('attack', 'attack') : U.pill('benign', 'benign')));
    }));
  }

  /* ================= flow builder ================= */
  U.register('builder', {
    title: 'Flow builder',
    render: function (root) {
      var st = { raw: Lab.idx[0][0][3].raw.slice(), key: 'C', sweep: 7 }, inputs = [];
      var out = h('div', { class: 'col', style: { gap: '16px', 'min-width': 0 } });
      var scBox = h('div'), wfBox = h('div', { class: 'chart' }), swBox = h('div', { class: 'chart' }), sumBox = h('div', { class: 'col', style: { gap: '6px' } });
      var wf = W.Waterfall(wfBox, function () { var x = E.prep(st.raw); return { phi: Lab.models[st.key].shap(x).phi, x: x, key: st.key }; });
      var sw = U.lineChart(swBox, function () {
        var j = st.sweep, lo = Lab.lo[j], hi = Lab.hi[j], pts = { A: [], B: [], C: [] }, n = j >= 8 ? 2 : 90, cur = j < 8 ? Math.log1p(st.raw[j]) : st.raw[j];
        for (var i = 0; i < n; i++) {
          var v = j >= 8 ? i : lo + (hi - lo) * i / (n - 1), raw = st.raw.slice(); raw[j] = j < 8 ? Math.expm1(v) : v;
          var p = Lab.scoreX(E.prep(raw)); Lab.KEYS.forEach(function (k) { pts[k].push([v, p[k]]); });
        }
        return { height: 260, x: { ticks: j >= 8 ? [0, 1] : xticks(lo, hi), tickFmt: j >= 8 ? function (v) { return v; } : function (v) { return F.raw(Math.expm1(v)); }, min: j >= 8 ? 0 : lo, max: j >= 8 ? 1 : hi, label: Lab.LABELS[E.FEATURES[j]] + ' (' + Lab.UNITS[j] + ')', fmt: j >= 8 ? function (v) { return v; } : function (v) { return F.raw(Math.expm1(v)); }, tipLabel: Lab.LABELS[E.FEATURES[j]] + ' =' }, y: { min: 0, max: 1, label: 'P(attack)', fmt: function (v) { return F.f(v, 1); }, tipFmt: function (v) { return F.f(v, 3); } },
          series: Lab.KEYS.map(function (k) { return { name: Lab.SHORT[k], color: Lab.COLORS[k], pts: pts[k], dots: j >= 8, dash: k === 'C' ? '7 4' : null }; }), hlines: [{ y: 0.5, label: 'decision 0.5' }], bands: [{ x0: cur - (hi - lo) * 0.0015, x1: cur + (hi - lo) * 0.0015, fill: 'var(--ink)', opacity: 0.55 }], aria: 'P(attack) as one feature is varied' };
      });
      function update() {
        var x = E.prep(st.raw), p = Lab.scoreX(x); U.clear(scBox); scBox.appendChild(scoreBars(p));
        var phi = Lab.models[st.key].shap(x).phi, ex = W.explainSummary(st.key, x, phi);
        U.clear(sumBox); sumBox.appendChild(h('div', { class: 'small', style: { color: 'var(--ink2)' } }, Lab.NAMES[st.key] + ': p = ' + F.f(ex.p, 3) + ' vs. an average of ' + F.f(ex.base, 2) + ' over its training data. Red bars push toward attack, blue toward benign.'));
        wf.redraw(); sw.redraw();
      }
      function setRaw(raw) { st.raw = raw.slice(); inputs.forEach(function (c) { c.set(); }); update(); }

      // inputs
      var form = h('div', { class: 'col', style: { gap: '12px' } });
      E.FEATURES.forEach(function (f, j) {
        if (j < 8) {
          var num = h('input', { type: 'number', style: { width: '116px', flex: 'none' }, min: 0, step: INTEGERS[j] ? 1 : 0.01, 'aria-label': Lab.LABELS[f] + ' (' + Lab.UNITS[j] + ')' });
          var rng = h('input', { type: 'range', min: 0, max: Lab.hi[j], step: 0.01, 'aria-label': Lab.LABELS[f] + ' slider (log scale)' });
          var ctl = { set: function () { num.value = INTEGERS[j] ? Math.round(st.raw[j]) : +(+st.raw[j]).toFixed(2); rng.max = Math.max(Lab.hi[j], Math.log1p(st.raw[j])); rng.value = Math.log1p(st.raw[j]); } };
          rng.addEventListener('input', function () { var r = Math.expm1(+rng.value); st.raw[j] = INTEGERS[j] ? Math.round(r) : +r.toFixed(2); num.value = st.raw[j]; update(); });
          num.addEventListener('input', function () { var v = Math.max(0, parseFloat(num.value)); if (!isFinite(v)) return; st.raw[j] = v; rng.max = Math.max(Lab.hi[j], Math.log1p(v)); rng.value = Math.log1p(v); update(); });
          inputs.push(ctl);
          form.appendChild(h('div', { class: 'f' }, h('div', { class: 'lbl-row' }, h('span', { style: { 'font-size': '12.5px', 'font-weight': 600, color: 'var(--ink2)' } }, Lab.LABELS[f] + ' ', h('span', { class: 'muted xs' }, '(' + Lab.UNITS[j] + (R_flag(f) ? ' · mismatched across datasets' : '') + ')')), num), rng));
        }
      });
      var flags = h('div', { class: 'grid g2', style: { gap: '8px 12px' } });
      E.FEATURES.forEach(function (f, j) {
        if (j < 8) return; var cb = h('input', { type: 'checkbox', 'aria-label': Lab.LABELS[f] });
        cb.addEventListener('change', function () { st.raw[j] = cb.checked ? 1 : 0; update(); });
        inputs.push({ set: function () { cb.checked = st.raw[j] >= 0.5; } }); flags.appendChild(h('label', { class: 'check' }, cb, Lab.LABELS[f]));
      });
      function R_flag(f) { return f === 'header_len_total' || f === 'byte_rate'; }

      // presets
      var dom = 0, typ = 'Benign';
      var typeSel = U.select('Flow type', [], typ, function (v) { typ = v; });
      function fillTypes() {
        var ts = [{ value: 'Benign', label: 'Benign' }].concat(Lab.attackTypes(dom).map(function (t) { return { value: t.type, label: t.type }; }));
        U.clear(typeSel.sel); ts.forEach(function (o) { typeSel.sel.appendChild(h('option', { value: o.value }, o.label)); }); typ = 'Benign'; typeSel.sel.value = typ;
      }
      var domSeg = U.seg([{ value: 0, label: 'Enterprise' }, { value: 1, label: 'IoT' }], dom, function (v) { dom = v; fillTypes(); }, 'Network');
      var load = h('button', { class: 'btn', type: 'button', onclick: function () {
        var pool = Lab.rows.filter(function (r) { return r.d === dom && (typ === 'Benign' ? r.y === 0 : r.type === typ); });
        setRaw(pool[Math.floor(Math.random() * pool.length)].raw); } }, U.icon('bolt', 15), 'Load a real flow like this');
      var sweepSel = U.select('What-if sweep: vary', E.FEATURES.map(function (f, j) { return { value: j, label: Lab.LABELS[f] }; }), 7, function (v) { st.sweep = +v; sw.redraw(); });
      var keySeg = U.seg(Lab.KEYS.map(function (k) { return { value: k, label: 'Model ' + k }; }), st.key, function (v) { st.key = v; update(); }, 'Model to explain');

      root.appendChild(U.pageHeader('Live lab', 'Flow builder', 'Build or load a flow in the paper’s 15-feature canonical schema, score it with all three models, see why, and sweep any one feature to find where each model flips its verdict.'));
      root.appendChild(h('div', { class: 'lab' },
        h('aside', { class: 'card ctrl' }, h('div', { class: 'grp' }, h('h4', null, 'Start from a real flow'), domSeg, typeSel, load),
          h('div', { class: 'grp' }, h('h4', null, 'Continuous features'), form), h('div', { class: 'grp' }, h('h4', null, 'Flags and protocol'), flags)),
        h('div', { class: 'col', style: { gap: '16px', 'min-width': 0 } },
          U.card('Scores', 'P(attack) from each model for the flow on the left. Tick = 0.5 decision threshold.', scBox),
          U.card('Why? (SHAP)', null, h('div', { class: 'col' }, keySeg, sumBox, wfBox)),
          U.card('What-if sweep', 'Everything else held fixed. A model whose line crosses 0.5 flips its verdict at that value; lines that disagree show where the models learned different rules.', h('div', { class: 'col' }, sweepSel, U.legend(Lab.KEYS.map(function (k) { return { label: Lab.SHORT[k], color: Lab.COLORS[k] }; })), swBox)),
          U.callout('info', 'info', h('div', null, 'Features are expressed in the canonical units (durations in µs, sizes in bytes). Eight continuous ones are log1p-transformed before the trees see them, so sliders are logarithmic.')))));
      fillTypes(); setRaw(st.raw);
    }
  });

  /* ================= attack lab ================= */
  U.register('attacklab', {
    title: 'Attack lab',
    render: function (root) {
      var st = { dom: 1, type: null, row: null, eps: 0.10, maxQ: 1000, seed: 1, res: null, shown: 0, key: 'C' };
      var resBox = h('div', { class: 'col', style: { gap: '16px' } }), batchBox = h('div', { class: 'col', style: { gap: '14px' } });
      var typeSel = U.select('Attack type', [], '', function (v) { st.type = v; pick(); });
      function detectedTypes() { var m = {}; Lab.idx[st.dom][1].forEach(function (r) { if (Lab.score(r).C >= 0.5) m[r.type] = (m[r.type] || 0) + 1; }); return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (t) { return { value: t, label: t + ' (' + m[t] + ')' }; }); }
      function fillTypes() { var ts = detectedTypes(); U.clear(typeSel.sel); ts.forEach(function (o) { typeSel.sel.appendChild(h('option', { value: o.value }, o.label)); }); st.type = ts[0].value; typeSel.sel.value = st.type; }
      function pick() { var pool = Lab.idx[st.dom][1].filter(function (r) { return r.type === st.type && Lab.score(r).C >= 0.5; }); st.row = pool[Math.floor(Math.random() * pool.length)]; st.res = null; run(); }

      var domSeg = U.seg([{ value: 1, label: 'IoT (as in the paper)' }, { value: 0, label: 'Enterprise (exploratory)' }], st.dom, function (v) { st.dom = v; fillTypes(); pick(); batchBox.innerHTML = ''; }, 'Network');
      var epsS = U.slider('Budget ε (fraction of each feature’s range)', 0.02, 0.50, 0.01, st.eps, function (v) { st.eps = v; run(); }, function (v) { return v.toFixed(2); });
      var qS = U.slider('Query budget', 50, 2000, 50, st.maxQ, function (v) { st.maxQ = v; run(); }, function (v) { return v + ' queries'; });
      var again = h('button', { class: 'btn', type: 'button', onclick: function () { st.seed++; run(); } }, U.icon('reset', 15), 'Re-roll the search');
      var other = h('button', { class: 'btn', type: 'button', onclick: pick }, U.icon('bolt', 15), 'Pick another flow');

      function run() {
        if (!st.row) return;
        var x = Lab.xOf(st.row);
        var r = E.squareAttack(Lab.models.C, x, { eps: st.eps, maxQ: st.maxQ, threshold: Lab.THR, lo: Lab.lo, hi: Lab.hi, rand: E.rng(st.seed * 7919 + st.row.i) });
        r.p = Lab.scoreX(r.xadv); r.raw = Lab.rawOf(r.xadv); r.p0 = Lab.score(st.row); r.phi0 = Lab.shapC(st.row); r.phi1 = Lab.models.C.shap(r.xadv).phi;
        st.res = r; st.shown = 0; st.t0 = performance.now(); render(); animate();
      }
      var raf = 0; function animate() {
        cancelAnimationFrame(raf); var n = st.res.history.length;
        (function f() { var k = Math.min(1, (performance.now() - st.t0) / 700); st.shown = Math.max(2, Math.round(k * n)); if (st.chart) st.chart.redraw(); if (k < 1) raf = requestAnimationFrame(f); })();
      }
      U.onLeave(function () { cancelAnimationFrame(raf); });

      var qBox = h('div', { class: 'chart' });
      st.chart = U.lineChart(qBox, function () {
        var r = st.res; if (!r) return { height: 240, x: { min: 0, max: 10 }, y: { min: 0, max: 1 }, series: [] };
        var pts = r.history.slice(0, st.shown || r.history.length).map(function (v, i) { return [i + 1, v]; });
        return { height: 240, x: { min: 1, max: Math.max(2, r.history.length), label: 'queries to Model C', fmt: F.n }, y: { min: 0, max: 1, label: 'best P(attack) so far', fmt: function (v) { return F.f(v, 1); }, tipFmt: function (v) { return F.f(v, 3); } },
          series: [{ name: 'Model C P(attack)', color: 'var(--s3)', pts: pts, w: 2.4 }], hlines: [{ y: 0.5, label: 'decision threshold 0.5' }], endLabels: true, aria: 'Model C score during the attack' };
      });
      var wf0Box = h('div', { class: 'chart' }), wf1Box = h('div', { class: 'chart' });
      var wf0 = W.Waterfall(wf0Box, function () { var r = st.res; return { phi: r ? r.phi0 : new Float64Array(15), x: r ? Lab.xOf(st.row) : new Float32Array(15) }; }, 6);
      var wf1 = W.Waterfall(wf1Box, function () { var r = st.res; return { phi: r ? r.phi1 : new Float64Array(15), x: r ? r.xadv : new Float32Array(15) }; }, 6);

      function render() {
        var r = st.res; U.clear(resBox); if (!r) return;
        var ok = r.success;
        resBox.appendChild(h('div', { class: 'alarm ' + (ok ? 'fire' : 'ok') }, U.icon(ok ? 'warn' : 'check', 20), h('span', null, ok ? 'Evaded Model C after ' + F.n(r.queries) + ' queries — largest change was ' + F.pct(r.linf, 1) + ' of a feature’s range (budget ' + F.pct(st.eps, 0) + '). P(attack) fell from ' + F.f(r.p0.C, 3) + ' to ' + F.f(r.prob, 3) + '.' : 'Model C held within ' + F.n(r.queries) + ' queries: best P(attack) stayed at ' + F.f(r.prob, 3) + '. Try a larger ε or more queries.')));
        resBox.appendChild(h('div', { class: 'grid g2a' },
          U.card('Verdicts before → after', 'Only Model C was attacked; A and B are scored on the same perturbed flow (transfer).', U.table([['Model', 'Before', 'After', 'Verdict now']].concat(Lab.KEYS.map(function (k) { return [h('span', { class: 'bigmodel' }, h('span', { class: 'dotm', style: { background: Lab.COLORS[k] } }), Lab.SHORT[k]), F.f(r.p0[k], 3), F.f(r.p[k], 3), r.p[k] >= 0.5 ? U.pill('attack', 'attack') : U.pill('benign', 'benign')]; })), { num: [1, 2] })),
          U.card('Search progress', 'Best score found as the attacker spends queries.', qBox)));
        var diff = [['Feature', 'Before', 'After', 'Change (% of range)']];
        E.FEATURES.forEach(function (f, j) { var rg = Lab.hi[j] - Lab.lo[j], x0 = Lab.xOf(st.row)[j], x1 = r.xadv[j], d = rg > 0 ? Math.abs(x1 - x0) / rg : 0; if (d > 0.0005) diff.push([Lab.LABELS[f], Lab.fmtRaw(j, Lab.rawOf(Lab.xOf(st.row))[j]), Lab.fmtRaw(j, r.raw[j]), (100 * d).toFixed(1) + '%']); });
        resBox.appendChild(U.card('What the attacker changed', 'Each feature is moved independently inside its budget; nothing keeps them physically consistent (e.g. min ≤ max), exactly as the paper discloses.', diff.length > 1 ? U.table(diff, { num: [1, 2, 3] }) : h('p', { class: 'muted small' }, 'Nothing moved — this flow already sits far from the boundary.')));
        resBox.appendChild(h('div', { class: 'grid g2' }, U.card('SHAP before (Model C)', null, wf0Box), U.card('SHAP after the attack', 'The attributions barely look like the original — which is what the drift monitor picks up in aggregate.', wf1Box)));
        wf0.redraw(); wf1.redraw();
      }

      // ---- batch ----
      var batchN = 250, batchEps = 0.10, running = false;
      function runBatch() {
        if (running) return; running = true; U.clear(batchBox);
        var prog = h('div', { class: 'progress' }, h('i')), msg = h('div', { class: 'small muted' }, 'Drawing a calm window and attacking it…');
        batchBox.appendChild(msg); batchBox.appendChild(prog);
        var N = batchN, dom = st.dom, rr = E.rng(4242 + N + dom), rows = [];
        var pool = Lab.rows.filter(function (r) { return r.d === dom; });
        for (var i = 0; i < N; i++) rows.push(pool[Math.floor(rr() * pool.length)]);
        var atk = rows.filter(function (r) { return r.y === 1; }), evs = {}, k = 0;
        function chunk() {
          var t0 = performance.now();
          while (k < atk.length && performance.now() - t0 < 20) { var r = atk[k++]; if (!evs[r.i]) { var e = Lab.evade(r, batchEps, 1000); evs[r.i] = e; } }
          prog.firstChild.style.width = (100 * k / Math.max(atk.length, 1)) + '%';
          if (k < atk.length) { setTimeout(chunk, 0); return; }
          Lab.ensureShap(rows, null, function () { finish(); });
        }
        function finish() {
          var mon = Lab.monitor(dom, N), thr = mon.thr, M = mon.mon;
          var detected = atk.filter(function (r) { return Lab.score(r).C >= 0.5; }), ev = detected.filter(function (r) { return evs[r.i].success; });
          var wil = E.wilson(ev.length, detected.length);
          var sClean = rows.map(function (r) { return Lab.shapC(r); });
          var sEv = rows.map(function (r) { return r.y === 1 && evs[r.i] ? Lab.models.C.shap(evs[r.i].xadv).phi : Lab.shapC(r); });
          var aClean = atk.map(function (r) { return Lab.shapC(r); }), aEv = atk.map(function (r) { return evs[r.i] ? Lab.models.C.shap(evs[r.i].xadv).phi : Lab.shapC(r); });
          var recAfter = atk.filter(function (r) { return evs[r.i].p.C >= 0.5; }).length / Math.max(atk.length, 1), recBefore = detected.length / Math.max(atk.length, 1);
          var psi = function (a) { return M.psi(a).psi; };
          var rows2 = [['Window', 'Model C recall', 'PSI', '× threshold'],
            ['Calm window (control)', F.pct(recBefore, 1), F.f(psi(sClean), 4), (psi(sClean) / thr).toFixed(1) + '×'],
            ['Same window, attackers evade (ε = ' + batchEps.toFixed(2) + ')', F.pct(recAfter, 1), F.f(psi(sEv), 4), (psi(sEv) / thr).toFixed(1) + '×'],
            ['Attack flows only, unperturbed', F.pct(recBefore, 1), F.f(psi(aClean), 4), (psi(aClean) / thr).toFixed(1) + '×'],
            ['Attack flows only, evaded', F.pct(recAfter, 1), F.f(psi(aEv), 4), (psi(aEv) / thr).toFixed(1) + '×']];
          U.clear(batchBox);
          batchBox.appendChild(h('div', { class: 'grid g4' },
            U.tile('Evasion rate (of flows C caught)', F.pct(ev.length / Math.max(detected.length, 1), 1), ev.length + ' / ' + detected.length + ' · Wilson CI [' + F.pct(wil[0], 1) + ', ' + F.pct(wil[1], 1) + ']', 'bad'),
            U.tile('Paper, same ε on IoT', batchEps <= 0.101 ? '84.5%' : batchEps >= 0.299 ? '100%' : '—', batchEps <= 0.101 ? 'CI [81.2, 87.3] · n = 548' : 'only ε = 0.10 and 0.30 were run'),
            U.tile('Monitor threshold (window ' + N + ')', F.f(thr, 4), 'calibrated on the demo sample'),
            U.tile('PSI, mixed window under attack', F.f(psi(sEv), 3), (psi(sEv) / thr).toFixed(1) + '× threshold', psi(sEv) > thr ? 'good' : 'bad')));
          batchBox.appendChild(U.table(rows2, { num: [1, 2, 3] }));
          batchBox.appendChild(U.callout('warn', 'info', h('div', null, h('b', null, 'Read the control rows. '), 'A window made only of attack flows already differs from the calm reference before any evasion (row 4 vs 1), simply because its mix of flows is different. The informative comparison is row 3 vs row 1: the same window, with only the attacker’s perturbation changed. The paper’s headline (PSI 1.3685, ≈110× threshold) is for 548 evaded flows against its own calibration; this demo recomputes the same idea on a smaller sample with its own thresholds, so the multiples differ.')));
          running = false;
        }
        chunk();
      }
      var bs = U.seg([{ value: 250, label: '250 flows' }, { value: 500, label: '500 flows' }], batchN, function (v) { batchN = v; }, 'Batch size');
      var be = U.seg([{ value: 0.10, label: 'ε = 0.10' }, { value: 0.30, label: 'ε = 0.30' }], batchEps, function (v) { batchEps = v; }, 'Batch budget');
      var bBtn = h('button', { class: 'btn primary', type: 'button', onclick: runBatch }, U.icon('sword', 15), 'Attack a whole window');

      root.appendChild(U.pageHeader('Live lab', 'Attack lab', 'Take a real attack flow that Model C catches, give an attacker a budget and a number of queries, and watch a gradient-free Square-style search try to talk the model out of it — then see what happens to the drift monitor when a whole window is attacked.'));
      fillTypes(); pick();
      root.appendChild(h('div', { class: 'lab' },
        h('aside', { class: 'card ctrl stick' }, h('div', { class: 'grp' }, h('h4', null, 'Target'), domSeg, typeSel, other),
          h('div', { class: 'grp' }, h('h4', null, 'Attacker'), epsS, qS, again),
          h('div', { class: 'small muted' }, 'The attacker sees only Model C’s output score (black-box). Success = P(attack) drops below 0.5.')),
        h('div', { class: 'col', style: { gap: '16px', 'min-width': 0 } }, resBox,
          U.card('Attack a whole window and watch the monitor', 'Draws a calm window from the deployed network, perturbs every attack flow in it, then compares model recall and PSI.', h('div', { class: 'col' }, h('div', { class: 'row' }, bs, be, bBtn), batchBox)),
          U.callout('warn', 'info', h('div', null, 'Paper scope: the attacks were run on IoT flows only. Enterprise targets here are exploratory. This is a JavaScript re-implementation of the Square-style search described in Section IV-E; ', U.xref('limits', 'see limits'), '.')))));
      more([]);
    }
  });

  /* ================= drift lab ================= */
  U.register('driftlab', {
    title: 'Drift monitor lab',
    render: function (root) {
      var st = { dom: 0, N: 250, scen: 'null', pAttack: 0.2, eps: 0.1, nWin: 24, res: null };
      var SC = [{ id: 'null', label: 'No change (null)' }, { id: 'mix', label: 'Different attack share' }, { id: 'burst', label: 'DoS / DDoS burst' }, { id: 'foreign', label: 'Foreign network' }, { id: 'evasion', label: 'Evasive attacker' }];
      var chartBox = h('div', { class: 'chart' }), statBox = h('div', { class: 'grid g4' }), anatBox = h('div', { class: 'col', style: { gap: '12px' } }), calBox = h('div', { class: 'col', style: { gap: '12px' } }), pb = h('div', { class: 'progress', style: { display: 'none' } }, h('i'));
      var chart = U.lineChart(chartBox, function () {
        var r = st.res, thr = Lab.monitor(st.dom, st.N).thr; if (!r) return { height: 260, x: { min: 1, max: st.nWin, label: 'window' }, y: { min: 0, max: thr * 3, label: 'PSI' }, series: [], hlines: [{ y: thr, label: 'threshold ' + F.f(thr, 4) }] };
        var pts = r.psi.map(function (v, i) { return [i + 1, v]; }), mx = Math.max.apply(null, r.psi.concat([thr * 2]));
        return { height: 260, x: { min: 1, max: st.nWin, label: 'window #', fmt: F.n }, y: { min: 0, max: mx * 1.12, label: 'PSI', fmt: F.sig }, series: [{ name: 'PSI', color: 'var(--s7)', pts: pts, dots: true, w: 1.6 }], hlines: [{ y: thr, label: 'threshold ' + F.f(thr, 4) }], aria: 'PSI per window' };
      });

      function windowRows(scen, seed) {
        var cfg = { dom: st.dom, scenario: scen === 'null' ? 'steady' : scen, seed: seed, pAttack: st.pAttack, eps: st.eps }; var s = Lab.makeStream(cfg), arr = [];
        for (var i = 0; i < st.N; i++) arr.push(s.next()); return arr;
      }
      function run() {
        pb.style.display = ''; var arr = [], k = 0, res = { psi: [], alarms: 0, last: null };
        statBox.style.opacity = 0.5;
        function chunk() {
          var t0 = performance.now();
          while (k < st.nWin && performance.now() - t0 < 30) {
            var fl = windowRows(st.scen, 500 + k * 13 + st.N), mon = Lab.monitor(st.dom, st.N);
            var shaps = fl.map(function (f) { return f.shap('C'); }), r = mon.mon.psi(shaps);
            res.psi.push(r.psi); if (r.psi > mon.thr) res.alarms++; res.last = { shaps: shaps, per: r.perFeature }; k++;
          }
          pb.firstChild.style.width = (100 * k / st.nWin) + '%';
          if (k < st.nWin) { setTimeout(chunk, 0); return; }
          pb.style.display = 'none'; statBox.style.opacity = 1; st.res = res; show();
        }
        chunk();
      }
      function show() {
        var r = st.res, mon = Lab.monitor(st.dom, st.N), thr = mon.thr, sorted = r.psi.slice().sort(function (a, b) { return a - b; }), med = sorted[sorted.length >> 1];
        var wil = E.wilson(r.alarms, r.psi.length);
        U.clear(statBox);
        statBox.appendChild(U.tile('Windows alarmed', r.alarms + ' / ' + r.psi.length, 'Wilson CI [' + F.pct(wil[0], 0) + ', ' + F.pct(wil[1], 0) + ']', st.scen === 'null' ? (r.alarms === 0 ? 'good' : 'bad') : (r.alarms === r.psi.length ? 'good' : '')));
        statBox.appendChild(U.tile('Median PSI', F.f(med, med < 0.1 ? 4 : 3), (med / thr).toFixed(1) + '× threshold'));
        statBox.appendChild(U.tile('PSI range', F.f(sorted[0], 3) + ' – ' + F.f(sorted[sorted.length - 1], 3), 'across ' + r.psi.length + ' windows'));
        statBox.appendChild(U.tile('Threshold', F.f(thr, 4), 'window ' + st.N + ' · ' + Lab.DOM[st.dom]));
        chart.redraw(); drawAnat();
      }
      var featSel = U.select('Feature to inspect', E.FEATURES.map(function (f, j) { return { value: j, label: Lab.LABELS[f] }; }), 7, function () { drawAnat(); });
      function drawAnat() {
        U.clear(anatBox); anatBox.appendChild(featSel); var r = st.res; if (!r || !r.last) { anatBox.appendChild(h('p', { class: 'muted small' }, 'Run the windows to see the bins of the last one.')); return; }
        var j = +featSel.sel.value, mon = Lab.monitor(st.dom, st.N), M = mon.mon, col = new Float64Array(r.last.shaps.length); r.last.shaps.forEach(function (s, i) { col[i] = s[j]; });
        var bp = M._hist(col, M.edges[j]), rp = M.refPct[j], nb = bp.length, cats = [], contrib = [];
        for (var b = 0; b < nb; b++) { cats.push(String(b + 1)); contrib.push((bp[b] - rp[b]) * Math.log(bp[b] / rp[b])); }
        var box = h('div', { class: 'chart' }); anatBox.appendChild(U.legend([{ label: 'Reference share', color: 'var(--s1)', sq: true }, { label: 'Last window share', color: 'var(--s2)', sq: true }])); anatBox.appendChild(box);
        U.barChart(box, function () { return { cats: cats, height: 230, y: { min: 0, label: 'share of flows', fmt: function (v) { return F.pct(v, 0); } }, aria: 'Reference vs window share per SHAP decile bin', series: [{ name: 'Reference', color: 'var(--s1)', vals: Array.from(rp), tip: Array.from(rp).map(function (v) { return F.pct(v, 1); }) }, { name: 'Last window', color: 'var(--s2)', vals: Array.from(bp), tip: Array.from(bp).map(function (v) { return F.pct(v, 1); }) }] }; });
        var tot = contrib.reduce(function (a, b) { return a + b; }, 0);
        anatBox.appendChild(h('p', { class: 'small', style: { color: 'var(--ink2)' } }, 'Bins are the deciles of this feature’s SHAP values in the reference batch, so the reference share is ≈ 10% per bin. This feature’s PSI in the last window is ', h('b', null, F.f(tot, 4)), ' = Σ (window% − ref%) · ln(window% / ref%) over its ' + nb + ' bins; the monitor averages this over all 15 features.'));
      }
      function calibrate() {
        U.clear(calBox); var N = st.N, dom = st.dom, pool = Lab.rows.filter(function (r) { return r.d === dom; }), rr = E.rng(31337 + N + dom), pick = function () { var a = []; for (var i = 0; i < N; i++) a.push(pool[Math.floor(rr() * pool.length)]); return a; };
        calBox.appendChild(h('div', { class: 'small muted' }, 'Computing…'));
        var ref = pick(); Lab.ensureShap(ref, null, function () {
          var M = new E.Monitor(ref.map(function (r) { return Lab.shapC(r); })), nulls = [];
          (function loop(k) { if (k < 20) { var w = pick(); Lab.ensureShap(w, null, function () { nulls.push(M.psi(w.map(function (r) { return Lab.shapC(r); })).psi); loop(k + 1); }); return; }
            var mean = nulls.reduce(function (a, b) { return a + b; }, 0) / 20, sd = Math.sqrt(nulls.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / 19), thr = mean + 4 * sd;
            U.clear(calBox); var box = h('div', { class: 'chart' });
            U.scatter(box, function () { return { height: 200, x: { min: 0.5, max: 20.5, label: 'null draw #', fmt: F.n, name: 'draw' }, y: { min: 0, max: thr * 1.25, label: 'PSI', fmt: F.sig, name: 'PSI' }, series: [{ name: 'Null draw', color: 'var(--s3)', pts: nulls.map(function (v, i) { return [i + 1, v]; }), r: 4.5 }] }; });
            calBox.appendChild(box);
            calBox.appendChild(h('p', { class: 'small', style: { color: 'var(--ink2)' } }, 'A fresh reference and 20 independent same-network windows of ' + N + ' flows: mean ', h('b', null, F.f(mean, 4)), ', σ ', h('b', null, F.f(sd, 4)), ' → threshold = mean + 4σ = ', h('b', null, F.f(thr, 4)), '. The stored threshold for this setting is ' + F.f(Lab.monitor(dom, N).thr, 4) + '; they differ because each draws its own random reference. That spread is the “calibrate on more null batches” caveat from the paper.'));
          })(0);
        });
      }

      var domSeg = U.seg([{ value: 0, label: 'Enterprise' }, { value: 1, label: 'IoT' }], st.dom, function (v) { st.dom = v; st.res = null; chart.redraw(); }, 'Network');
      var winSeg = U.seg(Lab.WIN.map(function (n) { return { value: n, label: String(n) }; }), st.N, function (v) { st.N = v; st.res = null; chart.redraw(); }, 'Window size');
      var scenSel = U.select('What changes in the windows?', SC.map(function (s) { return { value: s.id, label: s.label }; }), st.scen, function (v) { st.scen = v; mixBox.style.display = v === 'mix' ? '' : 'none'; epsBox.style.display = v === 'evasion' ? '' : 'none'; });
      var mixBox = h('div', { style: { display: 'none' } }, U.slider('Attack share in window', 0.02, 0.95, 0.01, st.pAttack, function (v) { st.pAttack = v; }, function (v) { return F.pct(v, 0); }));
      var epsBox = h('div', { style: { display: 'none' } }, U.slider('Attacker budget ε', 0.02, 0.30, 0.01, st.eps, function (v) { st.eps = v; }, function (v) { return v.toFixed(2); }));
      var nS = U.slider('Windows to run', 6, 60, 2, st.nWin, function (v) { st.nWin = v; }, function (v) { return String(v); });
      var go = h('button', { class: 'btn primary', type: 'button', onclick: run }, U.icon('play', 15), 'Run windows');
      var cal = h('button', { class: 'btn', type: 'button', onclick: calibrate }, U.icon('sliders', 15), 'Re-run the calibration');

      root.appendChild(U.pageHeader('Live lab', 'Drift monitor lab', 'Run batches of flows through the SHAP-attribution PSI monitor under different kinds of change, re-run the 20-null-draw calibration, and open up the bins behind a single feature’s PSI.'));
      root.appendChild(h('div', { class: 'lab' },
        h('aside', { class: 'card ctrl stick' }, h('div', { class: 'grp' }, h('h4', null, 'Deployed network'), domSeg), h('div', { class: 'grp' }, h('h4', null, 'Window size (flows)'), winSeg),
          h('div', { class: 'grp' }, h('h4', null, 'Scenario'), scenSel, mixBox, epsBox, nS, h('div', { class: 'row' }, go), pb), h('div', { class: 'grp' }, h('h4', null, 'Calibration'), cal)),
        h('div', { class: 'col', style: { gap: '16px', 'min-width': 0 } }, statBox,
          U.card('PSI per window vs. threshold', 'Each dot is one independent window of flows scored against the same reference. Hover for values.', chartBox),
          h('div', { class: 'grid g2' }, U.card('PSI anatomy for one feature', null, anatBox), U.card('Threshold calibration', 'The paper’s protocol on the demo sample.', calBox)),
          U.callout('warn', 'info', h('div', null, h('b', null, 'Try “Different attack share”. '), 'Shifting only the benign/attack mix, with nothing novel in it, can lift PSI above the threshold at the smaller window sizes. The paper did not test mix shifts, so read an alarm as “the attribution pattern changed”, not “a new attack appeared”.')))));
      statBox.appendChild(U.tile('Windows alarmed', '—', 'press “Run windows”'));
      calBox.appendChild(h('p', { class: 'muted small' }, 'Press “Re-run the calibration” to draw a fresh reference and 20 null windows for the chosen network and window size (takes a few seconds).'));
      drawAnat(); run();
    }
  });
})(window);
