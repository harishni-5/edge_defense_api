const E = require('../js/engine.js');
const spec = JSON.parse(require('fs').readFileSync(__dirname + '/models_raw.json'));
const ref = JSON.parse(require('fs').readFileSync(__dirname + '/validation_ref.json'));
let worst = {margin:0, proba:0, shap:0, expected:0, additivity:0};
for (const k of ['A','B','C']) {
  const m = new E.TreeModel(spec[k]); const R = ref.ref[k];
  let dm=0, dp=0, ds=0, da=0;
  ref.raw.forEach((row, i) => {
    const x = E.prep(row);
    dm = Math.max(dm, Math.abs(m.margin(x) - R.margin[i]));
    dp = Math.max(dp, Math.abs(m.proba(x) - R.proba[i]));
    const s = m.shap(x);
    for (let j=0;j<15;j++) ds = Math.max(ds, Math.abs(s.phi[j] - R.shap[i][j]));
    let sum = s.base; for (let j=0;j<15;j++) sum += s.phi[j];
    da = Math.max(da, Math.abs(sum - m.margin(x)));
  });
  const de = Math.abs(m.expected - R.expected);
  console.log(`model ${k}: max|Δmargin|=${dm.toExponential(2)}  max|Δproba|=${dp.toExponential(2)}  max|ΔSHAP|=${ds.toExponential(2)}  |Δexpected|=${de.toExponential(2)}  additivity err=${da.toExponential(2)}`);
}
// timing
const m = new E.TreeModel(spec.C); const xs = ref.raw.map(r => E.prep(r));
let t0 = process.hrtime.bigint(); for (let r=0;r<20;r++) for (const x of xs) m.proba(x);
let t1 = process.hrtime.bigint(); console.log('predict-only mean ms/flow (node):', Number(t1-t0)/1e6/(20*xs.length));
t0 = process.hrtime.bigint(); for (let r=0;r<5;r++) for (const x of xs) m.shap(x);
t1 = process.hrtime.bigint(); console.log('predict+SHAP mean ms/flow (node):', Number(t1-t0)/1e6/(5*xs.length));
