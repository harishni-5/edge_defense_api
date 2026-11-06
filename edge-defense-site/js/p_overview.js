/* Overview page */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, F = U.F, R = W.EDGE_RESULTS, PP = W.EDGE_PAPER;

  function modelRow(k, p, y) {
    var flagged = p >= Lab.THR, right = y < 0 ? null : (flagged === (y === 1));
    var fill = h('i', { style: { width: Math.max(2, p * 100) + '%', background: Lab.COLORS[k] } });
    return h('tr', null,
      h('td', null, h('span', { class: 'bigmodel' }, h('span', { class: 'dotm', style: { background: Lab.COLORS[k] } }), Lab.SHORT[k])),
      h('td', null, h('span', { class: 'pbar thr', style: { '--thr': '50%', width: '110px' } }, fill), h('span', { class: 'mono num' }, F.f(p, 3))),
      h('td', null, flagged ? U.pill('attack', 'Attack', 'warn') : U.pill('benign', 'Benign', 'check')),
      h('td', null, right == null ? '' : right ? h('span', { class: 'pill benign' }, U.icon('check', 12), 'correct') : h('span', { class: 'pill attack' }, U.icon('cross', 12), 'wrong')));
  }

  function tryCard() {
    var st = { dom: 1, kind: 'attack', row: null };
    var out = h('div', { class: 'col' }), meta = h('div', { class: 'row' });
    function draw(row) {
      st.row = row; var p = Lab.score(row); U.clear(out);
      out.appendChild(h('div', { class: 'row' }, U.pill('info', Lab.DOM[row.d] + ' network'), row.y === 1 ? U.pill('attack', 'Truth: ' + row.type, 'warn') : U.pill('benign', 'Truth: benign', 'check')));
      out.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('tbody', null, Lab.KEYS.map(function (k) { return modelRow(k, p[k], row.y); })))));
      var wrong = Lab.KEYS.filter(function (k) { return Lab.verdict(p[k]) !== (row.y === 1); });
      out.appendChild(h('p', { class: 'small muted' }, wrong.length === 0 ? 'All three models agree with the ground truth on this flow.' : 'Wrong: ' + wrong.map(function (k) { return 'Model ' + k; }).join(', ') + '. ' + (wrong.indexOf('C') < 0 && wrong.length ? 'The pooled Model C gets it right.' : '')));
      var raw = row.raw;
      out.appendChild(h('div', { class: 'small muted mono', style: { 'overflow-wrap': 'anywhere' } }, 'duration ' + F.raw(raw[0]) + ' µs · bytes ' + F.raw(raw[5]) + ' · pkt mean ' + F.raw(raw[3]) + ' · header ' + F.raw(raw[7]) + ' · ' + (raw[13] ? 'TCP' : raw[14] ? 'UDP' : 'other')));
    }
    function rand(filterFn) {
      var pool = Lab.rows.filter(function (r) { return r.d === st.dom && (st.kind === 'any' || (st.kind === 'attack' ? r.y === 1 : r.y === 0)) && (!filterFn || filterFn(r)); });
      draw(pool[Math.floor(Math.random() * pool.length)]);
    }
    var domSeg = U.seg([{ value: 0, label: 'Enterprise' }, { value: 1, label: 'IoT' }], st.dom, function (v) { st.dom = v; rand(); }, 'Network type');
    var kindSeg = U.seg([{ value: 'attack', label: 'Attack' }, { value: 'benign', label: 'Benign' }, { value: 'any', label: 'Any' }], st.kind, function (v) { st.kind = v; rand(); }, 'Flow kind');
    var fail = h('button', { class: 'btn sm', type: 'button', onclick: function () {
      var pool = Lab.idx[1][1].filter(function (r) { var p = Lab.score(r); return p.A < 0.5 && p.C >= 0.5; });
      draw(pool[Math.floor(Math.random() * pool.length)]); } }, U.icon('swap', 14), 'Show me a cross-domain failure');
    var go = h('button', { class: 'btn primary', type: 'button', onclick: function () { rand(); } }, U.icon('bolt', 15), 'Draw a flow');
    var c = U.card('Try the models on a flow', 'Real paper models, running in your browser. Flows come from a labeled demo sample.', h('div', { class: 'col' }, h('div', { class: 'row' }, domSeg, kindSeg), h('div', { class: 'row' }, go, fail), out));
    // start with a failure case: an IoT attack that Model A misses but Model C catches
    var pool0 = Lab.idx[1][1].filter(function (r) { var p = Lab.score(r); return p.A < 0.5 && p.C >= 0.5; });
    draw(pool0.length ? pool0[7 % pool0.length] : Lab.idx[1][1][0]);
    return c;
  }

  function navCard(id, ic, title, text) {
    return h('div', { class: 'cards-nav' }, h('a', { href: '#' + id }, h('div', { class: 'card' }, h('h3', null, U.icon(ic, 18), title), h('p', { class: 'small muted' }, text))));
  }

  U.register('overview', {
    title: 'Overview',
    render: function (root) {
      var abs = PP.abstract.split(/(?<=\.)\s+/); var short = abs.slice(0, 3).join(' ');
      root.appendChild(h('section', { class: 'hero' },
        h('div', { class: 'col', style: { gap: '16px' } },
          h('div', { class: 'eyebrow' }, 'Research companion · ' + PP.affiliation),
          h('h1', null, 'One model for Enterprise and IoT intrusion detection'),
          h('p', { class: 'muted', style: { 'font-size': '15px' } }, PP.title),
          h('p', { class: 'abs' }, short + ' '),
          h('p', { class: 'small muted' }, PP.authors.join(' · ')),
          h('div', { class: 'row' },
            h('a', { class: 'btn primary', href: '#simulator' }, U.icon('pulse', 16), 'Open the live simulator'),
            h('a', { class: 'btn', href: '#paper' }, U.icon('book', 16), 'Read the paper'),
            h('a', { class: 'btn', href: 'assets/paper.pdf', target: '_blank', rel: 'noopener' }, U.icon('link', 16), 'Open PDF'))),
        tryCard()));

      root.appendChild(h('section', { class: 'grid g5' },
        U.tile('Model A on IoT (zero-shot)', '0.264', 'AUC · worse than chance (95% CI 0.257–0.272)', 'bad'),
        U.tile('Pooled Model C', '0.979 / 0.971', 'AUC on Enterprise / IoT', 'good'),
        U.tile('Square-style evasion, ε ≤ 0.10', '84.5%', 'of 548 IoT attack flows · ZOO manages 18.4%'),
        U.tile('PSI on evaded traffic', '≈110×', 'the 0.0125 threshold — the drift monitor still fires'),
        U.tile('Predict-only latency', '4.31 ms', 'mean, 1 core / 1 GB cgroup profile')));

      root.appendChild(h('section', { class: 'col' },
        h('h2', { class: 'sec-title' }, 'Things you can do here'),
        h('p', { class: 'sec-sub' }, 'Everything below runs the paper’s actual trained XGBoost models (A, B and C) client-side — no server involved. Each result page links to the lab tool that reproduces it.'),
        h('div', { class: 'grid g4' },
          navCard('simulator', 'pulse', 'Live traffic simulator', 'Stream flows through all three models, watch the SHAP-drift monitor and trigger scenarios.'),
          navCard('attacklab', 'sword', 'Attack lab', 'Run the Square-style evasion on a real flow, then on a batch, and see the monitor react.'),
          navCard('driftlab', 'eye', 'Drift monitor lab', 'Calibrate the PSI threshold, run windows under different shifts, inspect the bins.'),
          navCard('builder', 'sliders', 'Flow builder', 'Craft a flow by hand, see all three scores, SHAP bars and what-if sweeps.'),
          navCard('batch', 'upload', 'Batch scoring', 'Drop a CSV of flows, score it and check drift against a reference network.'),
          navCard('bench', 'timer', 'Latency benchmark', 'Measure predict / +SHAP / +drift on your own device.'),
          navCard('connect', 'plug', 'Connect live traffic', 'Feed real captured flows from the packet agent or your own pipeline.'),
          navCard('reproduce', 'check', 'Reproduce the paper', 'Recompute key numbers in your browser and compare against the paper.'))));

      root.appendChild(h('section', { class: 'grid g2', style: { 'align-items': 'start' } },
        U.card('Pipeline (Fig. 1)', 'Two domains → one canonical schema → three models → explain, attack, monitor, benchmark.',
          h('figure', { class: 'fig', style: { margin: 0 } }, h('img', { src: 'assets/fig1.png', alt: 'Pipeline diagram from the paper', loading: 'lazy' }))),
        U.card('Key terms', null, h('dl', { class: 'kv', style: { 'grid-template-columns': '1fr', gap: '10px' } },
          R.glossary.slice(0, 7).map(function (g) { return h('div', null, h('dt', { style: { color: 'var(--ink)', 'font-weight': 700 } }, g[0]), h('dd', { style: { 'text-align': 'left', 'font-family': 'var(--font-ui)', color: 'var(--ink2)', 'font-size': '13.5px' } }, g[1])); })))));

      root.appendChild(U.callout('warn', 'info', h('div', null, h('b', null, 'How to read the live tools. '), 'The sample behind the lab is a class-balanced set of 6,070 flows drawn from the two datasets, so it is a replay, not live traffic, and may include rows the models trained on. Numbers recomputed here are for illustration and will not match the paper’s test-set intervals exactly. See ', U.xref('reproduce', 'Reproduce the paper'), ' and ', U.xref('limits', 'Limits & honesty'), '.')));
    }
  });
})(window);
