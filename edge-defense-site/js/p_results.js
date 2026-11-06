/* Result pages (1/2): cross-domain, mechanism, baselines */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, R = W.EDGE_RESULTS, SD = W.EDGE_SHAPDEP, E = W.EdgeEngine;
  var DCOL = ['var(--s7)', 'var(--s5)'];
  Lab.DCOL = DCOL;

  function secLink(tok, label) { return h('a', { class: 'xref', href: '#' + tok }, label); }
  function more(links) { return h('div', { class: 'row' }, links.map(function (l) { return h('a', { class: 'btn', href: '#' + l[0] }, U.icon(l[2] || 'arrow', 15), l[1]); })); }
  function chartBox(h2) { var d = h('div', { class: 'chart' }); if (h2) d.style.minHeight = h2 + 'px'; return d; }

  /* ================= cross-domain ================= */
  U.register('crossdomain', {
    title: 'Cross-domain failure',
    render: function (root) {
      var T = R.table1, by = {}; T.forEach(function (t) { by[t.id] = t; });
      root.appendChild(U.pageHeader('Results · Section V-A', 'A model trained on one network fails on the other — a pooled one does not',
        'Enterprise-only Model A scores AUC 0.264 on IoT traffic: not just weak, but inverted. Pooling both domains in one training run closes the gap with a small Enterprise-side cost.'));
      root.appendChild(h('section', { class: 'grid g5' },
        U.tile('A → IoT (zero-shot)', F.f(by.A_iot.auc, 4), '95% CI [0.2571, 0.2717] · F1 0.549', 'bad'),
        U.tile('B → Enterprise (zero-shot)', F.f(by.B_ent.auc, 4), '95% CI [0.5479, 0.5570] · F1 0.613', 'bad'),
        U.tile('C on Enterprise', F.f(by.C_ent.auc, 4), 'F1 0.9286 · pooled model', 'good'),
        U.tile('C on IoT', F.f(by.C_iot.auc, 4), 'F1 0.9849 vs 0.9541 for Model B', 'good'),
        U.tile('ΔAUC, C vs A on Enterprise', '0.0023', '95% CI [0.0019, 0.0027] · real but small')));

      var c1 = chartBox(300), c2 = chartBox(300);
      var cats = ['Enterprise test set', 'IoT test set'];
      var lab = { A: ['in-domain', 'zero-shot transfer'], B: ['zero-shot transfer', 'in-domain'], C: ['pooled', 'pooled'] };
      var vals = { A: [by.A_ent, by.A_iot], B: [by.B_ent, by.B_iot], C: [by.C_ent, by.C_iot] };
      function ser(metric) {
        return Lab.KEYS.map(function (k) {
          return { name: Lab.NAMES[k], color: Lab.COLORS[k], vals: vals[k].map(function (t) { return t[metric]; }), lo: vals[k].map(function (t) { return t[metric + 'Lo']; }), hi: vals[k].map(function (t) { return t[metric + 'Hi']; }),
            tip: vals[k].map(function (t, i) { return F.f(t[metric], 4) + '  [' + F.f(t[metric + 'Lo'], 4) + ', ' + F.f(t[metric + 'Hi'], 4) + ']'; }), note: lab[k] };
        });
      }
      U.barChart(c1, function () { return { cats: cats, series: ser('auc'), y: { min: 0, max: 1.05, label: 'AUC', fmt: function (v) { return F.f(v, 1); } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 3); }, hline: { y: 0.5, label: 'chance' }, aria: 'AUC by model and test domain' }; });
      U.barChart(c2, function () { return { cats: cats, series: ser('f1'), y: { min: 0, max: 1.05, label: 'F1', fmt: function (v) { return F.f(v, 1); } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 3); }, aria: 'F1 by model and test domain' }; });
      var lg = U.legend(Lab.KEYS.map(function (k) { return { label: Lab.NAMES[k], color: Lab.COLORS[k], sq: true }; }));
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('AUC with 95% bootstrap CI', 'Hover a bar for its interval and whether it is in-domain, zero-shot or pooled.', h('div', null, lg, c1)),
        U.card('F1 with 95% bootstrap CI', 'F1 hides the inversion that AUC exposes, because it depends on a threshold and on class balance.', h('div', null, U.legend(Lab.KEYS.map(function (k) { return { label: Lab.NAMES[k], color: Lab.COLORS[k], sq: true }; })), c2))));

      var rows = [['Model / condition', 'AUC (95% CI)', 'F1 (95% CI)']].concat(T.map(function (t) { return [t.label, F.f(t.auc, 4) + ' [' + F.f(t.aucLo, 4) + ', ' + F.f(t.aucHi, 4) + ']', F.f(t.f1, 4) + ' [' + F.f(t.f1Lo, 4) + ', ' + F.f(t.f1Hi, 4) + ']']; }));
      root.appendChild(U.card('Table I — cross-domain AUC / F1', 'Verbatim from the paper. Test sets hold 59k–72k rows, so every interval is tight.', U.table(rows, { num: [1, 2], rowClass: function (i) { return T[i].kind === 'x' ? 'sel' : ''; } })));

      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Why not just report Macro-F1?', null, h('div', { class: 'col' },
          h('p', null, 'Elangovan et al. report a gentler Macro-F1 degradation (0.69–0.78) under naive transfer. The paper recomputed Macro-F1 for the zero-shot models and found them just as severe: ', h('b', null, 'A → IoT 0.285'), ' and ', h('b', null, 'B → Enterprise 0.306'), '.'),
          h('p', { class: 'small muted' }, 'The paper attributes the difference to AUC being rank-based and threshold-free, so it is more sensitive to a sign-inverted decision rule than Macro-F1 is to preserved majority-class recall.'),
          h('p', { class: 'small' }, 'Read more: ', secLink('sec-V-A', 'Section V-A'), ' · ', secLink('sec-II', 'Literature survey')))),
        U.card('Does leakage explain it?', null, h('div', { class: 'col' },
          h('p', null, 'No. The IoT test/train exact-duplicate check finds ', h('b', null, '2.04%'), ' cross-partition leakage whether training is IoT-only or pooled. On the Enterprise side, ', h('b', null, '31.96%'), ' of test rows have an identical twin in training (a documented dataset trait), so the headline models were re-scored after removing all duplicate test rows: AUC moved by at most ', h('b', null, '0.0015'), ' and F1 by at most ', h('b', null, '0.0126'), '.'),
          h('p', { class: 'small' }, 'Read more: ', secLink('sec-III-B', 'Section III-B'))))));
      root.appendChild(more([['simulator', 'Watch it happen in the simulator', 'pulse'], ['mechanism', 'Why it happens: the sign flip', 'flip'], ['reproduce', 'Recompute AUCs in your browser', 'check']]));
    }
  });

  /* ================= mechanism ================= */
  U.register('mechanism', {
    title: 'Sign-flip mechanism',
    render: function (root) {
      var M = R.mech, ab = R.ablation;
      root.appendChild(U.pageHeader('Results · Section V-B', 'One feature changes meaning between networks',
        '“Long header → suspicious” is learned in one domain and becomes misleading in the other. SHAP and LIME agree on the flip, and retraining without the implicated features recovers a large part of the lost AUC.'));
      root.appendChild(h('section', { class: 'grid g4' },
        U.tile('Raw corr, header_len_total ↔ attack', '+0.061 / −0.235', 'Enterprise / IoT — the sign reverses'),
        U.tile('SHAP corr (A, B)', '+0.508 / −0.916', 'Enterprise model / IoT model'),
        U.tile('LIME corr (A, B)', '+0.591 / −0.511', 'independent method, same direction'),
        U.tile('Domain predictable from 2 features', 'AUC 1.0000', 'duration + header_len_total alone')));

      // SHAP dependence scatter
      var dep = SD.dependence, sc1 = h('div', { class: 'chart' }), sc2 = h('div', { class: 'chart' });
      function pts(key) { return dep[key]; }
      U.scatter(sc1, function () { return { height: 300, x: { label: 'header_len_total (log1p space)', fmt: function (v) { return F.f(v, 1); }, name: 'value' }, y: { label: 'SHAP value (log-odds)', fmt: function (v) { return F.f(v, 1); }, name: 'SHAP' },
        series: [{ name: 'Model A · Enterprise flows', color: Lab.COLORS.A, pts: pts('A_enterprise') }, { name: 'Model B · IoT flows', color: Lab.COLORS.B, pts: pts('B_iot') }] }; });
      U.scatter(sc2, function () { return { height: 300, x: { label: 'header_len_total (log1p space)', fmt: function (v) { return F.f(v, 1); }, name: 'value' }, y: { label: 'SHAP value (log-odds)', fmt: function (v) { return F.f(v, 1); }, name: 'SHAP' },
        series: [{ name: 'Model C · Enterprise flows', color: DCOL[0], pts: pts('C_enterprise') }, { name: 'Model C · IoT flows', color: DCOL[1], pts: pts('C_iot') }] }; });
      var cr = SD.corr;
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Domain-specific models: SHAP vs. feature value', 'Recomputed live from the trained trees on the demo sample (350 points per series). Recomputed correlation: A ' + F.f(cr.A_enterprise, 2) + ' (Enterprise), B ' + F.f(cr.B_iot, 2) + ' (IoT).',
          h('div', null, U.legend([{ label: 'Model A · Enterprise flows', color: Lab.COLORS.A, sq: true }, { label: 'Model B · IoT flows', color: Lab.COLORS.B, sq: true }]), sc1)),
        U.card('Pooled Model C on both domains', 'Same feature, same plot. Recomputed correlation on this sample: Enterprise ' + F.f(cr.C_enterprise, 2) + ', IoT ' + F.f(cr.C_iot, 2) + '.',
          h('div', null, U.legend([{ label: 'Model C · Enterprise flows', color: DCOL[0], sq: true }, { label: 'Model C · IoT flows', color: DCOL[1], sq: true }]), sc2))));
      root.appendChild(U.callout('warn', 'warn', h('div', null, h('b', null, 'Worth knowing. '), 'The paper reports that the pooled Model C shows no sign flip by either SHAP or LIME (Table II, on 500 test instances per domain). On this balanced demo sample Model C’s SHAP-vs-value correlation is ' + F.f(cr.C_enterprise, 2) + ' on Enterprise and ' + F.f(cr.C_iot, 2) + ' on IoT, so the two domains still differ in sign here, just much more weakly than the domain-specific models (' + F.f(cr.A_enterprise, 2) + ' vs ' + F.f(cr.B_iot, 2) + '). Different samples can move a correlation like this; the paper’s own protocol and sample are the reference, but it is a check worth repeating on the full test sets before relying on the “no flip” wording.')));

      // importance grouped bars
      var imp = SD.importance, order = Array.from(SD.features.keys()).sort(function (a, b) { return (imp.C_enterprise[b] + imp.C_iot[b]) - (imp.C_enterprise[a] + imp.C_iot[a]); });
      var c3 = h('div', { class: 'chart' });
      U.barChart(c3, function () {
        return { cats: order.map(function (j) { return Lab.LABELS[SD.features[j]]; }), catRot: true, height: 320, y: { label: 'mean |SHAP|', fmt: function (v) { return F.f(v, 1); } },
          series: [{ name: 'Enterprise', color: DCOL[0], vals: order.map(function (j) { return imp.C_enterprise[j]; }) }, { name: 'IoT', color: DCOL[1], vals: order.map(function (j) { return imp.C_iot[j]; }) }] };
      });
      root.appendChild(h('section', { class: 'grid g-side' },
        U.card('Model C feature importance by domain', 'Mean |SHAP| over the demo sample. Spearman ρ between the two importance rankings is ' + F.f(SD.spearman_C, 3) + ' here (paper: 0.900, p < 0.0001): the same few features matter in both domains.',
          h('div', null, U.legend([{ label: 'Enterprise', color: DCOL[0], sq: true }, { label: 'IoT', color: DCOL[1], sq: true }]), c3)),
        U.card('But a shared ranking is not a shared vocabulary', null, h('div', { class: 'col' },
          h('p', null, 'Duration and header_len_total alone predict which domain a flow came from with AUC 1.0000. The two datasets are extracted by different tools, and header_len_total (and byte_rate) mean different things in each.'),
          h('p', { class: 'small muted' }, 'Fig. 2 in the paper shows the same SHAP summary on the full 500-instance sets.'),
          h('a', { href: '#fig-2' }, 'View Fig. 2 →')))));

      // ablation
      var c4 = h('div', { class: 'chart' });
      U.barChart(c4, function () {
        return { cats: ['A → IoT (zero-shot)', 'B → Enterprise (zero-shot)', 'A in-domain', 'B in-domain'], height: 300, y: { min: 0, max: 1.05, label: 'AUC', fmt: function (v) { return F.f(v, 1); } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 3); }, hline: { y: 0.5, label: 'chance' },
          series: [{ name: 'All 15 features', color: 'var(--s1)', vals: [ab.A_iot[0], ab.B_ent[0], ab.A_in[0], ab.B_in[0]] }, { name: 'Without header_len_total & byte_rate (13 features)', color: 'var(--s3)', vals: [ab.A_iot[1], ab.B_ent[1], ab.A_in[1], ab.B_in[1]] }] };
      });
      root.appendChild(h('section', { class: 'grid g-side' },
        U.card('Causal test: retrain without the two mismatched features', 'Zero-shot AUC climbs (0.264 → 0.645, 0.553 → 0.621) while in-domain performance barely moves. A gap remains: the two features explain a large part, not all, of the failure.',
          h('div', null, U.legend([{ label: 'All 15 features', color: 'var(--s1)', sq: true }, { label: 'Without header_len_total & byte_rate', color: 'var(--s3)', sq: true }]), c4)),
        U.card('Table II — SHAP vs. LIME', 'Correlation of feature value with attribution. Both methods agree on the direction of the flip for the domain-specific models.', U.table([['Domain (model)', 'SHAP', 'LIME'], ['Enterprise (A)', '+0.508', '+0.591'], ['IoT (B)', '−0.916', '−0.511']], { num: [1, 2] }))));
      root.appendChild(more([['builder', 'Open the flow builder (sweep header length)', 'sliders'], ['paper', 'Read Section V-B', 'book']]));
    }
  });

  /* ================= baselines ================= */
  U.register('baselines', {
    title: 'Domain-adaptation baselines',
    render: function (root) {
      var C = R.coral, D = R.dann;
      root.appendChild(U.pageHeader('Results · Section V-C', 'Does a fancier domain-adaptation method earn its complexity?',
        'When labeled data exist in both domains, plain pooled training matches CORAL and beats a from-scratch DI-NIDS (DANN + one-class SVM) reimplementation by a wide margin on cross-domain AUC.'));
      root.appendChild(h('section', { class: 'grid g4' },
        U.tile('CORAL − C on Enterprise', '+0.0001', 'AUC · CI [−0.0004, +0.0005] · a genuine tie'),
        U.tile('CORAL − C on IoT', '−0.0039', 'AUC · CI [−0.0053, −0.0024] · small but real loss', 'bad'),
        U.tile('DANN + OSVM, Ent → IoT', '0.35 ± 0.13', 'cross-domain AUC, 5 seeds', 'bad'),
        U.tile('DANN + OSVM, IoT → Ent', '0.69 ± 0.04', 'cross-domain AUC, 5 seeds')));

      var c1 = h('div', { class: 'chart' }), c2 = h('div', { class: 'chart' });
      U.barChart(c1, function () {
        return { cats: ['Enterprise', 'IoT'], height: 280, y: { min: 0.9, max: 1.0, label: 'AUC', fmt: function (v) { return F.f(v, 2); } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 3); },
          series: [{ name: 'Model C (naive pooled)', color: Lab.COLORS.C, vals: [C.ent.naive[0], C.iot.naive[0]] }, { name: 'CORAL-aligned pooled', color: 'var(--s4)', vals: [C.ent.coral[0], C.iot.coral[0]] }] };
      });
      U.barChart(c2, function () {
        return { cats: D.map(function (d) { return d.dir; }), height: 280, y: { min: 0, max: 1.05, label: 'AUC', fmt: function (v) { return F.f(v, 1); } }, valueLabels: true, valueFmt: function (v) { return F.f(v, 2); }, hline: { y: 0.97, label: 'Model C ≈ 0.97' },
          series: [{ name: 'Source-domain AUC (in-domain ceiling)', color: 'var(--s1)', vals: D.map(function (d) { return d.srcAuc[0]; }), lo: D.map(function (d) { return d.srcAuc[0] - d.srcAuc[1]; }), hi: D.map(function (d) { return d.srcAuc[0] + d.srcAuc[1]; }), tip: D.map(function (d) { return d.srcAuc[0] + ' ± ' + d.srcAuc[1]; }) },
            { name: 'Cross-domain AUC (target, no labels)', color: 'var(--s7)', vals: D.map(function (d) { return d.cdAuc[0]; }), lo: D.map(function (d) { return d.cdAuc[0] - d.cdAuc[1]; }), hi: D.map(function (d) { return d.cdAuc[0] + d.cdAuc[1]; }), tip: D.map(function (d) { return d.cdAuc[0] + ' ± ' + d.cdAuc[1]; }) }] };
      });
      root.appendChild(h('section', { class: 'grid g2' },
        U.card('CORAL vs. naive pooling (Table III)', 'AUC; y-axis starts at 0.90 to make the near-tie visible. Table III is web-only (not in the 7-page PDF).', h('div', null, U.legend([{ label: 'Model C (naive pooled)', color: Lab.COLORS.C, sq: true }, { label: 'CORAL-aligned pooled', color: 'var(--s4)', sq: true }]), c1)),
        U.card('DANN + OSVM reimplementation (Table IV)', 'Error bars are the 5-seed standard deviation. It solves a harder problem — no target labels — so this is not a claim of algorithmic superiority.', h('div', null, U.legend([{ label: 'Source-domain AUC', color: 'var(--s1)', sq: true }, { label: 'Cross-domain AUC', color: 'var(--s7)', sq: true }]), c2))));

      root.appendChild(h('section', { class: 'grid g2' },
        U.card('Table III — CORAL vs. naive pooled (AUC / F1)', null, U.table([['Domain', 'Naive (C)', 'CORAL', 'CORAL − C, AUC'], ['Enterprise', '.979 / .929', '.979 / .928', '+0.0001 [−0.0004, +0.0005]'], ['IoT', '.971 / .985', '.967 / .983', '−0.0039 [−0.0053, −0.0024]']], { num: [1, 2, 3] })),
        U.card('Table IV — DANN + OSVM, 5-seed mean ± std', 'Src = the source domain’s own held-out set; CD = transfer to the unlabeled target.', U.table([['Direction', 'Src F1', 'Src AUC', 'CD F1', 'CD AUC']].concat(D.map(function (d) { return [d.dir, d.srcF1.join('±'), d.srcAuc.join('±'), d.cdF1.join('±'), d.cdAuc.join('±')]; })), { num: [1, 2, 3, 4] }))));
      root.appendChild(U.callout('good', 'check', h('div', null, h('b', null, 'Sanity check on the adversarial training. '), 'The domain classifier’s held-out source-vs-target accuracy is 0.52 ± 0.03 and 0.51 ± 0.04 — near the 50% chance level a genuinely domain-invariant embedding should give — so the DANN did converge rather than collapse. A less severe failure than Pawlicki et al.’s independent CORAL result (target-domain F1 down to 0.04).')));
      root.appendChild(more([['paper', 'Read Section V-C', 'book'], ['literature', 'Compare with other studies', 'list']]));
    }
  });
})(window);
