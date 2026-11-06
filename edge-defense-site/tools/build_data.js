const fs = require('fs');
const E = require('../js/engine.js');
const spec = JSON.parse(fs.readFileSync(__dirname + '/models_raw.json'));
const M = {C: new E.TreeModel(spec.C)};
const OUT = __dirname + '/../data/';

// 1) models.js
fs.writeFileSync(OUT + 'models.js', 'window.EDGE_MODELS=' + JSON.stringify(spec) + ';\n');

// 2) pool.js (compact rows) + ranges
const lines = fs.readFileSync(__dirname + '/../data-src/demo_sample.csv', 'utf8').trim().split('\n');
const hdr = lines[0].split(','); const col = n => hdr.indexOf(n);
const types = []; const tIdx = {};
const fmt = v => { const x = +v; if (Number.isInteger(x)) return x; return +x.toPrecision(7); };
const rows = lines.slice(1).map(l => {
  const r = l.split(',');
  const t = r[col('attack_type')]; if (!(t in tIdx)) { tIdx[t] = types.length; types.push(t); }
  return [r[col('domain')] === 'enterprise' ? 0 : 1, tIdx[t], +r[col('is_attack')]].concat(E.FEATURES.map(f => fmt(r[col(f)])));
});
// ranges (pooled 0.5/99.5 percentile, model space)
function qcsv(path) { const L = fs.readFileSync(path, 'utf8').trim().split('\n'); const h = L[0].split(','); const out = {}; L.slice(1).forEach(l => { const c = l.split(','); out[c[0]] = c.slice(1).map(Number); }); return { h: h.slice(1), q: out }; }
const qs = ['enterprise', 'iot'].map(d => qcsv(`${__dirname}/../data-src/${d}_quantiles.csv`));
const lo = [], hi = [];
E.FEATURES.forEach((f, j) => {
  let l = Infinity, h = -Infinity;
  qs.forEach(q => { const k = q.h.indexOf(f); l = Math.min(l, q.q['0.005'][k]); h = Math.max(h, q.q['0.995'][k]); });
  let a = j < 8 ? Math.log1p(Math.max(l, 0)) : l, b = j < 8 ? Math.log1p(Math.max(h, 0)) : h;
  if (b <= a) { a = 0; b = 1; }
  lo.push(+a.toFixed(5)); hi.push(+b.toFixed(5));
});
const pool = { features: E.FEATURES, domains: ['enterprise', 'iot'], types, rows, lo, hi };
fs.writeFileSync(OUT + 'pool.js', 'window.EDGE_POOL=' + JSON.stringify(pool) + ';\n');

// 3) monitor references: per domain x window size (paper protocol: 20 null draws, threshold = mean + 4*std)
const poolFlows = rows.map(r => { const raw = r.slice(3); const x = E.prep(raw); return { d: r[0], y: r[2], x, shap: M.C.shap(x).phi }; });
const byDom = [poolFlows.filter(p => p.d === 0), poolFlows.filter(p => p.d === 1)];
const mean = a => a.reduce((s, v) => s + v, 0) / a.length, std = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };
const draw = (src, n, r) => { const o = []; for (let i = 0; i < n; i++) o.push(src[Math.floor(r() * src.length)]); return o; };
const monitor = {};
['enterprise', 'iot'].forEach((dn, di) => {
  monitor[dn] = {};
  [250, 500, 1000].forEach(N => {
    const r = E.rng(1000 * (di + 1) + N);
    const ref = draw(byDom[di], N, r), mon = new E.Monitor(ref.map(p => p.shap));
    const nulls = []; for (let k = 0; k < 20; k++) nulls.push(mon.psi(draw(byDom[di], N, r).map(p => p.shap)).psi);
    const nm = mean(nulls), ns = std(nulls);
    monitor[dn][N] = Object.assign({ null_mean: nm, null_std: ns, threshold: nm + 4 * ns }, mon.toSpec());
    console.log(dn, N, 'thr', (nm + 4 * ns).toFixed(4));
  });
});
fs.writeFileSync(OUT + 'monitor.js', 'window.EDGE_MONITOR=' + JSON.stringify(monitor) + ';\n');

// 4) Model C mean|SHAP| by domain + header_len_total dependence for models A, B, C (SHAP vs feature) — computed here with the validated JS engine
const MA = new E.TreeModel(spec.A), MB = new E.TreeModel(spec.B);
const dep = { features: E.FEATURES, importance: {}, dependence: {}, corr: {} };
const importance = (model, di) => { const s = new Float64Array(15); byDom[di].forEach(p => { const ph = model.shap(p.x).phi; for (let j = 0; j < 15; j++) s[j] += Math.abs(ph[j]); }); return Array.from(s, v => +(v / byDom[di].length).toFixed(5)); };
dep.importance = { C_enterprise: importance(M.C, 0), C_iot: importance(M.C, 1), A_enterprise: importance(MA, 0), B_iot: importance(MB, 1), A_iot: importance(MA, 1), B_enterprise: importance(MB, 0) };
const hj = 7; // header_len_total
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db); };
const depFor = (model, di, key) => {
  const pts = byDom[di].map(p => [p.x[hj], model.shap(p.x).phi[hj]]);
  dep.corr[key] = +corr(pts.map(q => q[0]), pts.map(q => q[1])).toFixed(3);
  // subsample 350 points for the scatter
  const r = E.rng(77); const sub = []; for (let i = 0; i < 350; i++) sub.push(pts[Math.floor(r() * pts.length)]);
  dep.dependence[key] = sub.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]);
};
depFor(MA, 0, 'A_enterprise'); depFor(MB, 1, 'B_iot'); depFor(M.C, 0, 'C_enterprise'); depFor(M.C, 1, 'C_iot');
console.log('SHAP-vs-feature corr (header_len_total):', dep.corr, '(paper Table II: A +0.508, B -0.916)');
// Spearman between Model C importances (Enterprise vs IoT)
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); idx.forEach((q, k) => r[q[1]] = k + 1); return r; };
dep.spearman_C = +corr(rank(dep.importance.C_enterprise), rank(dep.importance.C_iot)).toFixed(3);
console.log('Spearman rho (Model C importance Ent vs IoT):', dep.spearman_C, '(paper 0.900)');
fs.writeFileSync(OUT + 'shapdep.js', 'window.EDGE_SHAPDEP=' + JSON.stringify(dep) + ';\n');
console.log(fs.readdirSync(OUT).map(f => f + ' ' + fs.statSync(OUT + f).size).join('\n'));
