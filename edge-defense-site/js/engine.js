/* Edge Defense engine — runs the paper's trained XGBoost models in the browser.
 * Exact port of: tree prediction, path-dependent TreeSHAP (Lundberg et al. 2018),
 * the SHAP-attribution PSI drift monitor, and a Square-style discrete random-search attack.
 * No dependencies. Works in browsers and Node. */
(function (root) {
  'use strict';

  var FEATURES = ['duration','pkt_len_min','pkt_len_max','pkt_len_mean','pkt_len_std','total_bytes',
    'byte_rate','header_len_total','flag_syn','flag_fin','flag_rst','flag_ack','flag_psh','is_tcp','is_udp'];
  var NF = FEATURES.length;
  var N_CONT = 8; // first 8 are continuous and log1p-transformed (paper, Sec. III-A)
  var FEATURE_LABELS = {
    duration: 'Flow duration', pkt_len_min: 'Packet length (min)', pkt_len_max: 'Packet length (max)',
    pkt_len_mean: 'Packet length (mean)', pkt_len_std: 'Packet length (std)', total_bytes: 'Total bytes',
    byte_rate: 'Byte rate', header_len_total: 'Header length (total)', flag_syn: 'TCP SYN', flag_fin: 'TCP FIN',
    flag_rst: 'TCP RST', flag_ack: 'TCP ACK', flag_psh: 'TCP PSH', is_tcp: 'Protocol TCP', is_udp: 'Protocol UDP'
  };

  /* ---- preprocessing: raw canonical flow -> model input space (log1p on continuous fields) ---- */
  function prep(raw) {
    var x = new Float32Array(NF);
    for (var j = 0; j < NF; j++) {
      var v = Array.isArray(raw) || ArrayBuffer.isView(raw) ? raw[j] : raw[FEATURES[j]];
      v = +v; if (!isFinite(v)) v = 0;
      x[j] = j < N_CONT ? Math.log1p(Math.max(v, 0)) : v;
    }
    return x;
  }
  function unprep(x) { // model space -> raw canonical (for display)
    var o = {};
    for (var j = 0; j < NF; j++) o[FEATURES[j]] = j < N_CONT ? Math.expm1(x[j]) : x[j];
    return o;
  }

  /* ---- deterministic RNG ---- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---- Tree ensemble ---- */
  function TreeModel(spec) {
    this.features = spec.features;
    this.baseMargin = spec.base_margin;
    var T = spec.trees, n = T.length;
    this.n = n;
    this.off = new Int32Array(n + 1);
    var total = 0; for (var i = 0; i < n; i++) { this.off[i] = total; total += T[i].l.length; }
    this.off[n] = total;
    this.L = new Int32Array(total); this.R = new Int32Array(total); this.F = new Int16Array(total);
    this.T = new Float32Array(total); this.V = new Float32Array(total); this.C = new Float32Array(total);
    this.D = new Uint8Array(total);
    for (i = 0; i < n; i++) {
      var t = T[i], o = this.off[i];
      for (var k = 0; k < t.l.length; k++) {
        this.L[o + k] = t.l[k] < 0 ? -1 : t.l[k] + o;
        this.R[o + k] = t.r[k] < 0 ? -1 : t.r[k] + o;
        this.F[o + k] = t.f[k]; this.T[o + k] = t.t[k]; this.V[o + k] = t.v[k]; this.C[o + k] = t.c[k];
        this.D[o + k] = t.d ? t.d[k] : 0;
      }
    }
    this.maxDepth = 8;
    this._buf = null;
    // expected margin = base + sum of cover-weighted mean leaf value per tree
    var ev = this.baseMargin;
    for (i = 0; i < n; i++) ev += this._treeMean(this.off[i]);
    this.expected = ev;
  }
  TreeModel.prototype._treeMean = function (node) {
    if (this.L[node] < 0) return this.V[node];
    var c = this.C[node], l = this.L[node], r = this.R[node];
    return (this.C[l] * this._treeMean(l) + this.C[r] * this._treeMean(r)) / c;
  };
  TreeModel.prototype.margin = function (x) {
    var m = this.baseMargin, L = this.L, R = this.R, F = this.F, T = this.T, V = this.V, D = this.D;
    for (var i = 0; i < this.n; i++) {
      var node = this.off[i];
      while (L[node] >= 0) {
        var v = x[F[node]];
        node = (v !== v) ? (D[node] === 0 ? L[node] : R[node]) : (v < T[node] ? L[node] : R[node]);
      }
      m += V[node];
    }
    return m;
  };
  TreeModel.prototype.proba = function (x) { return 1 / (1 + Math.exp(-this.margin(x))); };

  /* Path-dependent TreeSHAP — direct port of the reference algorithm (exact Shapley values for trees). */
  TreeModel.prototype.shap = function (x) {
    var S = this.maxDepth + 2, size = S * S;
    if (!this._pf) {
      this._pf = new Int16Array(size); this._pz = new Float64Array(size);
      this._po = new Float64Array(size); this._pw = new Float64Array(size);
    }
    var phi = new Float64Array(NF), self = this;
    var pf = this._pf, pz = this._pz, po = this._po, pw = this._pw;
    var L = this.L, R = this.R, F = this.F, T = this.T, V = this.V, C = this.C, D = this.D;

    function extend(off, d, zf, of, fi) {
      pf[off + d] = fi; pz[off + d] = zf; po[off + d] = of; pw[off + d] = d === 0 ? 1 : 0;
      for (var i = d - 1; i >= 0; i--) {
        pw[off + i + 1] += of * pw[off + i] * (i + 1) / (d + 1);
        pw[off + i] = zf * pw[off + i] * (d - i) / (d + 1);
      }
    }
    function unwind(off, d, idx) {
      var of = po[off + idx], zf = pz[off + idx], next = pw[off + d];
      for (var i = d - 1; i >= 0; i--) {
        if (of !== 0) {
          var tmp = pw[off + i];
          pw[off + i] = next * (d + 1) / ((i + 1) * of);
          next = tmp - pw[off + i] * zf * (d - i) / (d + 1);
        } else {
          pw[off + i] = (pw[off + i] * (d + 1)) / (zf * (d - i));
        }
      }
      for (i = idx; i < d; i++) { pf[off + i] = pf[off + i + 1]; pz[off + i] = pz[off + i + 1]; po[off + i] = po[off + i + 1]; }
    }
    function unwoundSum(off, d, idx) {
      var of = po[off + idx], zf = pz[off + idx], next = pw[off + d], total = 0;
      for (var i = d - 1; i >= 0; i--) {
        if (of !== 0) {
          var tmp = next * (d + 1) / ((i + 1) * of);
          total += tmp;
          next = pw[off + i] - tmp * zf * ((d - i) / (d + 1));
        } else {
          total += (pw[off + i] / zf) / ((d - i) / (d + 1));
        }
      }
      return total;
    }
    function recurse(node, parentOff, d, pzf, pof, pfi, level) {
      var off = level * S;
      for (var i = 0; i <= d; i++) { // copy parent path (parent's depth is d-1 → d entries; copy d entries)
        if (i < d) { pf[off + i] = pf[parentOff + i]; pz[off + i] = pz[parentOff + i]; po[off + i] = po[parentOff + i]; pw[off + i] = pw[parentOff + i]; }
      }
      extend(off, d, pzf, pof, pfi);
      if (L[node] < 0) {
        for (i = 1; i <= d; i++) {
          var w = unwoundSum(off, d, i);
          phi[pf[off + i]] += w * (po[off + i] - pz[off + i]) * V[node];
        }
        return;
      }
      var sf = F[node], xv = x[sf], hot, cold;
      var goLeft = (xv !== xv) ? (D[node] === 0) : (xv < T[node]);
      hot = goLeft ? L[node] : R[node]; cold = goLeft ? R[node] : L[node];
      var cov = C[node], hz = C[hot] / cov, cz = C[cold] / cov, inz = 1, ino = 1;
      var found = -1;
      for (var k = 0; k <= d; k++) if (pf[off + k] === sf) { found = k; break; }
      if (found >= 0) {
        inz = pz[off + found]; ino = po[off + found];
        unwind(off, d, found); d -= 1;
      }
      recurse(hot, off, d + 1, hz * inz, ino, sf, level + 1);
      recurse(cold, off, d + 1, cz * inz, 0, sf, level + 1);
    }
    // NOTE: recursion copies the parent path into the next level's slice; the root path starts empty.
    for (var ti = 0; ti < this.n; ti++) {
      // level 0 holds an empty path of depth 0; recurse(root) copies 0 entries and extends at d=0
      recurse(this.off[ti], 0, 0, 1, 1, -1, 1);
    }
    return { phi: phi, base: this.expected };
  };

  /* ---- PSI drift monitor over signed SHAP vectors (paper Sec. IV-F) ---- */
  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function Monitor(refShap) { // refShap: array of Float64Array(NF) from a fixed reference batch
    this.edges = []; this.refPct = [];
    var n = refShap.length;
    for (var j = 0; j < NF; j++) {
      var col = new Float64Array(n); for (var i = 0; i < n; i++) col[i] = refShap[i][j];
      var s = Array.prototype.slice.call(col).sort(function (a, b) { return a - b; });
      var e = [];
      for (var d = 1; d <= 9; d++) { var q = quantile(s, d / 10); if (!e.length || q > e[e.length - 1]) e.push(q); }
      this.edges.push(e);
      this.refPct.push(this._hist(col, e));
    }
  }
  Monitor.prototype._hist = function (col, e) {
    var nb = e.length + 1, h = new Float64Array(nb), n = col.length;
    for (var i = 0; i < n; i++) {
      var v = col[i], b = 0; while (b < e.length && v > e[b]) b++;
      h[b] += 1;
    }
    for (var k = 0; k < nb; k++) h[k] = Math.max(h[k] / n, 1e-4);
    return h;
  };
  Monitor.prototype.psi = function (batchShap) {
    var n = batchShap.length, total = 0, per = new Float64Array(NF);
    for (var j = 0; j < NF; j++) {
      var col = new Float64Array(n); for (var i = 0; i < n; i++) col[i] = batchShap[i][j];
      var bp = this._hist(col, this.edges[j]), rp = this.refPct[j], s = 0;
      for (var k = 0; k < bp.length; k++) s += (bp[k] - rp[k]) * Math.log(bp[k] / rp[k]);
      per[j] = s; total += s;
    }
    return { psi: total / NF, perFeature: per };
  };


  Monitor.prototype.toSpec = function () {
    return { edges: this.edges, refPct: this.refPct.map(function (a) { return Array.prototype.slice.call(a); }) };
  };
  Monitor.fromSpec = function (spec) {
    var m = Object.create(Monitor.prototype);
    m.edges = spec.edges; m.refPct = spec.refPct.map(function (a) { return Float64Array.from(a); });
    return m;
  };

  /* ---- Square-style discrete random-search attack (paper Sec. IV-E), L-inf budget eps ----
   * lo/hi: clipped feature range in model space. Success = probability falls below the decision threshold. */
  function squareAttack(model, x, o) {
    var eps = o.eps, maxQ = o.maxQ || 1000, thr = o.threshold, lo = o.lo, hi = o.hi, rand = o.rand || rng(1);
    var bl = new Float32Array(NF), bh = new Float32Array(NF), xa = new Float32Array(NF), range = new Float64Array(NF);
    for (var j = 0; j < NF; j++) {
      range[j] = hi[j] - lo[j];
      bl[j] = Math.max(x[j] - eps * range[j], lo[j]); bh[j] = Math.min(x[j] + eps * range[j], hi[j]);
      if (bl[j] > bh[j]) { bl[j] = bh[j] = x[j]; }
      xa[j] = rand() < 0.5 ? bl[j] : bh[j];
    }
    var best = model.proba(xa), q = 1, hist = [best];
    while (q < maxQ && best >= thr) {
      var frac = Math.max(0.05, 0.8 * Math.pow(1 - q / maxQ, 2)); // shrinking neighbourhood
      var m = Math.max(1, Math.round(frac * NF)), cand = Float32Array.from(xa);
      for (var t = 0; t < m; t++) {
        var jj = Math.floor(rand() * NF);
        cand[jj] = rand() < 0.5 ? bl[jj] : bh[jj];
      }
      var p = model.proba(cand); q++;
      if (p < best) { best = p; xa = cand; }
      hist.push(best);
    }
    var linf = 0;
    for (j = 0; j < NF; j++) if (range[j] > 0) linf = Math.max(linf, Math.abs(xa[j] - x[j]) / range[j]);
    return { xadv: xa, prob: best, queries: q, success: best < thr, linf: linf, history: hist };
  }

  /* ---- metrics ---- */
  function auc(y, p) { // rank-based AUC
    var idx = Array.from(p.keys()).sort(function (a, b) { return p[a] - p[b]; });
    var r = new Float64Array(p.length), i = 0;
    while (i < idx.length) {
      var k = i; while (k + 1 < idx.length && p[idx[k + 1]] === p[idx[i]]) k++;
      var avg = (i + k) / 2 + 1; for (var t = i; t <= k; t++) r[idx[t]] = avg; i = k + 1;
    }
    var n1 = 0, s = 0; for (i = 0; i < y.length; i++) if (y[i] === 1) { n1++; s += r[i]; }
    var n0 = y.length - n1; if (!n1 || !n0) return NaN;
    return (s - n1 * (n1 + 1) / 2) / (n1 * n0);
  }
  function wilson(k, n, z) {
    z = z || 1.96; if (!n) return [0, 0];
    var p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - a) / d, (c + a) / d];
  }

  var API = { FEATURES: FEATURES, NF: NF, N_CONT: N_CONT, FEATURE_LABELS: FEATURE_LABELS, prep: prep, unprep: unprep, rng: rng,
    TreeModel: TreeModel, Monitor: Monitor, squareAttack: squareAttack, auc: auc, wilson: wilson, quantile: quantile };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EdgeEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
