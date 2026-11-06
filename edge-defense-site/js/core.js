/* Edge Defense Lab — core helpers: DOM builder, icons, router, tooltip, chart primitives, UI components. */
(function (W) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var App = { pages: {}, nav: [], cleanups: [], current: null };
  W.App = App;

  /* ---------- DOM builder ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag), i = 2;
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { i = 1; attrs = null; }
    if (attrs) for (var k in attrs) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') for (var s in v) el.style.setProperty(s, v[s]);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function s(tag, attrs) {
    var el = document.createElementNS(NS, tag), i = 2;
    if (attrs) for (var k in attrs) { var v = attrs[k]; if (v == null) continue; if (k === 'text') el.textContent = v; else el.setAttribute(k, v); }
    for (; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- number formatting ---------- */
  var F = {
    n: function (v, d) { return (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
    f: function (v, d) { return (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(d == null ? 3 : d); },
    pct: function (v, d) { return (v == null || !isFinite(v)) ? '—' : (100 * v).toFixed(d == null ? 1 : d) + '%'; },
    ms: function (v) { return v < 10 ? v.toFixed(2) : v.toFixed(1); },
    sig: function (v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v); return a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : a >= 0.01 ? v.toFixed(3) : a === 0 ? '0' : v.toExponential(1); },
    raw: function (v) { v = +v; if (!isFinite(v)) return '—'; if (Number.isInteger(v) || Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-US'); return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2); }
  };

  /* ---------- icons (24px stroke set) ---------- */
  var IC = {
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M19 19v2H6"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    flip: '<path d="M12 3v18M5 8l4 4-4 4M19 8l-4 4 4 4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    sword: '<path d="M14 4l6-1-1 6-9 9-5-5 9-9z"/><path d="M6 16l-3 5 5-3"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    play: '<path d="M7 4l13 8-13 8V4z"/>',
    pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
    reset: '<path d="M4 4v6h6M4.5 14a8 8 0 1 0 2-8L4 10"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    plug: '<path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0V8zM12 17v5"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    cross: '<path d="M5 5l14 14M19 5L5 19"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    warn: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18H7z"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'
  };
  function icon(name, size, extra) {
    var sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('width', size || 18); sv.setAttribute('height', size || 18);
    sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '1.9');
    sv.setAttribute('stroke-linecap', 'round'); sv.setAttribute('stroke-linejoin', 'round'); sv.setAttribute('aria-hidden', 'true');
    sv.innerHTML = IC[name] || ''; if (extra) sv.setAttribute('class', extra);
    return sv;
  }

  /* ---------- theme ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function curTheme() {
    var t = document.documentElement.getAttribute('data-theme'); if (t) return t;
    return (W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); lsSet('edl-theme', t); drawThemeBtn(); App.rerenderCharts && App.rerenderCharts(); }
  function drawThemeBtn() { var b = $('#themeBtn'); if (!b) return; clear(b).appendChild(icon(curTheme() === 'dark' ? 'sun' : 'moon', 18)); }

  /* ---------- tooltip ---------- */
  var tipEl = null;
  var Tip = {
    show: function (ev, nodes) {
      tipEl = tipEl || $('#tip'); clear(tipEl); add(tipEl, nodes); tipEl.classList.add('on');
      var pad = 14, w = tipEl.offsetWidth, hh = tipEl.offsetHeight, x = ev.clientX + pad, y = ev.clientY + pad;
      if (x + w > innerWidth - 8) x = ev.clientX - w - pad; if (x < 8) x = 8;
      if (y + hh > innerHeight - 8) y = ev.clientY - hh - pad; if (y < 8) y = 8;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    },
    hide: function () { tipEl = tipEl || $('#tip'); if (tipEl) tipEl.classList.remove('on'); }
  };
  function tipBox(title, rows, meta) {
    return [title ? h('div', { class: 't' }, title) : null,
      (rows || []).map(function (r) {
        return h('div', { class: 'r' }, r.color ? h('i', { style: { 'border-color': r.color } }) : null, h('span', null, r.label + ' '), h('b', null, r.value));
      }), meta ? h('div', { class: 'm' }, meta) : null];
  }

  /* ---------- chart scaffolding ---------- */
  var charts = [];
  function mkChart(container, draw) {
    var st = { el: container, draw: draw, w: 0 };
    function render() {
      var w = Math.max(240, Math.floor(container.clientWidth || 600));
      st.w = w; clear(container);
      var node = draw(w); if (node) container.appendChild(node);
    }
    st.redraw = render;
    if (W.ResizeObserver) {
      var raf = 0, ro = new ResizeObserver(function () { if (Math.abs((container.clientWidth || 0) - st.w) > 2) { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); } });
      ro.observe(container); st.ro = ro;
    }
    charts.push(st); render(); return st;
  }
  App.rerenderCharts = function () { charts = charts.filter(function (c) { return document.body.contains(c.el); }); charts.forEach(function (c) { c.redraw(); }); };
  function niceTicks(lo, hi, n) {
    if (hi <= lo) hi = lo + 1;
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = (span / n) / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.ceil(lo / step - 1e-9) * step; for (; v <= hi + step * 1e-6; v += step) t.push(+v.toFixed(10)); return t;
  }
  function axisText(x, y, txt, anchor, extra) {
    var a = { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-size': 11.5, fill: 'var(--muted)', text: txt };
    if (extra) for (var k in extra) a[k] = extra[k]; return s('text', a);
  }
  function rbar(x, y, w, hgt, r, up) { // rounded data-end bar path (rounded on the data end only)
    if (hgt <= 0 || w <= 0) return ''; r = Math.min(r, w / 2, hgt);
    if (up) return 'M' + x + ',' + (y + hgt) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + hgt) + 'Z';
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + hgt - r) + 'Q' + (x + w) + ',' + (y + hgt) + ' ' + (x + w - r) + ',' + (y + hgt) + 'H' + x + 'Z';
  }
  function leftMargin(ticks, fmt) { var L = 0; ticks.forEach(function (t) { L = Math.max(L, String(fmt(t)).length); }); return Math.max(44, Math.round(L * 7 + 28)); }
  function legend(items) {
    return h('div', { class: 'legend' }, items.map(function (it) {
      return h('span', null, h('i', { class: it.sq ? 'sq' : '', style: { 'border-color': it.color, background: it.sq ? it.color : 'transparent', 'border-top-style': it.dash ? 'dashed' : 'solid' } }), it.label);
    }));
  }

  /* line chart: cfg() -> {series:[{name,color,pts:[[x,y]],dash,w}], x:{min,max,label,fmt}, y:{min,max,label,fmt}, hlines:[{y,label,color}], height} */
  function lineChart(container, getCfg) {
    return mkChart(container, function (W_) {
      var c = getCfg(), H = c.height || 260, m = { l: 52, r: c.rightPad || 16, t: 10, b: 38 };
      var all = []; c.series.forEach(function (se) { se.pts.forEach(function (p) { all.push(p); }); });
      var xmin = c.x.min != null ? c.x.min : Math.min.apply(null, all.map(function (p) { return p[0]; }).concat([0]));
      var xmax = c.x.max != null ? c.x.max : Math.max.apply(null, all.map(function (p) { return p[0]; }).concat([1]));
      var ymin = c.y.min != null ? c.y.min : 0, ymax = c.y.max != null ? c.y.max : Math.max.apply(null, all.map(function (p) { return p[1]; }).concat((c.hlines || []).map(function (l) { return l.y; }), [1e-9])) * 1.12;
      if (xmax <= xmin) xmax = xmin + 1;
      var yt = niceTicks(ymin, ymax, 5); m.l = leftMargin(yt, c.y.fmt || F.sig) + (c.y.label ? 14 : 0);
      var iw = W_ - m.l - m.r, ih = H - m.t - m.b;
      var X = function (v) { return m.l + (v - xmin) / (xmax - xmin) * iw; }, Y = function (v) { return m.t + ih - (v - ymin) / (ymax - ymin) * ih; };
      var sv = s('svg', { viewBox: '0 0 ' + W_ + ' ' + H, width: W_, height: H, role: 'img', 'aria-label': c.aria || c.y.label || 'chart' });
      yt.forEach(function (t) {
        sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(t), y2: Y(t), stroke: 'var(--grid)', 'stroke-width': 1 }));
        sv.appendChild(axisText(m.l - 8, Y(t) + 4, (c.y.fmt || F.sig)(t), 'end'));
      });
      (c.x.ticks || niceTicks(xmin, xmax, Math.max(3, Math.min(8, Math.floor(iw / 90))))).forEach(function (t) {
        sv.appendChild(axisText(X(t), H - m.b + 18, (c.x.tickFmt || c.x.fmt || F.n)(t), 'middle'));
      });
      sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(ymin), y2: Y(ymin), stroke: 'var(--axis)' }));
      if (c.x.label) sv.appendChild(axisText(m.l + iw / 2, H - 4, c.x.label, 'middle'));
      if (c.y.label) sv.appendChild(axisText(12, m.t + ih / 2, c.y.label, 'middle', { transform: 'rotate(-90 12 ' + (m.t + ih / 2) + ')' }));
      (c.bands || []).forEach(function (b) {
        var x0 = X(Math.max(b.x0, xmin)), x1 = X(Math.min(b.x1, xmax)); if (x1 > x0) sv.appendChild(s('rect', { x: x0, y: m.t, width: x1 - x0, height: ih, fill: b.fill || 'var(--bad)', opacity: b.opacity || 0.1 }));
      });
      (c.hlines || []).forEach(function (l) {
        sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(l.y), y2: Y(l.y), stroke: l.color || 'var(--ink2)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
        if (l.label) sv.appendChild(axisText(W_ - m.r - 4, Y(l.y) - 6, l.label, 'end', { fill: 'var(--ink2)' }));
      });
      c.series.forEach(function (se) {
        if (!se.pts.length) return;
        var d = se.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join('');
        if (se.area) sv.appendChild(s('path', { d: d + 'L' + X(se.pts[se.pts.length - 1][0]) + ',' + Y(ymin) + 'L' + X(se.pts[0][0]) + ',' + Y(ymin) + 'Z', fill: se.color, opacity: 0.12 }));
        sv.appendChild(s('path', { d: d, fill: 'none', stroke: se.color, 'stroke-width': se.w || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': se.dash || null }));
        if (se.dots) se.pts.forEach(function (p) { sv.appendChild(s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3.6, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2 })); });
        var last = se.pts[se.pts.length - 1];
        if (c.endLabels && c.series.length <= 4) sv.appendChild(s('circle', { cx: X(last[0]), cy: Y(last[1]), r: 4, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
      });
      // hover crosshair + tooltip
      var cross = s('line', { y1: m.t, y2: m.t + ih, stroke: 'var(--ink2)', 'stroke-width': 1, opacity: 0 });
      var dots = c.series.map(function (se) { return s('circle', { r: 4.5, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }); });
      sv.appendChild(cross); dots.forEach(function (d) { sv.appendChild(d); });
      var hit = s('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', style: 'cursor:crosshair' });
      hit.addEventListener('pointermove', function (ev) {
        var r = sv.getBoundingClientRect(), px = (ev.clientX - r.left) * (W_ / r.width), xv = xmin + (px - m.l) / iw * (xmax - xmin);
        var rows = [], best = null;
        c.series.forEach(function (se, i) {
          if (!se.pts.length) return; var lo = 0, hi = se.pts.length - 1;
          while (lo < hi) { var mid = (lo + hi) >> 1; if (se.pts[mid][0] < xv) lo = mid + 1; else hi = mid; }
          var p = se.pts[lo]; if (lo > 0 && Math.abs(se.pts[lo - 1][0] - xv) < Math.abs(p[0] - xv)) p = se.pts[lo - 1];
          dots[i].setAttribute('cx', X(p[0])); dots[i].setAttribute('cy', Y(p[1])); dots[i].setAttribute('opacity', 1);
          rows.push({ color: se.color, label: se.name, value: (c.y.tipFmt || c.y.fmt || F.sig)(p[1]) }); if (!best) best = p;
        });
        if (!best) return; cross.setAttribute('x1', X(best[0])); cross.setAttribute('x2', X(best[0])); cross.setAttribute('opacity', 0.5);
        (c.hlines || []).forEach(function (l) { if (l.label) rows.push({ label: l.label, value: (c.y.tipFmt || c.y.fmt || F.sig)(l.y) }); });
        Tip.show(ev, tipBox((c.x.tipLabel || c.x.label || 'x') + ' ' + (c.x.fmt || F.n)(best[0]), rows));
      });
      hit.addEventListener('pointerleave', function () { cross.setAttribute('opacity', 0); dots.forEach(function (d) { d.setAttribute('opacity', 0); }); Tip.hide(); });
      sv.appendChild(hit);
      return sv;
    });
  }

  /* grouped vertical bars: cfg() -> {cats:[str], series:[{name,color,vals,lo,hi,tip:[str]}], y:{min,max,label,fmt}, height, valueLabels, hline} */
  function barChart(container, getCfg) {
    return mkChart(container, function (W_) {
      var c = getCfg(), H = c.height || 280, m = { l: 52, r: 12, t: 12, b: c.catRot ? 80 : 44 };
      var ymin = c.y.min != null ? c.y.min : 0, ymax = c.y.max;
      if (ymax == null) { ymax = 0; c.series.forEach(function (se) { se.vals.forEach(function (v, i) { ymax = Math.max(ymax, se.hi ? se.hi[i] : v); }); }); ymax *= 1.08; }
      var yt = niceTicks(ymin, ymax, 5); m.l = leftMargin(yt, c.y.fmt || F.sig) + (c.y.label ? 14 : 0);
      var iw = W_ - m.l - m.r, ih = H - m.t - m.b;
      var Y = function (v) { return m.t + ih - (Math.min(Math.max(v, ymin), ymax) - ymin) / (ymax - ymin) * ih; };
      var sv = s('svg', { viewBox: '0 0 ' + W_ + ' ' + H, width: W_, height: H, role: 'img', 'aria-label': c.aria || c.y.label || 'bar chart' });
      yt.forEach(function (t) {
        sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(t), y2: Y(t), stroke: 'var(--grid)' }));
        sv.appendChild(axisText(m.l - 8, Y(t) + 4, (c.y.fmt || F.sig)(t), 'end'));
      });
      var nC = c.cats.length, nS = c.series.length, gw = iw / nC, bw = Math.min(46, (gw * 0.72 - (nS - 1) * 2) / nS), tw = nS * bw + (nS - 1) * 2;
      if (c.y.label) sv.appendChild(axisText(12, m.t + ih / 2, c.y.label, 'middle', { transform: 'rotate(-90 12 ' + (m.t + ih / 2) + ')' }));
      c.cats.forEach(function (cat, ci) {
        var gx = m.l + ci * gw + (gw - tw) / 2;
        var lab = axisText(m.l + ci * gw + gw / 2, H - m.b + 18, cat, c.catRot ? 'end' : 'middle', { fill: 'var(--ink2)' });
        if (c.catRot) lab.setAttribute('transform', 'rotate(-35 ' + (m.l + ci * gw + gw / 2) + ' ' + (H - m.b + 14) + ')');
        sv.appendChild(lab);
        c.series.forEach(function (se, si) {
          var v = se.vals[ci]; if (v == null) return;
          var x = gx + si * (bw + 2), y = Y(v), hh = Y(ymin) - y;
          var p = s('path', { d: rbar(x, y, bw, hh, 4, true), fill: se.color, style: 'cursor:default' });
          p.addEventListener('pointermove', function (ev) {
            var rows = [{ color: se.color, label: se.name, value: se.tip && se.tip[ci] ? se.tip[ci] : (c.y.tipFmt || c.y.fmt || F.sig)(v) }];
            Tip.show(ev, tipBox(cat, rows, se.note && se.note[ci]));
          });
          p.addEventListener('pointerleave', Tip.hide); sv.appendChild(p);
          if (se.lo && se.hi && se.lo[ci] != null) {
            var cx = x + bw / 2; sv.appendChild(s('line', { x1: cx, x2: cx, y1: Y(se.lo[ci]), y2: Y(se.hi[ci]), stroke: 'var(--ink)', 'stroke-width': 1.5 }));
            [se.lo[ci], se.hi[ci]].forEach(function (e) { sv.appendChild(s('line', { x1: cx - 4, x2: cx + 4, y1: Y(e), y2: Y(e), stroke: 'var(--ink)', 'stroke-width': 1.5 })); });
          }
          if (c.valueLabels) sv.appendChild(axisText(x + bw / 2, (se.hi && se.hi[ci] != null ? Y(se.hi[ci]) : y) - 6, (c.valueFmt || c.y.fmt || F.sig)(v), 'middle', { fill: 'var(--ink)', 'font-size': 11 }));
        });
      });
      if (c.hline) { sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(c.hline.y), y2: Y(c.hline.y), stroke: 'var(--ink2)', 'stroke-dasharray': '5 4', 'stroke-width': 1.5, 'pointer-events': 'none' })); sv.appendChild(axisText(W_ - m.r - 2, Y(c.hline.y) - 5, c.hline.label, 'end', { fill: 'var(--ink2)', stroke: 'var(--surface)', 'stroke-width': 3, 'paint-order': 'stroke', 'pointer-events': 'none' })); }
      sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(ymin), y2: Y(ymin), stroke: 'var(--axis)' }));
      return sv;
    });
  }

  /* horizontal bars: cfg() -> {rows:[{label,value,color,sub,tip}], max, signed, fmt, rowH, labelW, pos:color, neg:color} */
  function hbar(container, getCfg) {
    return mkChart(container, function (W_) {
      var c = getCfg(), rows = c.rows, rh = c.rowH || 26, lw = c.labelW || Math.min(190, W_ * 0.38), m = { l: lw + 8 + (c.signed ? 44 : 0), r: 58, t: 4, b: c.axis === false ? 4 : 22 };
      var H = m.t + m.b + rows.length * rh, iw = W_ - m.l - m.r;
      var max = c.max || Math.max.apply(null, rows.map(function (r) { return Math.abs(r.value); }).concat([1e-9]));
      var min = c.signed ? -max : 0, X = function (v) { return m.l + (v - min) / (max - min) * iw; };
      var sv = s('svg', { viewBox: '0 0 ' + W_ + ' ' + H, width: W_, height: H, role: 'img', 'aria-label': c.aria || 'bar chart' });
      if (c.axis !== false) niceTicks(min, max, Math.max(2, Math.min(5, Math.floor(iw / 80)))).forEach(function (t) {
        sv.appendChild(s('line', { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, stroke: 'var(--grid)' }));
        sv.appendChild(axisText(X(t), H - 6, (c.axisFmt || c.fmt || F.sig)(t), 'middle'));
      });
      rows.forEach(function (r, i) {
        var y = m.t + i * rh, bh = Math.max(8, rh - 8), x0 = X(0), x1 = X(r.value), col = r.color || (c.signed ? (r.value >= 0 ? (c.pos || 'var(--div-pos)') : (c.neg || 'var(--div-neg)')) : 'var(--s1)');
        var lab = axisText(m.l - 8, y + rh / 2 + 4, r.label, 'end', { fill: 'var(--ink2)', 'font-size': 12.5 }); sv.appendChild(lab);
        var left = Math.min(x0, x1), w = Math.abs(x1 - x0);
        var p = s('path', { d: rbar(Math.min(x0, x1), y + 4, Math.max(w, 1.5), bh, 4, false).replace(/^/, ''), fill: col });
        if (c.signed && r.value < 0) { p.setAttribute('d', 'M' + x0 + ',' + (y + 4) + 'H' + (x1 + 4) + 'Q' + x1 + ',' + (y + 4) + ' ' + x1 + ',' + (y + 8) + 'V' + (y + 4 + bh - 4) + 'Q' + x1 + ',' + (y + 4 + bh) + ' ' + (x1 + 4) + ',' + (y + 4 + bh) + 'H' + x0 + 'Z'); }
        p.addEventListener('pointermove', function (ev) { Tip.show(ev, tipBox(r.label, [{ label: c.valueName || 'value', value: (c.tipFmt || c.fmt || F.sig)(r.value) }], r.tip || r.sub)); });
        p.addEventListener('pointerleave', Tip.hide); sv.appendChild(p);
        var vtxt = (c.signed && r.value > 0 ? '+' : '') + (c.fmt || F.sig)(r.value);
        var anchorRight = !c.signed || r.value >= 0;
        sv.appendChild(axisText(anchorRight ? Math.max(x0, x1) + 6 : Math.min(x0, x1) - 6, y + rh / 2 + 4, vtxt, anchorRight ? 'start' : 'end', { fill: 'var(--ink)', 'font-size': 11.5, 'font-family': 'var(--font-mono)' }));
      });
      if (c.signed) sv.appendChild(s('line', { x1: X(0), x2: X(0), y1: m.t, y2: H - m.b, stroke: 'var(--axis)' }));
      return sv;
    });
  }

  /* scatter: cfg() -> {series:[{name,color,pts:[[x,y]],r}], x:{min,max,label,fmt}, y:{...}, height, hlines} */
  function scatter(container, getCfg) {
    return mkChart(container, function (W_) {
      var c = getCfg(), H = c.height || 300, m = { l: 52, r: 14, t: 10, b: 40 };
      var xs = [], ys = []; c.series.forEach(function (se) { se.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      var xmin = c.x.min != null ? c.x.min : Math.min.apply(null, xs), xmax = c.x.max != null ? c.x.max : Math.max.apply(null, xs);
      var ymin = c.y.min != null ? c.y.min : Math.min.apply(null, ys), ymax = c.y.max != null ? c.y.max : Math.max.apply(null, ys);
      var py = (ymax - ymin) * 0.06 || 1; if (c.y.min == null) ymin -= py; if (c.y.max == null) ymax += py;
      var yt = niceTicks(ymin, ymax, 5); m.l = leftMargin(yt, c.y.fmt || F.sig) + (c.y.label ? 14 : 0);
      var iw = W_ - m.l - m.r, ih = H - m.t - m.b;
      var X = function (v) { return m.l + (v - xmin) / (xmax - xmin) * iw; }, Y = function (v) { return m.t + ih - (v - ymin) / (ymax - ymin) * ih; };
      var sv = s('svg', { viewBox: '0 0 ' + W_ + ' ' + H, width: W_, height: H, role: 'img', 'aria-label': c.aria || 'scatter plot' });
      yt.forEach(function (t) { sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(t), y2: Y(t), stroke: 'var(--grid)' })); sv.appendChild(axisText(m.l - 8, Y(t) + 4, (c.y.fmt || F.sig)(t), 'end')); });
      niceTicks(xmin, xmax, Math.max(3, Math.min(7, Math.floor(iw / 90)))).forEach(function (t) { sv.appendChild(axisText(X(t), H - m.b + 18, (c.x.fmt || F.sig)(t), 'middle')); });
      if (ymin < 0 && ymax > 0) sv.appendChild(s('line', { x1: m.l, x2: W_ - m.r, y1: Y(0), y2: Y(0), stroke: 'var(--axis)', 'stroke-width': 1.2 }));
      if (c.x.label) sv.appendChild(axisText(m.l + iw / 2, H - 4, c.x.label, 'middle'));
      if (c.y.label) sv.appendChild(axisText(12, m.t + ih / 2, c.y.label, 'middle', { transform: 'rotate(-90 12 ' + (m.t + ih / 2) + ')' }));
      c.series.forEach(function (se) {
        se.pts.forEach(function (p) {
          var d = s('circle', { cx: X(p[0]), cy: Y(p[1]), r: se.r || 3.4, fill: se.color, 'fill-opacity': 0.72, stroke: 'var(--surface)', 'stroke-width': 1 });
          d.addEventListener('pointermove', function (ev) { Tip.show(ev, tipBox(se.name, [{ label: (c.x.name || 'x'), value: (c.x.fmt || F.sig)(p[0]) }, { label: (c.y.name || 'y'), value: (c.y.fmt || F.sig)(p[1]) }])); });
          d.addEventListener('pointerleave', Tip.hide); sv.appendChild(d);
        });
      });
      return sv;
    });
  }

  /* ---------- UI components ---------- */
  function card(title, sub, body, actions) {
    return h('section', { class: 'card' },
      (title || actions) ? h('div', { class: 'hd' }, h('div', null, title ? h('h3', null, title) : null, sub ? h('div', { class: 'sub' }, sub) : null), actions || null) : null, body);
  }
  function tile(k, v, d, cls) { return h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v num ' + (cls || '') }, v), d ? h('div', { class: 'd' }, d) : null); }
  function callout(kind, ic, body) { return h('div', { class: 'callout ' + (kind || '') }, icon(ic || (kind === 'warn' || kind === 'bad' ? 'warn' : 'info'), 18), h('div', null, body)); }
  function pill(kind, txt, ic) { return h('span', { class: 'pill ' + kind }, ic ? icon(ic, 12) : null, txt); }
  function pageHeader(eyebrow, title, lede) { return h('header', { class: 'ph' }, h('div', { class: 'eyebrow' }, eyebrow), h('h1', null, title), lede ? h('p', { class: 'lede' }, lede) : null); }
  function seg(options, value, onChange, label) {
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || 'options' });
    options.forEach(function (o) {
      var b = h('button', { type: 'button', 'aria-pressed': String(o.value === value), onclick: function () { $$('button', wrap).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); onChange(o.value); } }, o.label);
      wrap.appendChild(b);
    });
    return wrap;
  }
  function slider(label, min, max, step, value, onInput, fmt) {
    var out = h('span', { class: 'val' }, (fmt || String)(value));
    var inp = h('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label });
    inp.addEventListener('input', function () { out.textContent = (fmt || String)(+inp.value); onInput(+inp.value); });
    var el = h('label', { class: 'f' }, h('div', { class: 'lbl-row' }, h('span', null, label), out), inp); el.input = inp; el.out = out; return el;
  }
  function select(label, options, value, onChange) {
    var sel = h('select', { 'aria-label': label }, options.map(function (o) { return h('option', { value: o.value, selected: o.value === value }, o.label); }));
    sel.addEventListener('change', function () { onChange(sel.value); });
    var el = h('label', { class: 'f' }, h('span', null, label), sel); el.sel = sel; return el;
  }
  function table(rows, o) {
    o = o || {}; var head = rows[0], body = rows.slice(1), numCols = o.num || [];
    var t = h('table', { class: 't' + (o.click ? ' click' : '') },
      h('thead', null, h('tr', null, head.map(function (c, i) { return h('th', { class: numCols.indexOf(i) >= 0 ? 'n' : '' }, c); }))),
      h('tbody', null, body.map(function (r, ri) {
        var tr = h('tr', { class: o.rowClass ? o.rowClass(ri, r) : '' }, r.map(function (c, i) { return h('td', { class: numCols.indexOf(i) >= 0 ? 'n' : '' }, c); }));
        if (o.onRow) tr.addEventListener('click', function () { o.onRow(ri, r, tr); }); return tr;
      })));
    return h('div', { class: 'tbl-wrap' }, t);
  }
  function copyBtn(getText, label) {
    var b = h('button', { class: 'btn sm', type: 'button' }, icon('copy', 14), label || 'Copy');
    b.addEventListener('click', function () {
      var txt = getText(), done = function () { b.lastChild.textContent = 'Copied'; setTimeout(function () { b.lastChild.textContent = label || 'Copy'; }, 1400); };
      var fallback = function () {
        var ta = h('textarea', { style: { position: 'fixed', opacity: '0', left: '-9999px' } }); ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { b.lastChild.textContent = 'Select & copy manually'; } document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    });
    return b;
  }
  function codeBlock(text, copy) {
    var pre = h('pre', { class: 'code' }, h('code', null, text));
    if (copy !== false) { var w = h('span', { class: 'cp' }, copyBtn(function () { return text; })); pre.insertBefore(w, pre.firstChild); }
    return pre;
  }
  function xref(token, label) { return h('a', { class: 'xref', href: '#' + token }, label); }
  function onLeave(fn) { App.cleanups.push(fn); }
  function timer(fn, ms) { var id = setInterval(fn, ms); onLeave(function () { clearInterval(id); }); return id; }

  /* ---------- router ---------- */
  function route() {
    var tok = (location.hash || '').replace(/^#/, '') || 'overview', page = tok, anchor = null;
    var m;
    if (/^(sec|fig|tbl)-/.test(tok)) { page = 'paper'; anchor = tok; }
    else if ((m = /^refs-(\d+)$/.exec(tok))) { page = 'refs'; anchor = 'ref-' + m[1]; }
    else if (!App.pages[tok]) page = 'overview';
    if (App.current === page && anchor && page === 'paper') { jump(anchor); return; }
    App.cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) { } });
    Tip.hide();
    var P = App.pages[page], root = $('#page'); clear(root); charts = [];
    document.title = (P.title ? P.title + ' · ' : '') + 'Edge Defense Lab';
    App.current = page;
    try { P.render(root, { anchor: anchor }); } catch (e) { console.error(e); root.appendChild(callout('bad', 'warn', 'This page hit an error: ' + e.message)); }
    $$('#side a').forEach(function (a) { if (a.getAttribute('href') === '#' + page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.body.classList.remove('nav-open');
    if (anchor) setTimeout(function () { jump(anchor); }, 30); else window.scrollTo(0, 0);
  }
  function jump(id) { var el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash-target'); setTimeout(function () { el.classList.remove('flash-target'); }, 1600); } }
  function register(id, def) { App.pages[id] = def; }

  function buildNav() {
    var side = clear($('#side'));
    App.nav.forEach(function (g) {
      side.appendChild(h('h6', null, g.group));
      g.items.forEach(function (it) {
        side.appendChild(h('a', { href: '#' + it.id }, icon(it.icon, 17), it.label, it.tag ? h('span', { class: 'tag' }, it.tag) : null));
      });
    });
  }

  /* ---------- command palette ---------- */
  function openPalette() {
    var root = clear($('#paletteRoot')), items = [];
    App.nav.forEach(function (g) { g.items.forEach(function (it) { items.push({ k: 'Page', label: it.label, hash: it.id, hay: it.label + ' ' + g.group }); }); });
    (W.EDGE_PAPER.sections || []).forEach(function (sc) {
      items.push({ k: 'Section', label: sc.num + '. ' + sc.title, hash: sc.id, hay: sc.title });
      sc.subs.forEach(function (sb) { items.push({ k: 'Section', label: sc.num + '-' + sb.num + ' ' + sb.title, hash: sb.id, hay: sb.title }); });
    });
    (W.EDGE_PAPER.refs || []).forEach(function (r) { items.push({ k: 'Ref', label: '[' + r.n + '] ' + r.text.slice(0, 90), hash: 'refs-' + r.n, hay: r.text }); });
    var inp = h('input', { type: 'text', placeholder: 'Search pages, sections, references…', 'aria-label': 'Search', autocomplete: 'off' }), list = h('div', { class: 'pal-list', role: 'listbox' }), sel = 0, shown = [];
    function draw() {
      var q = inp.value.trim().toLowerCase(); clear(list);
      shown = items.filter(function (it) { return !q || it.hay.toLowerCase().indexOf(q) >= 0 || it.label.toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      shown.forEach(function (it, i) {
        var a = h('a', { href: '#' + it.hash, class: i === sel ? 'on' : '', role: 'option', onclick: close }, h('span', { class: 'chip' }, it.k), it.label); list.appendChild(a);
      });
      if (!shown.length) list.appendChild(h('div', { class: 'muted small', style: { padding: '12px' } }, 'No matches.'));
    }
    function close() { clear(root); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) {
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === 'Enter' && shown[sel]) { location.hash = '#' + shown[sel].hash; close(); }
    }
    inp.addEventListener('input', function () { sel = 0; draw(); });
    root.appendChild(h('div', { class: 'pal-wrap', onclick: function (e) { if (e.target.classList.contains('pal-wrap')) close(); } }, h('div', { class: 'pal' }, inp, list)));
    document.addEventListener('keydown', onKey, true); draw(); inp.focus();
  }

  App.boot = function () {
    var saved = lsGet('edl-theme'); if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
    $('#brandMark').appendChild(icon('shield', 18)); $('#menuBtn').appendChild(icon('menu', 18)); $('#searchIc').appendChild(icon('search', 15));
    drawThemeBtn();
    $('#themeBtn').addEventListener('click', function () { setTheme(curTheme() === 'dark' ? 'light' : 'dark'); });
    $('#menuBtn').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
    $('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    $('#paletteBtn').addEventListener('click', openPalette);
    document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
    buildNav(); window.addEventListener('hashchange', route); route();
  };

  W.UI = { h: h, s: s, add: add, clear: clear, $: $, $$: $$, F: F, icon: icon, Tip: Tip, tipBox: tipBox, lineChart: lineChart, barChart: barChart, hbar: hbar, scatter: scatter, legend: legend, mkChart: mkChart,
    card: card, tile: tile, callout: callout, pill: pill, pageHeader: pageHeader, seg: seg, slider: slider, select: select, table: table, copyBtn: copyBtn, codeBlock: codeBlock,
    xref: xref, onLeave: onLeave, timer: timer, register: register, niceTicks: niceTicks, lsGet: lsGet, lsSet: lsSet };
})(window);
