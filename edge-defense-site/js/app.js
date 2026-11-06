/* App wiring: navigation + boot */
(function (W) {
  'use strict';
  App.nav = [
    { group: 'Start', items: [
      { id: 'overview', label: 'Overview', icon: 'home' },
      { id: 'paper', label: 'Read the paper', icon: 'book' },
      { id: 'refs', label: 'References', icon: 'list' }] },
    { group: 'Results', items: [
      { id: 'crossdomain', label: 'Cross-domain failure', icon: 'swap' },
      { id: 'mechanism', label: 'Sign-flip mechanism', icon: 'flip' },
      { id: 'baselines', label: 'Domain-adaptation baselines', icon: 'layers' },
      { id: 'evasion', label: 'Adversarial evasion', icon: 'sword' },
      { id: 'drift', label: 'SHAP drift monitor', icon: 'pulse' },
      { id: 'edge', label: 'Edge deployment', icon: 'chip' },
      { id: 'literature', label: 'Literature', icon: 'table' },
      { id: 'limits', label: 'Limits & honesty', icon: 'flag' }] },
    { group: 'Live lab', items: [
      { id: 'simulator', label: 'Live simulator', icon: 'play', tag: 'live' },
      { id: 'attacklab', label: 'Attack lab', icon: 'target' },
      { id: 'driftlab', label: 'Drift monitor lab', icon: 'eye' },
      { id: 'builder', label: 'Flow builder', icon: 'sliders' },
      { id: 'batch', label: 'Batch scoring', icon: 'upload' },
      { id: 'bench', label: 'Latency benchmark', icon: 'timer' },
      { id: 'connect', label: 'Connect live traffic', icon: 'plug' },
      { id: 'reproduce', label: 'Reproduce the paper', icon: 'check' }] },
    { group: 'Build', items: [
      { id: 'deploy', label: 'Roadmap & backend', icon: 'cloud' }] }
  ];
  function go() { var sk = document.querySelector('.sr'); if (sk) sk.addEventListener('click', function (e) { e.preventDefault(); var m = document.getElementById('main'); if (m) { m.focus(); m.scrollIntoView(); } });
    try { App.boot(); } catch (e) { console.error(e); document.getElementById('page').textContent = 'Failed to start: ' + e.message; } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})(window);
