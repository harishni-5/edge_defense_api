/* Roadmap / backend answer page */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h;
  var yes = function (t) { return U.pill('benign', t || 'Yes', 'check'); }, no = function (t) { return U.pill('neutral', t || 'No'); }, need = function (t) { return U.pill('warn', t || 'Server', 'warn'); };

  var MATRIX = [
    ['Read the paper, figures and tables', yes('Browser'), '—', 'Built'],
    ['Run Models A, B and C on any flow', yes('Browser'), '—', 'Built · Simulator, Flow builder'],
    ['SHAP explanations (exact TreeSHAP)', yes('Browser'), '—', 'Built · validated to ~1e-6 vs Python'],
    ['SHAP-attribution drift monitor', yes('Browser'), '—', 'Built · Simulator, Drift lab'],
    ['Simulated traffic, attack and drift scenarios', yes('Browser'), '—', 'Built'],
    ['Score a CSV of flows', yes('Browser, ≲ 20k rows'), need('Very large files'), 'Built · Batch scoring'],
    ['Latency benchmark on your device', yes('Browser'), '—', 'Built'],
    ['Capture real packets from a network', no('Browsers cannot sniff'), need('Agent + API'), 'Scaffolded · agent/ and server/'],
    ['Keep history, audit logs, alert history', no('Per-browser only'), need('Database'), 'Already in your edge-defense-api (Supabase)'],
    ['Sign-in, roles, per-team data', no(), need('Auth provider'), 'Already in your stack (Clerk)'],
    ['Push alerts to email / Slack / webhooks', no(), need('Server'), 'Roadmap'],
    ['Scheduled threshold re-calibration / retraining', no(), need('Job runner'), 'Roadmap'],
    ['Physical Raspberry Pi benchmark', no(), need('Device'), 'Paper’s own future work']
  ];

  var ROAD = [
    ['In this site', 'benign', [
      'Live traffic simulator with 6 scenarios and a running PSI monitor',
      'Per-flow SHAP waterfalls for all three models',
      'Attack lab: single-flow and whole-window Square-style evasion',
      'Drift lab: window runs, threshold calibration, per-feature PSI bins',
      'Flow builder with what-if sweeps across 15 features',
      'CSV batch scoring with labels, AUC/F1 and drift check',
      'In-browser latency benchmark for the three pipeline tiers',
      'Paste / stream your own flows into the simulator',
      'Paper reader with search, hover citations, reference index, dark mode',
      'Reproduce page: recompute headline numbers and flag differences']],
    ['Scaffolded (needs a server)', 'warn', [
      'FastAPI Edge API: /api/predict, /api/predict-batch, /api/drift, /api/attack, /api/ingest, /api/stream',
      'scapy packet agent with a flow table, plus offline --pcap replay',
      'Server-sent events from agent → API → browser']],
    ['Worth building next', 'info', [
      'Ensemble view: A + B + C voting and disagreement as an extra alarm',
      'Per-feature PSI heatmap over time, to see which attributions drift first',
      'Rolling baseline: re-calibrate the reference from recent calm traffic',
      'Alert policies: thresholds, cool-downs, webhook / Slack / email',
      'Counterfactual explainer: smallest change that flips a verdict',
      'Adversarial-training toggle: retrain with evaded flows and re-test',
      'Physically consistent attack mode (pkt_len_min ≤ pkt_len_max, bytes vs rate)',
      'SHAP-guided attack against the monitor itself (the paper’s open question)',
      'Enterprise-domain evasion study with confidence intervals',
      'PCAP / Zeek / Suricata importers with extractor-mismatch checks',
      'Prometheus metrics and a Docker image for the edge box',
      'Model registry: upload new trees JSON, A/B-compare versions live']]
  ];

  U.register('deploy', {
    title: 'Roadmap & backend',
    render: function (root) {
      root.appendChild(U.pageHeader('Build', 'Do we need a backend? Not for this site — only for real packets', 'The paper’s models, SHAP and the drift monitor run in your browser, so everything you can click here works as a static site. A server enters only when you want to capture real traffic, keep history, or authenticate people.'));
      var rows = [['Capability', 'Static / in-browser', 'Needs a server?', 'Status']].concat(MATRIX);
      root.appendChild(U.card('What needs what', null, U.table(rows)));
      U.$$('td', root).forEach(function (td) { td.style.whiteSpace = 'normal'; });

      root.appendChild(h('div', { class: 'grid g3' },
        U.card('1 · Static only (what you have)', null, h('div', { class: 'col' }, h('p', { class: 'small' }, 'Host the folder anywhere that serves files — Vercel, Netlify, GitHub Pages, or just open it locally. No keys, no cold starts, nothing to secure.'), U.codeBlock('cd edge-defense-site\npython3 -m http.server 8080\n# open http://localhost:8080', true))),
        U.card('2 · Site + Edge API', null, h('div', { class: 'col' }, h('p', { class: 'small' }, 'The FastAPI app in server/ serves this site and the /api endpoints, so a capture agent can stream real flows into the same page.'), U.codeBlock('pip install -r server/requirements.txt\nuvicorn server.app:app --port 8000', true))),
        U.card('3 · Fold into edge-defense-api', null, h('div', { class: 'col' }, h('p', { class: 'small' }, 'Your existing FastAPI + Supabase + Clerk + React app already covers history and sign-in. Mount this site at /lab, keep the old pages, and add the new /api routes beside /analyze — the new endpoints use the 15-feature paper models rather than the earlier 20-feature ones.'), h('p', { class: 'small muted' }, 'Nothing here touches your existing Clerk or Supabase configuration.')))));

      ROAD.forEach(function (g) {
        root.appendChild(U.card(g[0], null, h('ul', { class: 'bul' }, g[2].map(function (t) { return h('li', null, t); }))));
      });
      root.appendChild(U.callout('info', 'info', h('div', null, h('b', null, 'Honest scope. '), 'None of the roadmap items is claimed by the paper. Where an idea tests something the paper leaves open (physically consistent attacks, SHAP-guided attacks on the monitor, enterprise-side evasion, hyperparameter search), it is listed in the paper’s own future work — see ', U.xref('limits', 'Limits & honesty'), '.')));
    }
  });
})(window);
