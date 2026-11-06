/* Result pages (2/2): evasion, drift, edge, literature, limits */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, R = W.EDGE_RESULTS, PP = W.EDGE_PAPER;
  function more(links) { return h('div', { class: 'row' }, links.map(function (l) { return h('a', { class: 'btn', href: '#' + l[0] }, U.icon(l[2] || 'arrow', 15), l[1]); })); }
  function secLink(tok, label) { return h('a', { class: 'xref', href: '#' + tok }, label); }
  function rc(n) { return h('a', { class: 'cite', href: '#refs-' + n }, '[' + n + ']'); }
  var refByN = {}; PP.refs.forEach(function (r) { refByN[r.n] = r; });
  function wireRef(a, n) { a.addEventListener('pointermove', function (ev) { U.Tip.show(ev, [h('div', { class: 't' }, '[' + n + ']'), h('div', null, refByN[n].text)]); }); a.addEventListener('pointerleave', U.Tip.hide); return a; }
  function rcl(n) { return wireRef(rc(n), n); }

  /* ================= evasion ================= */
  U.register('evasion', {
    title: 'Adversarial evasion',
    render: function (root) {
      var Ev = R.evasion;
      root.appendChild(U.pageHeader('Results · Section V-D', 'Gradient-based attacks understate how evadable the model is',
        'On 548 confirmed IoT attack flows, ZOO evades only 18.4% — but a gradient-free discrete random search evades 84.5% within a small budget and 100% within a moderate one. Yet the SHAP-drift monitor still fires on the evaded traffic.'));
      root.appendChild(h('section', { class: 'grid g5' },
        U.tile('ZOO (gradient-based)', '18.4%', '101 / 548 · Wilson CI [15.4, 21.9]'),
        U.tile('Square-style, ε ≤ 0.10', '84.5%', 'CI [81.2, 87.3]', 'bad'),
        U.tile('Square-style, ε ≤ 0.30', '100%', 'CI [99.3, 100]', 'bad'),
        U.tile('HopSkipJump, ε ≤ 0.10 / 0.30', '1.1% / 8.8%', '100% eventually, median L∞ = 0.77'),
        U.tile('PSI on 548 evaded flows', '1.3685', '≈ 110× the 0.0125 threshold', 'good')));

      var c1 = h('div', { class: 'chart' });
      var W_ = function (a) { return a.map(function (x) { return x == null ? null : 100 * x; }); };
      function s3(v) { return v ? [v[0], v[1], v[2]] : [null, null, null]; }
      U.barChart(c1, function () {
        var zoo = Ev.zoo.none, sq = Ev.square, hs = Ev.hsj;
        return { cats: ['ε ≤ 0.10', 'ε ≤ 0.30', 'No cap'], height: 320, y: { min: 0, max: 112, label: 'Evasion rate (%)', fmt: function (v) { return v > 100 ? '' : v + '%'; } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 1) + '%'; },
          series: [
            { name: 'ZOO (gradient estimation)', color: 'var(--s1)', vals: [null, null, 100 * zoo[0]], lo: [null, null, 100 * zoo[1]], hi: [null, null, 100 * zoo[2]], tip: [null, null, '18.4% [15.4, 21.9]'] },
            { name: 'Square-style (random search)', color: 'var(--s2)', vals: [84.5, 100, 100], lo: [81.2, 99.3, null], hi: [87.3, 100, null], tip: ['84.5% [81.2, 87.3]', '100% [99.3, 100]', '100%'] },
            { name: 'HopSkipJump (decision-based)', color: 'var(--s7)', vals: [1.1, 8.8, 100], lo: [0.5, 6.7, null], hi: [2.4, 11.4, null], tip: ['1.1% [0.5, 2.4]', '8.8% [6.7, 11.4]', '100% (median L∞ = 0.77)'] }] };
      });
      root.appendChild(h('section', { class: 'grid g-side' },
        U.card('Evasion rate by attack and budget (n = 548)', 'Whiskers are Wilson 95% intervals. ZOO was run without a budget cap; HSJ finds a route for every flow once distortion is unbounded.',
          h('div', null, U.legend([{ label: 'ZOO (gradient estimation)', color: 'var(--s1)', sq: true }, { label: 'Square-style (random search)', color: 'var(--s2)', sq: true }, { label: 'HopSkipJump (decision-based)', color: 'var(--s7)', sq: true }]), c1)),
        U.card('Fig. 3 from the paper', 'Evasion vs. perturbation budget, three attack families.', h('figure', { class: 'fig', style: { margin: 0 } }, h('img', { src: 'assets/fig3.png', alt: 'Evasion rate versus perturbation budget', loading: 'lazy' })))));

      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Why does the gradient attack fail?', null, h('div', { class: 'col' },
          h('p', null, 'Tree ensembles have piecewise-constant, non-differentiable decision surfaces, so gradient estimates carry little information ', rcl(13), '. Rajhans and Khawarey ', rcl(14), ' found the same pattern on a different model and dataset (Robustness Index 0.88–0.98 under ZOO vs 0.30–0.44 under a Square attack ', rcl(15), ').'),
          h('p', null, 'All 101 flows ZOO evades are also evaded by the Square-style attack at ε ≤ 0.30 — a strict subset. HopSkipJump relies on a similar kind of numerically-estimated local direction, which fits its weak small-budget numbers. Kazoom et al. ', rcl(37), ' (an unreviewed preprint) report that adding a SHAP-guided direction restores 95.8–100% success to a decision-based attack.'))),
        U.card('The monitor still sees it', null, h('div', { class: 'col' },
          h('p', null, 'Computing SHAP for all 548 Square-style-evaded flows and comparing against the calibrated threshold gives ', h('b', null, 'PSI = 1.3685'), ' — about ', h('b', null, '110×'), ' the 0.0125 threshold.'),
          h('p', null, 'Avoiding the classifier’s decision boundary and keeping the SHAP-attribution distribution intact turn out to be decoupled events at the batch level. This is a batch-level signal: it says “traffic changed”, not which flow is evasive.'),
          h('p', { class: 'small muted' }, 'Scope: the paper attacks the classifier, not the explanation. Slack et al. ', rcl(10), ' show explanations can themselves be manipulated by an attacker who targets them.')))));
      root.appendChild(U.card('Table V — evasion rate by attack method (n = 548)', 'Web-only table (not in the 7-page PDF).', U.table([['Attack', 'Method', 'ε ≤ 0.10', 'ε ≤ 0.30', 'No cap'], ['ZOO', 'gradient-based', '—', '—', '18.4% [15.4, 21.9]'], ['Square-style', 'discrete random search', '84.5% [81.2, 87.3]', '100% [99.3, 100]', '100%'], ['HSJ', 'boundary + gradient-direction', '1.1% [0.5, 2.4]', '8.8% [6.7, 11.4]', '100% (median L∞ = 0.77)']], { num: [2, 3, 4] })));
      root.appendChild(U.callout('warn', 'info', h('div', null, h('b', null, 'Scope of the paper’s attack results. '), 'All three attacks were run on IoT flows only; perturbations are bounded per feature and not made physically consistent (Section IV-E). The attack lab on this site lets you try the Square-style search on Enterprise flows too, but that is exploratory — it is not something the paper tested.')));
      root.appendChild(more([['attacklab', 'Run the attack yourself', 'sword'], ['driftlab', 'See the monitor react', 'eye'], ['reproduce', 'Recompute the evasion rate here', 'check']]));
    }
  });

  /* ================= drift ================= */
  function rangeChart(box, rows, thr) {
    return U.mkChart(box, function (Wd) {
      var rh = 44, m = { l: Math.min(230, Wd * 0.34), r: 24, t: 8, b: 32 }, Hh = m.t + m.b + rows.length * rh, iw = Wd - m.l - m.r, lo = Math.log10(0.002), hi = Math.log10(6);
      var X = function (v) { return m.l + (Math.log10(v) - lo) / (hi - lo) * iw; };
      var sv = U.s('svg', { viewBox: '0 0 ' + Wd + ' ' + Hh, width: Wd, height: Hh, role: 'img', 'aria-label': 'PSI ranges by condition on a log axis' });
      [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3].forEach(function (t) {
        sv.appendChild(U.s('line', { x1: X(t), x2: X(t), y1: m.t, y2: Hh - m.b, stroke: 'var(--grid)' }));
        sv.appendChild(U.s('text', { x: X(t), y: Hh - 10, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'var(--muted)', text: String(t) }));
      });
      rows.forEach(function (r, i) {
        var y = m.t + i * rh + rh / 2, x0 = X(r.lo), x1 = X(Math.max(r.hi, r.lo * 1.0001));
        sv.appendChild(U.s('text', { x: m.l - 10, y: y + 4, 'text-anchor': 'end', 'font-size': 12.5, fill: 'var(--ink2)', text: r.cond }));
        var bar = U.s('rect', { x: x0, y: y - 8, width: Math.max(x1 - x0, 9), height: 16, rx: 4, fill: r.color }); bar.style.cursor = 'default';
        bar.addEventListener('pointermove', function (ev) { U.Tip.show(ev, U.tipBox(r.cond, [{ color: r.color, label: 'PSI', value: r.lo === r.hi ? r.lo.toFixed(4) : r.lo.toFixed(4) + ' – ' + r.hi.toFixed(4) }, { label: 'vs threshold', value: (r.lo / thr).toFixed(1) + '×' + (r.lo === r.hi ? '' : ' – ' + (r.hi / thr).toFixed(0) + '×') }])); });
        bar.addEventListener('pointerleave', U.Tip.hide); sv.appendChild(bar);
      });
      sv.appendChild(U.s('line', { x1: X(thr), x2: X(thr), y1: m.t, y2: Hh - m.b, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
      sv.appendChild(U.s('text', { x: X(thr) + 5, y: m.t + 11, 'font-size': 11.5, fill: 'var(--ink2)', text: 'threshold 0.0125' }));
      return sv;
    });
  }
  U.register('drift', {
    title: 'SHAP drift monitor',
    render: function (root) {
      var D = R.drift, box = h('div', { class: 'chart' });
      root.appendChild(U.pageHeader('Results · Sections IV-F and V-E', 'A drift monitor built from explanations you already compute',
        'Population Stability Index over Model C’s signed SHAP vectors, one threshold, one monitor: quiet on same-domain batches, loud on novel attack types, loudest on a domain change.'));
      root.appendChild(h('section', { class: 'grid g4' },
        U.tile('Threshold', '0.0125', 'fixed from 20 same-domain null draws, before any shift'),
        U.tile('Null batches', '0.0060 – 0.0119', '0 / 6 alarms · CI [0%, 39%]', 'good'),
        U.tile('Novel attack types', '0.40 – 0.48', '4 / 4 detected · CI [51%, 100%]'),
        U.tile('Enterprise → IoT shift', '2.24 – 2.30', '4 / 4 detected · CI [51%, 100%]')));
      var rows = [
        { cond: 'Null (same-domain)', lo: 0.0060, hi: 0.0119, color: 'var(--s3)' },
        { cond: 'Novel attack types', lo: 0.4040, hi: 0.4805, color: 'var(--s2)' },
        { cond: 'Evaded traffic (Square-style, 548 flows)', lo: 1.3685, hi: 1.3685, color: 'var(--s8)' },
        { cond: 'Domain shift (Enterprise → IoT)', lo: 2.2435, hi: 2.3030, color: 'var(--s7)' }];
      rangeChart(box, rows, D.threshold);
      root.appendChild(U.card('PSI by condition (log scale)', 'A clean severity ladder: null ≪ novel attack ≪ evaded ≪ domain shift. Hover a bar for the multiple of the threshold.', box));
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('How the monitor is built', null, h('ol', { class: 'steps' },
          h('li', null, 'Take a fixed ', h('b', null, 'reference batch'), ' and compute Model C’s SHAP vector for each flow (15 values).'),
          h('li', null, 'For each of the 15 features, the ', h('b', null, '10 deciles'), ' of that feature’s SHAP values define 10 bins.'),
          h('li', null, 'Bin a new batch with the same edges and compute ', h('code', null, 'PSI = Σ (batch% − ref%) · ln(batch% / ref%)'), ' per feature, on signed SHAP values.'),
          h('li', null, 'The score is the ', h('b', null, 'unweighted mean of the 15 PSIs'), '.'),
          h('li', null, 'The alarm threshold comes only from ', h('b', null, '20 same-domain null draws'), ' (set before any shift was evaluated): the paper reports 0.0125.'))),
        U.card('What it is — and is not', null, h('div', { class: 'col' },
          h('p', null, 'It is a ', h('b', null, 'batch-level'), ' distribution check on explanations: it tells you that the attribution pattern changed, not which flow is malicious.'),
          h('p', null, 'The paper calls the validation an encouraging pilot because the Wilson intervals are wide with only 4 shift batches and 6 null batches, and recommends re-calibrating on a larger pool of null batches.'),
          h('p', { class: 'small muted' }, 'To our knowledge — the authors’ claim — no prior work applies PSI to SHAP vectors from a NIDS classifier and reuses one monitor for novel-attack and cross-domain detection ', rcl(9), '. Barrett et al. ', rcl(12), ' propose a complementary conformal drift estimator for streaming detection.')))));
      root.appendChild(U.card('Table VI — drift monitor validation', null, U.table([['Condition', 'PSI range', 'Alarm?']].concat(D.rows.map(function (r) { return [r.cond, r.lo.toFixed(4) + '–' + r.hi.toFixed(4), r.alarm + ' ' + r.ci]; })))));
      root.appendChild(U.callout('warn', 'info', h('div', null, h('b', null, 'Window size matters. '), 'PSI under no shift shrinks roughly as 1/N, so a threshold only makes sense together with the batch size it was calibrated for. The lab tools here recalibrate the same way (mean + 4σ of 20 null draws) for windows of 250, 500 and 1000 flows on the demo sample, so their thresholds differ from the paper’s 0.0125.')));
      root.appendChild(more([['driftlab', 'Open the drift lab', 'eye'], ['simulator', 'Watch PSI in the live simulator', 'pulse'], ['paper', 'Read Section IV-F', 'book']]));
    }
  });

  /* ================= edge ================= */
  U.register('edge', {
    title: 'Edge deployment',
    render: function (root) {
      var L = R.latency, c1 = h('div', { class: 'chart' }), c2 = h('div', { class: 'chart' });
      root.appendChild(U.pageHeader('Results · Sections IV-G and V-F', 'Cheap enough for a Raspberry-Pi-class budget',
        'The full pipeline — classify, explain, monitor — was benchmarked under a 1-core, 1 GB cgroup profile approximating a Pi 4. Explanations add real cost, but memory stays flat at about a third of the cap.'));
      root.appendChild(h('section', { class: 'grid g4' },
        U.tile('Predict-only (mean)', '4.31 ms', 'p50 2.01 ms'),
        U.tile('+ SHAP (mean)', '10.29 ms', '2.4× predict-only · p50 4.90 ms'),
        U.tile('+ SHAP + drift (mean)', '17.49 ms', '4.1× predict-only · p50 10.44 ms'),
        U.tile('Peak memory', '321–323 MB', 'of the 1 GB cap — flat across tiers')));
      U.barChart(c1, function () {
        return { cats: L.map(function (t) { return t.tier; }), height: 310, y: { label: 'latency (ms)', fmt: function (v) { return v; } }, valueLabels: true, valueFmt: function (v) { return F.ms(v); },
          series: [{ name: 'mean', color: 'var(--s1)', vals: L.map(function (t) { return t.mean; }) }, { name: 'p50', color: 'var(--s3)', vals: L.map(function (t) { return t.p50; }) },
            { name: 'p95 *', color: 'var(--s4)', vals: L.map(function (t) { return t.p95; }), note: L.map(function () { return 'Starred: CPU-quota throttling artifact, confirmed by an unconstrained control run'; }) },
            { name: 'p99 *', color: 'var(--s8)', vals: L.map(function (t) { return t.p99; }), note: L.map(function () { return 'Starred: CPU-quota throttling artifact, confirmed by an unconstrained control run'; }) }] };
      });
      root.appendChild(U.card('Per-tier latency (Table VII)', 'Means and medians are the reliable quantities. The starred p95/p99 bars come from cgroup CPU-quota scheduling throttles, confirmed by an unconstrained control run.',
        h('div', null, U.legend([{ label: 'mean', color: 'var(--s1)', sq: true }, { label: 'p50', color: 'var(--s3)', sq: true }, { label: 'p95 * (throttle artifact)', color: 'var(--s4)', sq: true }, { label: 'p99 * (throttle artifact)', color: 'var(--s8)', sq: true }]), c1)));
      var cmp = R.edgeCompare;
      U.hbar(c2, function () { return { rows: cmp.map(function (c) { return { label: c.who.replace(/ \(.*/, ''), value: c.ms, color: c.ref ? 'var(--s2)' : 'var(--s1)', tip: c.hw }; }), max: 55, fmt: function (v) { return F.ms(v) + ' ms'; }, labelW: 150, rowH: 34, valueName: 'latency' }; });
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Against other studies', 'An order-of-magnitude anchor, not a controlled benchmark — no two studies share dataset, hardware or pipeline.', c2),
        U.card('Table VII — per-tier latency (ms)', null, U.table([['Tier', 'mean', 'p50', 'p95', 'p99']].concat(L.map(function (t) { return [t.tier, t.mean.toFixed(2), t.p50.toFixed(2), t.p95.toFixed(2) + '*', t.p99.toFixed(2) + '*']; })), { num: [1, 2, 3, 4] }))));
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Reading the comparison', null, h('div', { class: 'col' },
          h('p', null, 'The 4.31 ms cgroup-proxy mean is lower than Diab et al.’s real Pi 3B+ figure (22 ms ', rcl(34), ') and Wijethilaka et al.’s real Pi 4 figure (≈ 50 ms ', rcl(35), '), and higher than Haruna et al.’s Docker figure (0.41 ms, no percentiles reported ', rcl(38), ').'),
          h('p', { class: 'small muted' }, 'A cgroup quota limits CPU time, not microarchitecture; physical Raspberry Pi validation is listed as future work.'))),
        U.card('Measure it on your own device', null, h('div', { class: 'col' },
          h('p', null, 'The benchmark page times the same three tiers — predict, +SHAP, +SHAP+drift — using the real models in your browser’s JavaScript engine.'),
          h('p', { class: 'small muted' }, 'Those numbers are JS on your machine, so compare ratios between tiers, not absolute milliseconds against the paper.'),
          h('a', { class: 'btn primary', href: '#bench', style: { 'align-self': 'flex-start' } }, U.icon('timer', 15), 'Run the benchmark')))));
    }
  });

  /* ================= literature ================= */
  var LIT = [
    { theme: 'Cross-domain generalisation', rows: [
      [5, 'Elangovan et al. (same two datasets)', 'Milder Macro-F1 degradation (0.69–0.78) under naive transfer.', 'AUC 0.264; Macro-F1 recomputed at 0.285 / 0.306 — equally severe.'],
      [6, 'Cantone et al.', 'Large cross-dataset MCC collapse, diagnosed by ad hoc data visualisation.', 'A mechanism tested causally by retraining without the implicated features.'],
      [3, 'Layeghy & Portmann', 'Same collapse pattern, traced to SHAP-identified feature shifts.', 'Independent confirmation with LIME plus the causal retraining test.'],
      [36, 'Pawlicki et al.', 'Near-total collapse under five domain-adaptation methods (CORAL target F1 → 0.04).', 'CORAL ties naive pooling on Enterprise and loses 0.0039 AUC on IoT — milder.'],
      [20, 'Mahbub et al.', 'CORAL underperforms a proposed alternative for cross-domain IoT/IoMT NIDS.', 'Corroborates the negative CORAL result.']] },
    { theme: 'Adversarial robustness of tree ensembles', rows: [
      [13, 'Kantchelian et al.', 'Tree ensembles are piecewise-constant; gradient attacks fail structurally.', 'ZOO evades 18.4% vs 84–100% for gradient-free search.'],
      [14, 'Rajhans & Khawarey', 'Robustness Index 0.88–0.98 under ZOO vs 0.30–0.44 under Square Attack on the same models.', 'Same qualitative pattern replicated on a different model and dataset.'],
      [16, 'Chen et al. (HopSkipJump)', 'Decision-based attack that needs only hard labels.', 'Evaluated as a third family: 1.1% / 8.8% at small budgets, 100% unbounded.'],
      [37, 'Kazoom et al. (preprint)', 'SHAP-guided direction restores 95.8–100% success to a decision-based attack.', 'Suggests the weakness is in the undirected search; not tested here.'],
      [7, 'Vitorino et al.', 'Percentile-bounded perturbations for realistic network-intrusion adversarial examples.', 'The principle behind the ε-budget bounding used here.']] },
    { theme: 'Explainability and drift', rows: [
      [8, 'Nugraha et al.', 'Template for SHAP-based NIDS explainability (F1 ≥ 99% on three datasets).', 'SHAP reused for both mechanism analysis and the drift monitor.'],
      [9, 'Tziouvaras et al.', 'PSI as a distribution-monitoring statistic in a wireless setting.', 'PSI applied to SHAP vectors; one monitor for novel-attack and domain-shift detection (authors’ claim of novelty).'],
      [10, 'Slack et al.', 'SHAP and LIME can be adversarially manipulated.', 'The result holds against attackers targeting the decision, not the explanation.'],
      [12, 'Barrett et al.', 'Conformal-prediction adaptive drift estimator for streaming detection.', 'Complementary; the monitor here is batch-level.']] },
    { theme: 'Edge deployment and data quality', rows: [
      [34, 'Diab et al.', '22 ms on a real Raspberry Pi 3B+.', '4.31 ms mean predict-only on a cgroup-constrained profile.'],
      [35, 'Wijethilaka et al.', '≈ 50 ms on a real Raspberry Pi 4.', 'See above — order-of-magnitude anchor only.'],
      [38, 'Haruna et al.', '0.41 ms in Docker, no percentiles.', 'Reports mean, p50, p95, p99 and peak memory.'],
      [26, 'Tolay', '54.82% internal duplication in the full raw CICIoT2023 release.', 'Recomputed from scratch on the full release: 54.99%.'],
      [24, 'Engelen et al.', 'Data-quality issues in CICIDS2017.', 'Duplicate/leakage checks reported in Section III-B.'],
      [25, 'Sarhan et al.', 'Standard feature-set methodology.', 'Basis of the 15-feature canonical schema.']] }
  ];
  U.register('literature', {
    title: 'Literature',
    render: function (root) {
      root.appendChild(U.pageHeader('Results · Sections II and V-G', 'Where this work sits relative to prior studies',
        'Each row pairs a published finding with what this paper reports. Hover a reference number for the full citation; click it for the reference list.'));
      LIT.forEach(function (g) {
        var rows = [['Ref', 'Study', 'Their finding', 'This work']].concat(g.rows.map(function (r) { return [null, r[1], r[2], r[3]]; }));
        var t = U.table(rows.map(function (r, i) { return i === 0 ? r : [r[0] == null ? '' : '', r[1], r[2], r[3]]; }));
        U.$$('tbody tr', t).forEach(function (tr, i) { var td = tr.firstChild; td.appendChild(rcl(g.rows[i][0])); });
        U.$$('td', t).forEach(function (td) { td.style.whiteSpace = 'normal'; td.style.minWidth = '160px'; });
        root.appendChild(U.card(g.theme, null, t));
      });
      root.appendChild(U.callout('info', 'info', h('div', null, h('b', null, 'Reading Fig. 4. '), 'Fig. 4(a) compares degradation severity across studies using different metrics (AUC vs Macro-F1 vs target F1), so the bars are not on a common scale; the error bars for Elangovan et al. and Pawlicki et al. show the midpoint and half-width of each paper’s own reported range, not a confidence interval. ', h('a', { href: '#fig-4' }, 'Open Fig. 4 →'))));
    }
  });

  /* ================= limits ================= */
  U.register('limits', {
    title: 'Limits & honesty',
    render: function (root) {
      root.appendChild(U.pageHeader('Scope', 'What the paper does not claim — and what this site is not',
        'Two sets of caveats: the limitations the paper states itself, and the ones that come with turning a paper into an interactive demo.'));
      var L = R.limits;
      root.appendChild(U.card('Limitations stated in the paper', null, h('div', { class: 'col', style: { gap: '14px' } }, L.map(function (l) {
        return h('div', null, h('div', { style: { 'font-weight': 700 } }, l[0], ' ', h('a', { class: 'chip', href: '#sec-' + l[2] }, '§' + l[2])), h('div', { class: 'small', style: { color: 'var(--ink2)' } }, l[1]));
      }))));
      var demo = [
        ['The sample is a replay, not live traffic.', 'The lab uses 6,070 flows (about 1,500 benign and 1,500 attack per domain) drawn with replacement from the two datasets. They are labeled, which is the only reason accuracy can be shown, and some rows may have been in the models’ training data — so AUCs recomputed here can be optimistic versus the paper’s held-out test sets.'],
        ['Drift thresholds are recalibrated per window size.', 'PSI under no shift scales roughly as 1/N. The simulator therefore uses a threshold calibrated the paper’s way (mean + 4σ of 20 null draws) for each window of 250 / 500 / 1000 flows on the demo sample. These are not the paper’s 0.0125.'],
        ['A change in attack share also moves PSI.', 'The “Quiet hours” and “Burst” scenarios change only the benign/attack mix, with nothing novel in it, and the monitor can still react. The paper’s validation did not test mix shifts, so treat the monitor as a distribution-change flag, not an attack classifier.'],
        ['Enterprise-side evasion is exploratory.', 'The paper attacked IoT flows only. The attack lab allows Enterprise flows because the code is the same, but no paper claim covers them.'],
        ['The attack is a JavaScript re-implementation.', 'It is a Square-style discrete random search against Model C inside an L∞ budget on clipped ranges, as described in Section IV-E, not the paper’s exact in-house code; rates differ slightly.'],
        ['In-browser latency is not Raspberry Pi latency.', 'The benchmark runs JavaScript on your device. Only the ratios between tiers are comparable with Table VII.'],
        ['Real packet capture needs a different extractor.', 'A packet agent would reconstruct CICFlowMeter-style features itself. The paper notes the two source datasets already disagree on what some features mean, so a third extractor is a fresh domain-shift risk until validated.']
      ];
      root.appendChild(U.card('Caveats of this demo site', null, h('div', { class: 'col', style: { gap: '14px' } }, demo.map(function (l) {
        return h('div', null, h('div', { style: { 'font-weight': 700 } }, l[0]), h('div', { class: 'small', style: { color: 'var(--ink2)' } }, l[1]));
      }))));
      root.appendChild(U.card('Future work named in the paper', null, h('ul', { class: 'bul' }, R.future.map(function (f) { return h('li', null, f); }))));
    }
  });
})(window);
