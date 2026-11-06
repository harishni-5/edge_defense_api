/* Paper reader + references */
(function (W) {
  'use strict';
  var U = W.UI, h = U.h, PP = W.EDGE_PAPER;
  var LINKS = { 'tbl-I': ['crossdomain', 'Interactive view'], 'tbl-II': ['mechanism', 'Interactive view'], 'tbl-III': ['baselines', 'Interactive view'], 'tbl-IV': ['baselines', 'Interactive view'],
    'tbl-V': ['evasion', 'Interactive view'], 'tbl-VI': ['drift', 'Interactive view'], 'tbl-VII': ['edge', 'Interactive view'],
    'fig-2': ['mechanism', 'Interactive SHAP plots'], 'fig-3': ['attacklab', 'Try the attack'], 'fig-4': ['literature', 'Comparison table'] };
  var refByN = {}; PP.refs.forEach(function (r) { refByN[r.n] = r; });

  function wireCites(el) {
    U.$$('a.cite', el).forEach(function (a) {
      var n = +a.getAttribute('data-ref'); a.setAttribute('href', '#refs-' + n);
      a.addEventListener('pointermove', function (ev) { var r = refByN[n]; if (r) U.Tip.show(ev, [h('div', { class: 't' }, '[' + n + ']'), h('div', null, r.text)]); });
      a.addEventListener('pointerleave', U.Tip.hide);
    });
  }
  function htmlInto(tag, html, attrs) { var el = h(tag, attrs); el.innerHTML = html; wireCites(el); return el; }

  function blockEl(b) {
    if (b.t === 'h2') return h('h2', { id: b.id }, h('span', { class: 'n' }, b.num + '.'), b.title);
    if (b.t === 'h3') return h('h3', { id: b.id }, h('span', { class: 'n' }, b.num + '.'), b.title);
    if (b.t === 'p') return htmlInto('p', b.html);
    if (b.t === 'list') { var ol = h('ol'); b.items.forEach(function (it) { ol.appendChild(htmlInto('li', it)); }); return ol; }
    if (b.t === 'table') {
      var lk = LINKS[b.id];
      return h('div', { class: 'tblbox', id: b.id },
        h('div', { class: 'cap' }, 'TABLE ' + b.num + '. ' + b.caption, b.webOnly ? h('span', { class: 'webonly', title: 'Present on the web version; not printed in the 7-page IEEE PDF to stay within the page limit.' }, 'web only') : null),
        U.table(b.rows, { num: b.rows[0].map(function (_, i) { return i; }).filter(function (i) { return i > 0; }) }),
        lk ? h('div', { class: 'small', style: { 'margin-top': '6px' } }, h('a', { href: '#' + lk[0] }, lk[1] + ' →')) : null);
    }
    if (b.t === 'figure') {
      var cap = htmlInto('figcaption', '<b>Fig. ' + b.num + '.</b> ' + b.caption), lk2 = LINKS[b.id];
      return h('figure', { class: 'fig', id: b.id }, h('img', { src: b.src, alt: 'Figure ' + b.num, loading: 'lazy' }), cap, lk2 ? h('div', { class: 'small' }, h('a', { href: '#' + lk2[0] }, lk2[1] + ' →')) : null);
    }
    return h('div');
  }

  function clearMarks(root) {
    U.$$('mark.hit', root).forEach(function (m) { var p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  }
  function markAll(root, q) {
    var marks = []; if (!q || q.length < 2) return marks; var lq = q.toLowerCase();
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode.closest('script,style,mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(function (n) {
      var t = n.nodeValue, lt = t.toLowerCase(), i = lt.indexOf(lq); if (i < 0) return;
      var frag = document.createDocumentFragment(), last = 0;
      while (i >= 0) { frag.appendChild(document.createTextNode(t.slice(last, i))); var m = h('mark', { class: 'hit' }, t.slice(i, i + q.length)); frag.appendChild(m); marks.push(m); last = i + q.length; i = lt.indexOf(lq, last); }
      frag.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(frag, n);
    });
    return marks;
  }

  U.register('paper', {
    title: 'Paper',
    render: function (root) {
      var article = h('article', { class: 'paper', id: 'paperBody' }), toc = h('nav', { class: 'toc', 'aria-label': 'Paper outline' });
      root.appendChild(h('div', { class: 'col', style: { gap: '18px' } },
        U.pageHeader('Full text', 'The paper, readable and searchable', 'The same text as the submitted IEEE version, with live citations (hover a [n]), figures and tables. Two tables that did not fit the 7-page limit are kept here and marked “web only”.')));
      var tools = h('div', { class: 'row', style: { 'max-width': '70ch' } });
      var inp = h('input', { type: 'text', placeholder: 'Search the paper…', 'aria-label': 'Search the paper', style: { 'max-width': '260px' } });
      var count = h('span', { class: 'small muted num' }, ''), marks = [], mi = 0;
      function go(d) { if (!marks.length) return; marks[mi] && marks[mi].classList.remove('cur'); mi = (mi + d + marks.length) % marks.length; var m = marks[mi]; m.scrollIntoView({ block: 'center', behavior: 'smooth' }); count.textContent = (mi + 1) + ' / ' + marks.length; }
      var tmr; inp.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { clearMarks(article); marks = markAll(article, inp.value.trim()); mi = -1; count.textContent = inp.value.trim().length >= 2 ? marks.length + ' matches' : ''; if (marks.length) go(1); }, 160); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e.shiftKey ? -1 : 1); });
      var sizes = { S: 15.5, M: 17, L: 19 }, cur = U.lsGet('edl-size') || 'M';
      var sizeSeg = U.seg([{ value: 'S', label: 'A−' }, { value: 'M', label: 'A' }, { value: 'L', label: 'A+' }], cur, function (v) { article.style.fontSize = sizes[v] + 'px'; U.lsSet('edl-size', v); }, 'Text size');
      article.style.fontSize = sizes[cur] + 'px';
      tools.appendChild(inp); tools.appendChild(h('button', { class: 'btn sm', type: 'button', onclick: function () { go(-1); } }, '↑')); tools.appendChild(h('button', { class: 'btn sm', type: 'button', onclick: function () { go(1); } }, '↓')); tools.appendChild(count); tools.appendChild(sizeSeg);
      tools.appendChild(h('a', { class: 'btn sm', href: 'assets/paper.pdf', target: '_blank', rel: 'noopener' }, 'PDF')); tools.appendChild(h('a', { class: 'btn sm', href: 'assets/paper.tex', target: '_blank', rel: 'noopener' }, 'LaTeX source'));

      article.appendChild(h('div', { class: 'title' }, PP.title));
      article.appendChild(h('div', { class: 'authors' }, PP.authors.join(', '), h('br'), PP.affiliation, h('br'), h('span', { class: 'small muted' }, PP.equalNote)));
      var ab = h('div', { class: 'abs' }); ab.appendChild(h('b', null, 'Abstract — ')); ab.appendChild(document.createTextNode(PP.abstract));
      ab.appendChild(h('div', { style: { 'margin-top': '10px' } }, h('b', null, 'Keywords — '), PP.keywords.join(', ')));
      article.appendChild(ab);
      PP.blocks.forEach(function (b) { article.appendChild(blockEl(b)); });
      article.appendChild(h('p', { class: 'small', style: { 'font-family': 'var(--font-ui)' } }, h('a', { href: '#refs' }, 'References (' + PP.refs.length + ') →')));

      PP.sections.forEach(function (sc) {
        toc.appendChild(h('a', { href: '#' + sc.id, 'data-id': sc.id }, sc.num + '. ' + sc.title));
        sc.subs.forEach(function (sb) { toc.appendChild(h('a', { class: 'sub', href: '#' + sb.id, 'data-id': sb.id }, sb.num + '. ' + sb.title)); });
      });
      toc.appendChild(h('a', { href: '#refs' }, 'References'));
      var wrap = h('div', { class: 'reader' }, toc, h('div', { class: 'col', style: { gap: '14px', 'min-width': 0 } }, tools, article));
      root.appendChild(wrap);

      // scroll-spy
      if (W.IntersectionObserver) {
        var heads = U.$$('h2[id],h3[id]', article), active = null;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { active = e.target.id; U.$$('a', toc).forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-id') === active); }); } });
        }, { rootMargin: '-72px 0px -70% 0px' });
        heads.forEach(function (x) { io.observe(x); }); U.onLeave(function () { io.disconnect(); });
      }
    }
  });

  U.register('refs', {
    title: 'References',
    render: function (root, ctx) {
      var list = h('ol', { class: 'refs' }), q = h('input', { type: 'text', placeholder: 'Filter references…', 'aria-label': 'Filter references', style: { 'max-width': '320px' } });
      var secLabel = function (id) { return id.replace(/^(\w+)-/, '§$1-'); };
      PP.refs.forEach(function (r) {
        var li = h('li', { id: 'ref-' + r.n, value: r.n }, h('div', null, r.text),
          h('div', { class: 'small muted', style: { 'margin-top': '4px' } }, 'Cited in: ', r.cited.map(function (c, i) { return [i ? ', ' : '', h('a', { href: '#sec-' + c }, '§' + c)]; })));
        li.setAttribute('data-hay', r.text.toLowerCase()); list.appendChild(li);
      });
      q.addEventListener('input', function () { var v = q.value.trim().toLowerCase(); U.$$('li', list).forEach(function (li) { li.hidden = v && li.getAttribute('data-hay').indexOf(v) < 0; }); });
      root.appendChild(U.pageHeader('Bibliography', 'References', PP.refs.length + ' references, numbered in order of first citation. Each lists the sections that cite it.'));
      root.appendChild(h('div', { class: 'col', style: { gap: '14px' } }, q, h('div', { class: 'card' }, list)));
    }
  });
})(window);
