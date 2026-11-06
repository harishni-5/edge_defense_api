/* Numbers transcribed from the paper (Tables I–VII and Sections III–VI). Static; the live pages recompute what they can. */
window.EDGE_RESULTS = {
  table1: [
    { id: 'A_ent', label: 'A · in-domain (Enterprise)', short: 'A on Enterprise', kind: 'in', auc: 0.9816, aucLo: 0.9807, aucHi: 0.9825, f1: 0.9344, f1Lo: 0.9322, f1Hi: 0.9365 },
    { id: 'B_iot', label: 'B · in-domain (IoT)', short: 'B on IoT', kind: 'in', auc: 0.9738, aucLo: 0.9717, aucHi: 0.9758, f1: 0.9541, f1Lo: 0.9528, f1Hi: 0.9553 },
    { id: 'A_iot', label: 'A → IoT · zero-shot', short: 'A → IoT', kind: 'x', auc: 0.2643, aucLo: 0.2571, aucHi: 0.2717, f1: 0.5487, f1Lo: 0.5447, f1Hi: 0.5527 },
    { id: 'B_ent', label: 'B → Enterprise · zero-shot', short: 'B → Enterprise', kind: 'x', auc: 0.5525, aucLo: 0.5479, aucHi: 0.5570, f1: 0.6126, f1Lo: 0.6089, f1Hi: 0.6162 },
    { id: 'C_ent', label: 'C · Enterprise test', short: 'C on Enterprise', kind: 'c', auc: 0.9794, aucLo: 0.9783, aucHi: 0.9804, f1: 0.9286, f1Lo: 0.9263, f1Hi: 0.9310 },
    { id: 'C_iot', label: 'C · IoT test', short: 'C on IoT', kind: 'c', auc: 0.9709, aucLo: 0.9684, aucHi: 0.9731, f1: 0.9849, f1Lo: 0.9842, f1Hi: 0.9856 }
  ],
  deltaAucCvsA: { v: 0.0023, lo: 0.0019, hi: 0.0027 },
  macroF1: { A_iot: 0.285, B_ent: 0.306, elangovan: [0.69, 0.78] },
  ablation: { A_iot: [0.264, 0.645], B_ent: [0.553, 0.621], A_in: [0.982, 0.978], B_in: [0.974, 0.954] },
  mech: { spearman: 0.900, rawCorr: { ent: 0.061, iot: -0.235 }, shapCorr: { ent: 0.508, iot: -0.916 }, limeCorr: { ent: 0.591, iot: -0.511 }, domainAuc: 1.0 },
  coral: { ent: { naive: [0.979, 0.929], coral: [0.979, 0.928], d: [0.0001, -0.0004, 0.0005] }, iot: { naive: [0.971, 0.985], coral: [0.967, 0.983], d: [-0.0039, -0.0053, -0.0024] } },
  dann: [
    { dir: 'Enterprise → IoT', srcF1: [0.81, 0.05], srcAuc: [0.88, 0.03], cdF1: [0.77, 0.10], cdAuc: [0.35, 0.13] },
    { dir: 'IoT → Enterprise', srcF1: [0.84, 0.02], srcAuc: [0.86, 0.02], cdF1: [0.61, 0.00], cdAuc: [0.69, 0.04] }
  ],
  evasion: {
    n: 548,
    zoo: { none: [0.184, 0.154, 0.219], k: 101 },
    square: { e10: [0.845, 0.812, 0.873], e30: [1.0, 0.993, 1.0], none: [1.0, null, null] },
    hsj: { e10: [0.011, 0.005, 0.024], e30: [0.088, 0.067, 0.114], none: [1.0, null, null], medianLinf: 0.77 },
    evadedPsi: 1.3685, threshold: 0.0125, ratio: 110
  },
  drift: {
    threshold: 0.0125,
    rows: [
      { cond: 'Null (same-domain, independent split)', lo: 0.0060, hi: 0.0119, alarm: '0/6 alarms', ci: '[0%, 39%]', kind: 'null' },
      { cond: 'Novel-attack-type generalization', lo: 0.4040, hi: 0.4805, alarm: '4/4 detected', ci: '[51%, 100%]', kind: 'novel' },
      { cond: 'Domain shift (Enterprise → IoT)', lo: 2.2435, hi: 2.3030, alarm: '4/4 detected', ci: '[51%, 100%]', kind: 'shift' }
    ]
  },
  latency: [
    { tier: 'Predict-only', mean: 4.31, p50: 2.01, p95: 2.90, p99: 53.61 },
    { tier: '+ SHAP', mean: 10.29, p50: 4.90, p95: 56.49, p99: 57.05 },
    { tier: '+ SHAP + drift', mean: 17.49, p50: 10.44, p95: 53.33, p99: 54.54 }
  ],
  memoryMB: [321, 323],
  edgeCompare: [
    { who: 'This work (cgroup proxy, 1 core / 1 GB)', ms: 4.31, hw: 'Raspberry-Pi-4-class CPU quota', ref: null },
    { who: 'Diab et al.', ms: 22, hw: 'Real Raspberry Pi 3B+', ref: 34 },
    { who: 'Wijethilaka et al.', ms: 50, hw: 'Real Raspberry Pi 4 (≈)', ref: 35 },
    { who: 'Haruna et al.', ms: 0.41, hw: 'Docker (no percentiles reported)', ref: 38 }
  ],
  datasets: [
    { name: 'CSE-CIC-IDS2018', domain: 'Enterprise', rows: '308,877', attack: '44.2%', note: 'CICFlowMeter true-flow features · all 14 attack categories', ref: 1 },
    { name: 'CICIoT2023', domain: 'IoT', rows: '297,091 (sampled from 46.7M)', attack: '96.6%', note: 'Fixed 10-or-100-packet aggregate windows, not true flows · 34 labels (33 attack + benign)', ref: 2 }
  ],
  featureInfo: [
    { f: 'duration', d: 'Flow (or window) duration', u: 'µs', log: true },
    { f: 'pkt_len_min', d: 'Smallest packet length', u: 'bytes', log: true },
    { f: 'pkt_len_max', d: 'Largest packet length', u: 'bytes', log: true },
    { f: 'pkt_len_mean', d: 'Mean packet length', u: 'bytes', log: true },
    { f: 'pkt_len_std', d: 'Standard deviation of packet length', u: 'bytes', log: true },
    { f: 'total_bytes', d: 'Total bytes in the flow', u: 'bytes', log: true },
    { f: 'byte_rate', d: 'Bytes per second — semantic mismatch between extractors', u: 'bytes/s', log: true, flagged: true },
    { f: 'header_len_total', d: 'Total header length — semantic mismatch, sign-flips across domains', u: 'bytes', log: true, flagged: true },
    { f: 'flag_syn', d: 'TCP SYN flag present', u: '0/1' }, { f: 'flag_fin', d: 'TCP FIN flag present', u: '0/1' },
    { f: 'flag_rst', d: 'TCP RST flag present', u: '0/1' }, { f: 'flag_ack', d: 'TCP ACK flag present', u: '0/1' },
    { f: 'flag_psh', d: 'TCP PSH flag present', u: '0/1' }, { f: 'is_tcp', d: 'Protocol is TCP', u: '0/1' }, { f: 'is_udp', d: 'Protocol is UDP', u: '0/1' }
  ],
  glossary: [
    ['AUC', 'Area under the ROC curve: the chance that a random attack flow scores higher than a random benign flow. 0.5 is chance; below 0.5 means the ranking is inverted.'],
    ['SHAP', 'Shapley-value attributions: how much each feature pushed one prediction toward “attack” (positive) or “benign” (negative), in log-odds.'],
    ['PSI', 'Population Stability Index: Σ (batch% − ref%) · ln(batch% / ref%) over bins. Here it is computed on SHAP values, per feature, then averaged over the 15 features.'],
    ['ZOO', 'Zeroth-order optimisation attack: estimates gradients by querying the model. Weak against tree ensembles because their decision surface is piecewise constant.'],
    ['Square-style attack', 'Gradient-free discrete random search inside an L∞ budget ε (fraction of each feature’s clipped range). Needs only model outputs.'],
    ['HopSkipJump (HSJ)', 'Decision-based attack that needs only hard labels: boundary search plus Monte-Carlo gradient-direction estimates.'],
    ['CORAL', 'Correlation alignment: whitens each domain’s features and re-colours them to a shared covariance before training.'],
    ['DANN + OSVM', 'Domain-adversarial neural net feeding a one-class SVM (the DI-NIDS recipe), trained without any target-domain labels.'],
    ['ε (epsilon)', 'Attack budget: the largest allowed per-feature change, as a fraction of that feature’s clipped range (L∞ norm).'],
    ['Canonical schema', 'The 15 features both datasets can supply, so one model can be trained on both. Eight continuous ones are log1p-transformed.']
  ],
  limits: [
    ['Enterprise-side robustness is untested.', 'The paper ran all three attacks on IoT traffic only, so its evasion rates should not be assumed to carry over to the Enterprise domain. (The attack lab here lets you try Enterprise flows — treat that as exploratory, not a result from the paper.)', 'VI'],
    ['Only three black-box attack families.', 'ZOO, a Square-style search and HopSkipJump. The evasion rate is a lower bound: no exact MILP-based attack and no SHAP-guided attack on the drift monitor have been tried.', 'VI'],
    ['Perturbations are not physically consistent.', 'They are bounded per feature only; relations such as pkt_len_min ≤ pkt_len_max or total_bytes tracking byte_rate are not enforced, so some adversarial examples may not be emit-able by a real network stack.', 'IV-E'],
    ['A cross-domain gap remains unexplained.', 'Removing header_len_total and byte_rate lifts zero-shot AUC to 0.645 / 0.621 — still far from ≈0.97 in-domain.', 'V-B'],
    ['The drift monitor is a pilot.', '6 null batches and 4 shift batches per condition: the Wilson intervals are wide (e.g. 4/4 detected → [51%, 100%]).', 'V-E'],
    ['Edge numbers come from a cgroup proxy.', 'Not a physical Raspberry Pi; p95/p99 reflect a CPU-quota throttling artifact confirmed by an unconstrained control run, so means, medians and cross-tier ratios are the reliable quantities.', 'V-F'],
    ['No hyperparameter search.', 'All three models use fixed settings (depth 4, 200 trees), so the numbers are a fixed-configuration comparison, not each model’s tuned ceiling.', 'IV-B'],
    ['Two features are semantically mismatched.', 'header_len_total and byte_rate mean different things in the two extractors; they are kept because they still carry signal.', 'III-A'],
    ['Dataset duplication.', '31.96% of Enterprise test rows have an identical twin in training; the headline AUC moved by at most 0.0015 after de-duplicating. IoT cross-partition leakage is 2.04%.', 'III-B']
  ],
  future: [
    'Validate the edge benchmark on physical Raspberry Pi hardware.',
    'Identify what drives the residual cross-domain gap that remains after removing the two flagged features.',
    'Extend adversarial evaluation to the Enterprise domain; test SHAP-guided and physically realizable (inter-feature-consistent) attacks against both the classifier and the drift monitor.',
    'Re-calibrate the drift threshold against a larger pool of null batches and evaluate on more shift batches.',
    'Run a hyperparameter search for Models A/B/C to establish a fully-tuned ceiling.',
    'Measure the operational cost of a two-model deployment against the single pooled model, so the deployment argument is concrete.'
  ]
};
