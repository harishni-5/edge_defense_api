const fs = require('fs');
const E = require('../js/engine.js');
const spec = JSON.parse(fs.readFileSync(__dirname + '/models_raw.json'));
const M = {A:new E.TreeModel(spec.A), B:new E.TreeModel(spec.B), C:new E.TreeModel(spec.C)};
// load sample
const lines = fs.readFileSync(__dirname + '/../data-src/demo_sample.csv','utf8').trim().split('\n');
const hdr = lines[0].split(',');
const col = n => hdr.indexOf(n);
const rows = lines.slice(1).map(l => l.split(','));
const pool = rows.map((r,i) => ({
  i, raw: E.FEATURES.map(f => +r[col(f)]), domain: r[col('domain')], type: r[col('attack_type')], y: +r[col('is_attack')]
}));
pool.forEach(p => { p.x = E.prep(p.raw); p.shapC = M.C.shap(p.x).phi; p.pC = M.C.proba(p.x); });
console.log('pool', pool.length, 'enterprise', pool.filter(p=>p.domain==='enterprise').length, 'iot', pool.filter(p=>p.domain==='iot').length);
const ent = pool.filter(p=>p.domain==='enterprise'), iot = pool.filter(p=>p.domain==='iot');

// ---- feature ranges for attack (pooled 0.5/99.5 pct in model space) ----
function qcsv(path){ const L=fs.readFileSync(path,'utf8').trim().split('\n'); const h=L[0].split(','); const out={}; L.slice(1).forEach(l=>{const c=l.split(','); out[c[0]]=c.slice(1).map(Number);}); return {h:h.slice(1),q:out}; }
// quantile files: rows index 0.0,0.005,0.995,1.0
function ranges(){
  const lo=new Float32Array(15), hi=new Float32Array(15);
  const qs = ['enterprise','iot'].map(d=>qcsv(`${__dirname}/../data-src/${d}_quantiles.csv`));
  E.FEATURES.forEach((f,j)=>{
    let l=Infinity,h=-Infinity;
    qs.forEach(q=>{ const k=q.h.indexOf(f); l=Math.min(l,q.q['0.005'][k]); h=Math.max(h,q.q['0.995'][k]); });
    lo[j] = j<8?Math.log1p(Math.max(l,0)):l; hi[j] = j<8?Math.log1p(Math.max(h,0)):h;
    if (hi[j]<=lo[j]) { lo[j]=0; hi[j]=1; }
  });
  return {lo,hi};
}
const R = ranges();
console.log('ranges lo', Array.from(R.lo).map(v=>+v.toFixed(2)).join(','));
console.log('ranges hi', Array.from(R.hi).map(v=>+v.toFixed(2)).join(','));

// ---- sampling helpers ----
function shuffle(a, r){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length, std=a=>{const m=mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/(a.length-1));};
function draw(src, n, r){ const out=[]; for(let i=0;i<n;i++) out.push(src[Math.floor(r()*src.length)]); return out; }

const results = {thresholds:{}};
for (const N of [100,250,500,1000]) {
  const r = E.rng(100+N);
  const refBatch = draw(ent, N, r);
  const mon = new E.Monitor(refBatch.map(p=>p.shapC));
  const nulls = []; for (let k=0;k<20;k++) nulls.push(mon.psi(draw(ent,N,r).map(p=>p.shapC)).psi);
  const nm=mean(nulls), ns=std(nulls), thr=nm+4*ns;
  const shift = mon.psi(draw(iot,N,r).map(p=>p.shapC)).psi;
  // label-mix shift: 20% attacks vs pool mix
  const entB = ent.filter(p=>p.y===0), entA = ent.filter(p=>p.y===1);
  const mix = frac => { const b=[]; for(let i=0;i<N;i++) b.push((r()<frac?draw(entA,1,r):draw(entB,1,r))[0]); return b; };
  const mix20 = mon.psi(mix(0.2).map(p=>p.shapC)).psi, mix35 = mon.psi(mix(0.35).map(p=>p.shapC)).psi, mix50=mon.psi(mix(0.5).map(p=>p.shapC)).psi;
  console.log(`N=${N}: null mean=${nm.toFixed(4)} std=${ns.toFixed(4)} thr=${thr.toFixed(4)} | Ent→IoT shift PSI=${shift.toFixed(3)} (${(shift/thr).toFixed(0)}× thr) | attack-mix 20%:${mix20.toFixed(3)} 35%:${mix35.toFixed(3)} 50%:${mix50.toFixed(4)}`);
  results.thresholds[N] = {null_mean:nm, null_std:ns, threshold:thr, domain_shift_psi:shift, mix20, mix35, mix50};
}
// paper-scale check: N ~ 1300-ish for null mean 0.0069?
for (const N of [1300,1500,2000]) {
  const r = E.rng(500+N); const refBatch = draw(ent,N,r); const mon=new E.Monitor(refBatch.map(p=>p.shapC));
  const nulls=[]; for(let k=0;k<20;k++) nulls.push(mon.psi(draw(ent,N,r).map(p=>p.shapC)).psi);
  console.log(`(paper-scale probe) N=${N}: null mean=${mean(nulls).toFixed(4)} std=${std(nulls).toFixed(4)}`);
}

// ---- Square-style attack validation on IoT attack flows detected by C ----
const thrC = 0.5;
const iotAtk = iot.filter(p=>p.y===1 && p.pC>=thrC);
console.log('IoT attack flows detected by C:', iotAtk.length, 'of', iot.filter(p=>p.y===1).length);
const sub = iotAtk.slice(0, 400);
for (const eps of [0.10, 0.30]) {
  let succ = 0, q = [];
  sub.forEach((p,i) => { const res = E.squareAttack(M.C, p.x, {eps, maxQ:1000, threshold:thrC, lo:R.lo, hi:R.hi, rand:E.rng(7+i)}); if(res.success){succ++; q.push(res.queries);} });
  const w = E.wilson(succ, sub.length);
  console.log(`Square-style eps=${eps}: evasion ${(100*succ/sub.length).toFixed(1)}% [${(100*w[0]).toFixed(1)}, ${(100*w[1]).toFixed(1)}]  median queries(success)=${q.sort((a,b)=>a-b)[Math.floor(q.length/2)]}`);
  results['square_'+eps] = succ/sub.length;
}
fs.writeFileSync(__dirname + '/experiments_out.json', JSON.stringify(results,null,1));

// ---- evasion vs drift monitor (paper's central finding) ----
console.log('\n=== evasion vs PSI monitor ===');
function evadeAll(batch, eps, seed){ return batch.map((p,i)=>{ if(p.y!==1) return p; const res=E.squareAttack(M.C,p.x,{eps,maxQ:1000,threshold:0.5,lo:R.lo,hi:R.hi,rand:E.rng(seed+i)}); const shap=M.C.shap(res.xadv).phi; return {...p, x:res.xadv, shapC:shap, pC:res.prob, evaded:res.success}; }); }
for (const dom of ['iot','enterprise']) {
  const src = dom==='iot'?iot:ent; const N=500;
  const r = E.rng(900); const refB = draw(src,N,r); const mon = new E.Monitor(refB.map(p=>p.shapC));
  const nulls=[]; for(let k=0;k<20;k++) nulls.push(mon.psi(draw(src,N,r).map(p=>p.shapC)).psi); const thr=mean(nulls)+4*std(nulls);
  const attackOnly = draw(src.filter(p=>p.y===1), N, r);
  const clean = mon.psi(attackOnly.map(p=>p.shapC)).psi;
  for (const eps of [0.10,0.30]) {
    const ev = evadeAll(attackOnly, eps, 4000);
    const det = ev.filter(p=>p.pC>=0.5).length/ev.length;
    const evPsi = mon.psi(ev.map(p=>p.shapC)).psi;
    // mixed stream with attacks evaded
    const mixed = draw(src,N,r); const evMixed = evadeAll(mixed, eps, 8000);
    const detMixed = evMixed.filter(p=>p.y===1 && p.pC>=0.5).length/evMixed.filter(p=>p.y===1).length;
    const mixPsi = mon.psi(evMixed.map(p=>p.shapC)).psi;
    console.log(`${dom} ε=${eps}: threshold=${thr.toFixed(4)} | attack-only clean PSI=${clean.toFixed(3)}, evaded PSI=${evPsi.toFixed(3)} (${(evPsi/thr).toFixed(0)}×), classifier detection after attack=${(100*det).toFixed(1)}% | mixed stream: PSI=${mixPsi.toFixed(3)} (${(mixPsi/thr).toFixed(1)}×), attack recall=${(100*detMixed).toFixed(1)}%`);
  }
}
