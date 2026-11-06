/* Live traffic simulator + shared waterfall helper */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, E = W.EdgeEngine;

  /* SHAP waterfall (top contributors, signed). getFn() -> {phi, x, key} */
  W.Waterfall = function (box, getFn, topK) {
    return U.hbar(box, function () {
      var g = getFn(), rows = Lab.topShap(g.phi, topK || 7).map(function (r) {
        var lab = r.j >= 0 ? r.label + ' = ' + Lab.fmtRaw(r.j, Lab.rawOf(g.x)[r.j]) : r.label;
        return { label: lab, value: r.value, color: r.j < 0 ? 'var(--muted)' : null, tip: r.j >= 0 ? (r.value >= 0 ? 'pushes toward attack' : 'pushes toward benign') : null };
      });
      var mx = rows.reduce(function (a, r) { return Math.max(a, r.label.length); }, 0); return { rows: rows, signed: true, fmt: function (v) { return F.f(v, 2); }, labelW: Math.min(box.clientWidth * 0.52, Math.max(150, mx * 6.9 + 10)), rowH: 27, valueName: 'SHAP (log-odds)', axisFmt: function (v) { return F.f(v, 1); }, aria: 'SHAP attributions for this flow' };
    });
  };
  W.explainSummary = function (key, x, phi) {
    var m = Lab.models[key], marg = m.expected; for (var j = 0; j < phi.length; j++) marg += phi[j];
    var p = Lab.sigmoid(marg), base = Lab.sigmoid(m.expected);
    return { base: base, p: p, margin: marg };
  };

  var COLS = { c: 'var(--s3)' };

  function modelCell(k, p, y) {
    var flagged = p >= Lab.THR, ok = y < 0 ? null : (flagged === (y === 1));
    return h('td', { title: Lab.NAMES[k] + ': ' + F.f(p, 3) + (ok == null ? '' : ok ? ' — correct' : ' — wrong') },
      h('span', { class: 'pbar thr', style: { '--thr': '50%' } }, h('i', { style: { width: Math.max(2, p * 100) + '%', background: Lab.COLORS[k], opacity: ok === false ? 0.55 : 1 } })),
      h('span', { class: 'mono num', style: { color: ok === false ? 'var(--bad-ink)' : 'var(--ink)' } }, F.f(p, 2)), ok === false ? h('span', { class: 'xs', style: { color: 'var(--bad-ink)', 'margin-left': '4px', 'font-weight': 700 } }, '✗') : null);
  }

  U.register('simulator', {
    title: 'Live simulator',
    render: function (root) {
      var st = { dom: 1, N: 250, scen: 'steady', eps: 0.10, speed: 40, running: false, sel: null, selModel: 'C', pinned: false };
      var els = {};
      st.mon = Lab.monitor(st.dom, st.N); st.psiSeries = []; st.total = 0; st.feed = []; st.perFeature = null; st.psi = 0;

      function resetState(keepScen) {
        st.mon = Lab.monitor(st.dom, st.N); st.total = 0; st.feed = []; st.psiSeries = []; st.series = [];
        st.counts = { A: { tp: 0, fp: 0, tn: 0, fn: 0 }, B: { tp: 0, fp: 0, tn: 0, fn: 0 }, C: { tp: 0, fp: 0, tn: 0, fn: 0 } };
        st.truthAttacks = 0; st.truthKnown = 0; st.evadedN = 0; st.attemptedN = 0;
        st.ring = []; st.ringIdx = 0; st.alarmTicks = 0; st.changeAt = 0; st.firstAlarmAt = null; st.perFeature = null; st.psi = null; st.acc = 0; st.sel = null; st.pinned = false;
        var pre = Lab.makeStream({ dom: st.dom, scenario: 'steady', seed: 100 + st.N + st.dom });
        for (var i = 0; i < st.N; i++) st.ring.push(pre.next().shap('C'));
        st.stream = Lab.makeStream({ dom: st.dom, scenario: st.scen, eps: st.eps, seed: Math.floor(Math.random() * 1e6) });
        var r = st.mon.mon.psi(st.ring); st.psi = r.psi; st.perFeature = r.perFeature; st.psiSeries.push([0, r.psi]);
        draw();
      }
      function setScenario(id) {
        st.scen = id; st.stream = Lab.makeStream({ dom: st.dom, scenario: id, eps: st.eps, seed: Math.floor(Math.random() * 1e6) }); st.changeAt = st.total; st.firstAlarmAt = null; st.alarmTicks = 0;
        U.$$('.scen button', els.ctrl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === id)); });
        els.blurb.textContent = Lab.SCENARIOS.filter(function (s) { return s.id === id; })[0].blurb;
        els.epsBox.style.opacity = id === 'evasion' ? 1 : 0.45;
        if (id === 'custom' && !Lab.custom.length) els.blurb.textContent = 'No flows yet — paste or stream some on the “Connect live traffic” page, then come back.';
        draw();
      }

      function step(n) {
        for (var i = 0; i < n; i++) {
          var f = st.stream.next(); st.total++;
          if (f.y >= 0) {
            st.truthKnown++; if (f.y === 1) st.truthAttacks++;
            Lab.KEYS.forEach(function (k) { var c = st.counts[k], pr = f.p[k] >= Lab.THR; if (f.y === 1) { if (pr) c.tp++; else c.fn++; } else { if (pr) c.fp++; else c.tn++; } });
          }
          if (f.attempted) { st.attemptedN++; if (f.evaded) st.evadedN++; }
          st.ring[st.ringIdx] = f.shap('C'); st.ringIdx = (st.ringIdx + 1) % st.N;
          st.feed.unshift(f); if (st.feed.length > 14) st.feed.pop();
        }
        var r = st.mon.mon.psi(st.ring); st.psi = r.psi; st.perFeature = r.perFeature;
        st.psiSeries.push([st.total, r.psi]); if (st.psiSeries.length > 700) st.psiSeries.splice(1, 1);
        if (r.psi > st.mon.thr) { st.alarmTicks++; if (st.firstAlarmAt == null && st.total > st.changeAt) st.firstAlarmAt = st.total - st.changeAt; }
      }

      /* ---------- controls ---------- */
      var domSeg = U.seg([{ value: 0, label: 'Enterprise' }, { value: 1, label: 'IoT' }], st.dom, function (v) { st.dom = v; stop(); resetState(); }, 'Deployed network');
      var winSeg = U.seg(Lab.WIN.map(function (n) { return { value: n, label: String(n) }; }), st.N, function (v) { st.N = v; stop(); resetState(); }, 'Window size');
      var scen = h('div', { class: 'scen' }, Lab.SCENARIOS.map(function (s) {
        return h('button', { type: 'button', 'data-id': s.id, 'aria-pressed': String(s.id === st.scen), onclick: function () { setScenario(s.id); } }, s.label);
      }));
      els.blurb = h('div', { class: 'small muted' }, Lab.SCENARIOS[0].blurb);
      var epsS = U.slider('Attacker budget ε', 0.02, 0.30, 0.01, st.eps, function (v) { st.eps = v; if (st.scen === 'evasion') setScenario('evasion'); }, function (v) { return v.toFixed(2); });
      els.epsBox = h('div', { style: { opacity: 0.45 } }, epsS);
      var spS = U.slider('Speed', 5, 300, 5, st.speed, function (v) { st.speed = v; }, function (v) { return v + ' flows/s'; });
      var playBtn = h('button', { class: 'btn primary', type: 'button', onclick: function () { st.running ? stop() : start(); } });
      var resetBtn = h('button', { class: 'btn', type: 'button', onclick: function () { stop(); resetState(); } }, U.icon('reset', 15), 'Reset');
      function setPlay() { U.clear(playBtn); playBtn.appendChild(U.icon(st.running ? 'pause' : 'play', 15)); playBtn.appendChild(document.createTextNode(st.running ? 'Pause' : (st.total ? 'Resume' : 'Start stream'))); }
      els.thrNote = h('div', { class: 'small muted' });
      els.ctrl = h('aside', { class: 'card ctrl stick' },
        h('div', { class: 'grp' }, h('h4', null, 'Deployed network'), domSeg, h('div', { class: 'small muted' }, 'The monitor’s reference is calm traffic from this network.')),
        h('div', { class: 'grp' }, h('h4', null, 'Monitor window (flows)'), winSeg, els.thrNote),
        h('div', { class: 'grp' }, h('h4', null, 'Scenario'), scen, els.blurb, els.epsBox),
        h('div', { class: 'grp' }, h('h4', null, 'Playback'), spS, h('div', { class: 'row' }, playBtn, resetBtn)),
        h('div', { class: 'small muted' }, 'Labeled replay from a 6,070-flow demo sample — not live traffic. Truth is shown only because the flows are labeled.'));

      /* ---------- output areas ---------- */
      els.alarm = h('div', { class: 'alarm idle' });
      els.tiles = h('div', { class: 'grid g4' });
      els.psiBox = h('div', { class: 'chart' }); els.pfBox = h('div', { class: 'chart' }); els.wfBox = h('div', { class: 'chart' });
      els.models = h('div'); els.wfNote = h('p', { class: 'muted small' }, 'Start the stream, then click any row in the feed to see why each model scored it that way.'); els.feed = h('div', { class: 'feedwrap' }); els.exHead = h('div', { class: 'col', style: { gap: '6px' } });
      var hov = {};
      [els.psiBox, els.pfBox, els.wfBox].forEach(function (b, i) { b.addEventListener('pointerenter', function () { hov[i] = true; }); b.addEventListener('pointerleave', function () { hov[i] = false; }); });

      var psiChart = U.lineChart(els.psiBox, function () {
        var bands = [], start = null, thr = st.mon.thr;
        (st.psiSeries || []).forEach(function (p, i, arr) { if (p[1] > thr && start == null) start = p[0]; if ((p[1] <= thr || i === arr.length - 1) && start != null) { bands.push({ x0: start, x1: p[0], fill: 'var(--bad)', opacity: 0.12 }); start = null; } });
        var mx = Math.max.apply(null, st.psiSeries.map(function (p) { return p[1]; }).concat([thr * 1.6]));
        return { height: 250, x: { min: 0, max: Math.max(st.total, 50), label: 'flows seen', fmt: F.n }, y: { min: 0, max: mx * 1.12, label: 'PSI', fmt: F.sig },
          series: [{ name: 'PSI of last ' + st.N + ' flows', color: 'var(--s7)', pts: st.psiSeries, w: 2.2 }], hlines: [{ y: thr, label: 'alarm threshold ' + F.f(thr, 3), color: 'var(--ink2)' }], bands: bands, endLabels: true, aria: 'PSI over time against the alarm threshold' };
      });
      var pfChart = U.hbar(els.pfBox, function () {
        var pf = st.perFeature || new Float64Array(15), idx = Array.from(pf.keys()).sort(function (a, b) { return pf[b] - pf[a]; }).slice(0, 7);
        return { rows: idx.map(function (j) { return { label: Lab.LABELS[E.FEATURES[j]], value: pf[j], color: 'var(--s7)' }; }), fmt: function (v) { return F.sig(v); }, labelW: 150, rowH: 25, valueName: 'PSI contribution', aria: 'Top features driving the PSI' };
      });
      var wf = W.Waterfall(els.wfBox, function () { var f = curFlow(); var k = st.selModel; return { phi: f ? f.shap(k) : new Float64Array(15), x: f ? f.x : new Float32Array(15), key: k }; });

      function curFlow() { return st.sel || st.feed[0] || null; }

      /* ---------- drawing ---------- */
      function pct(v) { return isFinite(v) ? F.pct(v, 1) : '—'; }
      function draw() {
        var thr = st.mon.thr, over = st.psi > thr, warm = st.total === 0;
        els.thrNote.textContent = 'Threshold for this window: ' + F.f(thr, 4) + ' (mean + 4σ of 20 null draws: ' + F.f(st.mon.nullMean, 4) + ' ± ' + F.f(st.mon.nullStd, 4) + ').';
        els.alarm.className = 'alarm ' + (warm ? 'idle' : over ? 'fire' : 'ok'); U.clear(els.alarm);
        els.alarm.appendChild(U.icon(warm ? 'info' : over ? 'warn' : 'check', 20));
        var txt = warm ? 'Press “Start stream”. The window starts filled with calm ' + Lab.DOM[st.dom] + ' traffic, so PSI starts near the null level.'
          : over ? 'DRIFT ALARM — SHAP-attribution PSI is ' + (st.psi / thr).toFixed(1) + '× the threshold' + (st.firstAlarmAt != null ? ' (raised ' + F.n(st.firstAlarmAt) + ' flows after the scenario began).' : '.')
            : 'No drift — PSI ' + F.f(st.psi, 4) + ' is below the threshold ' + F.f(thr, 4) + '.';
        els.alarm.appendChild(h('span', null, txt));
        // tiles
        var C = st.counts.C, alerts = C.tp + C.fp, tr = st.truthKnown || 1;
        U.clear(els.tiles);
        els.tiles.appendChild(U.tile('Flows processed', F.n(st.total), st.truthKnown ? 'attack share so far ' + pct(st.truthAttacks / tr) : 'no ground truth in this feed'));
        els.tiles.appendChild(U.tile('Current PSI', F.f(st.psi, st.psi < 0.1 ? 4 : 3), (st.psi / thr).toFixed(1) + '× threshold', over && !warm ? 'bad' : ''));
        els.tiles.appendChild(U.tile('Model C alerts', F.n(alerts), st.truthKnown ? 'detection ' + pct(C.tp / Math.max(C.tp + C.fn, 1)) + ' · false alarms ' + pct(C.fp / Math.max(C.fp + C.tn, 1)) : 'unlabeled feed'));
        els.tiles.appendChild(U.tile('Evasions (attacker)', st.attemptedN ? F.n(st.evadedN) + ' / ' + F.n(st.attemptedN) : '—', st.attemptedN ? pct(st.evadedN / st.attemptedN) + ' of attack flows slipped past Model C' : 'turn on “Evasive attacker”'));
        // model table
        var rows = [['Model', 'Alerts', h('span', { title: 'Recall: share of attack flows caught' }, 'Recall'), h('span', { title: 'False-alarm rate: share of benign flows wrongly flagged' }, 'FPR'), 'Acc.']];
        Lab.KEYS.forEach(function (k) {
          var c = st.counts[k], n = c.tp + c.fp + c.tn + c.fn;
          rows.push([h('span', { class: 'bigmodel' }, h('span', { class: 'dotm', style: { background: Lab.COLORS[k] } }), Lab.SHORT[k]), F.n(c.tp + c.fp), n ? pct(c.tp / Math.max(c.tp + c.fn, 1)) : '—', n ? pct(c.fp / Math.max(c.fp + c.tn, 1)) : '—', n ? pct((c.tp + c.tn) / n) : '—']);
        });
        U.clear(els.models); els.models.appendChild(U.table(rows, { num: [1, 2, 3, 4] }));
        var cA = st.counts.A, nA = cA.tp + cA.fp + cA.tn + cA.fn;
        if (nA > 100 && st.dom === 1 && st.scen !== 'foreign') els.models.appendChild(h('p', { class: 'small muted', style: { 'margin-top': '8px' } }, 'Model A was trained only on Enterprise traffic. On IoT flows its ranking is inverted (paper: AUC 0.264) — the cross-domain failure, live.'));
        // feed
        U.clear(els.feed);
        var tb = h('tbody'); st.feed.forEach(function (f, i) {
          var sel = st.sel === f || (!st.sel && i === 0);
          var tr = h('tr', { class: (sel ? 'sel ' : '') + (i === 0 && st.running ? 'new' : '') },
            h('td', { class: 'num muted' }, '#' + f.id), h('td', null, h('span', { class: 'xs' }, Lab.DOM[f.d])),
            h('td', null, f.y < 0 ? U.pill('neutral', 'unlabeled') : f.y === 1 ? U.pill('attack', f.type.length > 22 ? f.type.slice(0, 21) + '…' : f.type) : U.pill('benign', 'benign'), f.attempted ? h('span', { class: 'chip', style: { 'margin-left': '6px' } }, f.evaded ? 'evaded C' : 'evasion failed') : null),
            modelCell('A', f.p.A, f.y), modelCell('B', f.p.B, f.y), modelCell('C', f.p.C, f.y));
          tr.addEventListener('click', function () { st.sel = f; st.pinned = true; draw(); }); tb.appendChild(tr);
        });
        els.feed.appendChild(h('table', { class: 'feed' }, h('thead', null, h('tr', null, ['Flow', 'Net', 'Truth', 'A', 'B', 'C'].map(function (t) { return h('th', null, t); }))), tb));
        if (!st.feed.length) els.feed.appendChild(h('div', { class: 'muted small', style: { padding: '14px' } }, 'No flows yet.'));
        // explain
        var f = curFlow(); U.clear(els.exHead); els.wfBox.style.display = f ? '' : 'none'; els.wfNote.style.display = f ? 'none' : '';
        if (f) {
          var phi = f.shap(st.selModel), ex = W.explainSummary(st.selModel, f.x, phi);
          els.exHead.appendChild(h('div', { class: 'row' }, h('b', null, 'Flow #' + f.id), f.y < 0 ? U.pill('neutral', 'unlabeled') : f.y === 1 ? U.pill('attack', 'truth: ' + f.type) : U.pill('benign', 'truth: benign'), st.pinned ? h('button', { class: 'btn sm', type: 'button', onclick: function () { st.sel = null; st.pinned = false; draw(); } }, 'Follow latest') : h('span', { class: 'chip' }, 'following latest')));
          els.exHead.appendChild(h('div', { class: 'small', style: { color: 'var(--ink2)' } }, Lab.NAMES[st.selModel] + ' says ', ex.p >= 0.5 ? h('b', { style: { color: 'var(--bad-ink)' } }, 'attack') : h('b', { style: { color: 'var(--good-ink)' } }, 'benign'), ' (p = ' + F.f(ex.p, 3) + '). Average output over the training data is p = ' + F.f(ex.base, 2) + '; red bars push toward attack, blue toward benign.'));
        }
        updateCharts(true);
      }
      function updateCharts(force) {
        if (force || !hov[0]) psiChart.redraw(); if (force || !hov[1]) pfChart.redraw(); if (force || !hov[2]) wf.redraw();
      }

      /* ---------- loop ---------- */
      var acc = 0, tmr = null, last = 0;
      function tick() {
        var now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
        acc += st.speed * dt; var n = Math.floor(acc); acc -= n;
        if (n > 0) { if (st.scen === 'custom' && !Lab.custom.length) { stop(); setScenario('custom'); return; } step(n); }
        draw();
      }
      function start() { if (st.running) return; if (st.scen === 'custom' && !Lab.custom.length) { location.hash = '#connect'; return; } st.running = true; last = performance.now(); tmr = setInterval(tick, 120); setPlay(); }
      function stop() { st.running = false; clearInterval(tmr); setPlay(); }
      U.onLeave(function () { clearInterval(tmr); });

      var exSeg = U.seg(Lab.KEYS.map(function (k) { return { value: k, label: 'Model ' + k }; }), st.selModel, function (v) { st.selModel = v; draw(); }, 'Model to explain');
      var scenAnchor = els.ctrl;
      root.appendChild(U.pageHeader('Live lab', 'Live traffic simulator', 'Stream labeled flows through all three paper models at once, with the SHAP-attribution PSI monitor watching the window. Change the scenario while it runs and see which models and which monitor notice.'));
      root.appendChild(h('div', { class: 'lab' }, els.ctrl,
        h('div', { class: 'col', style: { gap: '16px', 'min-width': 0 } },
          els.alarm, els.tiles,
          U.card('Drift monitor', 'PSI over Model C’s SHAP vectors for the most recent window; shaded spans are alarms.', els.psiBox),
          h('div', { class: 'grid g2a' }, U.card('Models vs. ground truth', 'Running totals since start. Recall = attacks caught; FPR = benign flows wrongly flagged. Truth is known only because the replay is labeled.', els.models), U.card('What is driving the PSI', 'Per-feature PSI of the current window (top 7 of 15).', els.pfBox)),
          U.card('Flow feed', 'Newest first. Bars show P(attack); the tick mark is the 0.5 decision threshold. Click a row to explain it.', els.feed),
          U.card('Why this verdict? (SHAP)', null, h('div', { class: 'col' }, h('div', { class: 'row' }, exSeg), els.exHead, els.wfNote, els.wfBox)))));
      resetState(); setPlay();
      if (Lab.pendingScenario) { setScenario(Lab.pendingScenario); Lab.pendingScenario = null; if (Lab.autoStart) { Lab.autoStart = false; start(); } }
      if (/^#?sim-/.test(location.hash)) { }
    }
  });
})(window);
