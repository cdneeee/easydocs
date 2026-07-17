/* EasyDocs: builds the standalone HTML document. String-only functions,
   so this file can also run under Node for smoke tests. */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  var out = String(s || '').toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'document';
}

/* Shared markup for reference chips inside editable text. */
function chipInner(num, name) {
  return '<span class="rc-n">' + num + '</span><span class="rc-t">' + escapeHtml(name) + '</span>';
}
function chipHtml(id, num, name) {
  return '<span class="ref-chip" contenteditable="false" data-ref="' + id + '">' + chipInner(num, name) + '</span>';
}

function isH2Block(b) { return b.type === 'heading' && (b.level || 2) === 2; }

/* Groups the flat pages array into a tree: pages, sections, subsections
   (two levels below a page at most). Pages whose parent is missing, part
   of a cycle, or nested too deep are treated as top-level pages. */
function pageTree(project) {
  var pages = project.pages || [];
  var byId = {};
  pages.forEach(function (pg) { byId[pg.id] = pg; });
  var nodeById = {};
  var placed = {};
  var roots = [];

  function nodeFor(pg) {
    if (!nodeById[pg.id]) nodeById[pg.id] = { page: pg, children: [] };
    return nodeById[pg.id];
  }

  function place(pg, level) {
    if (placed[pg.id]) return;
    placed[pg.id] = true;
    if (pg.kind !== 'group' && level >= 2) return;
    var childLevel = pg.kind === 'group' ? 0 : level + 1;
    pages.forEach(function (c) {
      if (c.parentId === pg.id && !placed[c.id]) {
        nodeFor(pg).children.push(nodeFor(c));
        place(c, childLevel);
      }
    });
  }

  pages.forEach(function (pg) {
    if (!pg.parentId || !byId[pg.parentId]) {
      roots.push(nodeFor(pg));
      place(pg, 0);
    }
  });
  pages.forEach(function (pg) {
    if (!placed[pg.id]) {
      roots.push(nodeFor(pg));
      placed[pg.id] = true;
    }
  });
  return roots;
}

/* Map of annotation id to { num, name, desc, figNo } for the whole document. */
function buildAnnIndex(project) {
  var idx = {};
  var figNo = 0;
  (project.pages || []).forEach(function (pg) {
    (pg.blocks || []).forEach(function (b) {
      if (b.type !== 'image') return;
      figNo++;
      (b.annotations || []).forEach(function (a, k) {
        idx[a.id] = { num: k + 1, name: a.name || 'Pin ' + (k + 1), desc: a.desc || '', figNo: figNo };
      });
    });
  });
  return idx;
}

function refAnchor(id, info) {
  return '<a class="ref" href="#pin-' + id + '"><span class="rn">' + info.num + '</span>' +
    escapeHtml(info.name) + '</a>';
}

/* Turns stored ref-chip spans into links. Uses the DOM in the browser and a
   regex fallback matching the exact chipHtml shape when run under Node. */
function transformRefs(html, annIdx) {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    Array.prototype.slice.call(tmp.querySelectorAll('.ref-chip')).forEach(function (ch) {
      var id = ch.getAttribute('data-ref');
      var info = annIdx[id];
      var span = document.createElement('span');
      if (info) {
        span.innerHTML = refAnchor(id, info);
        ch.replaceWith(span.firstChild);
      } else {
        span.className = 'ref broken';
        span.textContent = ch.textContent;
        ch.replaceWith(span);
      }
    });
    return tmp.innerHTML;
  }
  return html.replace(
    /<span class="ref-chip" contenteditable="false" data-ref="([^"]+)"><span class="rc-n">\d*<\/span><span class="rc-t">([\s\S]*?)<\/span><\/span>/g,
    function (m, id, label) {
      var info = annIdx[id];
      if (info) return refAnchor(id, info);
      return '<span class="ref broken">' + label + '</span>';
    });
}

function hexRgb(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '79,70,229';
  var n = parseInt(m[1], 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

function docFavicon(accent) {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23" +
    String(accent || '#4f46e5').replace('#', '') +
    "'/%3E%3Cpath d='M20 20h24M20 31h24M20 42h14' stroke='%23fff' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E";
}

function renderDocTable(b, ctx) {
  var rows = b.rows || [];
  if (!rows.length) return '';
  var out = '<table class="tbl">';
  rows.forEach(function (row, r) {
    var tag = (b.header && r === 0) ? 'th' : 'td';
    out += '<tr>' + row.map(function (cell) {
      return '<' + tag + '>' + transformRefs(cell || '', ctx.annIdx) + '</' + tag + '>';
    }).join('') + '</tr>';
  });
  return out + '</table>';
}

function renderDocFigure(b, ctx) {
  var fno = ctx.figNos[b.id];
  var anns = b.annotations || [];
  var ps = b.pinSize || 24;
  var pw = ps * 100 / 696;
  var sizeCss = ';width:' + pw.toFixed(3) + 'cqw;height:' + pw.toFixed(3) + 'cqw;font-size:' + (pw / 2).toFixed(3) + 'cqw';
  var pins = anns.map(function (a, i) {
    return '<a class="pin" style="left:' + a.x + '%;top:' + a.y + '%' + sizeCss + '" href="#pin-' + a.id +
      '" title="' + escapeHtml(a.name || '') + '">' + (i + 1) + '</a>';
  }).join('');
  var legend = '';
  if (anns.length) {
    legend = '<ol class="legend">' + anns.map(function (a, i) {
      var nm = escapeHtml(a.name || 'Pin ' + (i + 1));
      if (a.pageId && ctx.pageIds && ctx.pageIds[a.pageId]) {
        nm = '<a class="plink" href="#pg-' + a.pageId + '">' + nm + '</a>';
      }
      return '<li id="pin-' + a.id + '"><span class="ln">' + (i + 1) + '</span><span class="lt"><b>' +
        nm + '</b>' +
        (a.desc ? ' <span class="ld">' + escapeHtml(a.desc) + '</span>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }
  var cap = b.caption ? ' ' + escapeHtml(b.caption) : '';
  return '<figure class="fig" id="fig-' + b.id + '">' +
    '<div class="shot" style="width:' + (b.width || 100) + '%">' +
    '<img src="' + b.src + '" alt="' + escapeHtml(b.caption || 'Figure ' + fno) + '">' + pins + '</div>' +
    '<figcaption><b>Figure ' + fno + '.</b>' + cap + '</figcaption>' + legend + '</figure>';
}

var CALLOUT_LABELS = { info: 'Note', tip: 'Tip', warning: 'Warning', danger: 'Danger' };

function renderDocBlock(b, ctx) {
  switch (b.type) {
    case 'paragraph': {
      var h = transformRefs(b.html, ctx.annIdx);
      if (!h.replace(/<br\s*\/?>/g, '').trim()) return '';
      return '<p>' + h + '</p>';
    }
    case 'heading': {
      var tag = (b.level || 2) === 3 ? 'h3' : 'h2';
      var no = tag === 'h2' ? '<span class="secno">' + ctx.secno + '</span> ' : '';
      return '<' + tag + ' id="hd-' + b.id + '">' + no + escapeHtml(b.text || '') + '</' + tag + '>';
    }
    case 'list': {
      var lt = b.ordered ? 'ol' : 'ul';
      return '<' + lt + '>' + transformRefs(b.html || '', ctx.annIdx) + '</' + lt + '>';
    }
    case 'code':
      return '<div class="codeblock">' +
        (b.lang ? '<div class="codelang">' + escapeHtml(b.lang) + '</div>' : '') +
        '<pre><code>' + escapeHtml(b.code || '') + '</code></pre></div>';
    case 'callout': {
      var kind = b.kind || 'info';
      return '<div class="callout co-' + kind + '"><div class="co-bar"></div><div class="co-body">' +
        '<span class="co-k">' + (CALLOUT_LABELS[kind] || 'Note') + '</span>' +
        transformRefs(b.html || '', ctx.annIdx) + '</div></div>';
    }
    case 'table': return renderDocTable(b, ctx);
    case 'image': return renderDocFigure(b, ctx);
    case 'divider': return '<hr class="div">';
  }
  return '';
}

function docCSS(accent) {
  var rgb = hexRgb(accent);
  return '\n' +
':root { --accent: ' + accent + '; }\n' +
'* { box-sizing: border-box; }\n' +
'html { scroll-behavior: smooth; }\n' +
'body { margin: 0; font: 16px/1.65 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e2430; background: #fff; }\n' +
'#side { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; overflow-y: auto; background: #f8f9fb; border-right: 1px solid #e6e8ee; padding: 22px 18px; }\n' +
'.side-title { font-weight: 700; font-size: 15px; }\n' +
'.side-sub { color: #71778a; font-size: 12px; margin: 2px 0 14px; }\n' +
'#q { width: 100%; padding: 7px 10px; border: 1px solid #d8dbe4; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; }\n' +
'#q:focus { outline: 2px solid rgba(' + rgb + ',.35); border-color: var(--accent); }\n' +
'.sr-bar { display: none; align-items: center; gap: 6px; font-size: 12px; color: #71778a; margin: 8px 0 0; }\n' +
'.sr-bar.on { display: flex; }\n' +
'.sr-bar button { border: 1px solid #d8dbe4; background: #fff; border-radius: 6px; padding: 1px 8px; cursor: pointer; font: inherit; font-size: 12px; color: #3c4254; }\n' +
'#toc { list-style: none; margin: 14px 0 0; padding: 0; font-size: 13.5px; }\n' +
'#toc a { display: block; color: #3c4254; text-decoration: none; padding: 5px 8px; border-radius: 6px; }\n' +
'#toc a:hover { background: #eceef4; }\n' +
'#toc a.on { background: rgba(' + rgb + ',.09); color: var(--accent); font-weight: 600; }\n' +
'#toc ul { list-style: none; padding-left: 14px; margin: 0; }\n' +
'#toc ul a { font-size: 12.5px; color: #5b6172; padding: 3px 8px; }\n' +
'#toc li.hide { display: none; }\n' +
'#toc li.tgrp { margin-top: 14px; }\n' +
'#toc li.tgrp > a { text-transform: uppercase; font-size: 11px; letter-spacing: .08em; color: #9096a6; font-weight: 700; }\n' +
'#toc li.tgrp > a:hover { background: none; color: var(--accent); }\n' +
'main { margin-left: 280px; }\n' +
'.wrap { max-width: 860px; margin: 0 auto; padding: 0 44px; }\n' +
'main > .wrap:last-of-type { padding-bottom: 90px; }\n' +
'.cover { padding: 78px 0 34px; border-bottom: 2px solid var(--accent); margin-bottom: 18px; }\n' +
'.cover .logo { max-height: 60px; max-width: 240px; display: block; margin-bottom: 26px; }\n' +
'.cover h1 { font-size: 40px; line-height: 1.15; margin: 0; letter-spacing: -.01em; }\n' +
'.cover .sub { font-size: 18px; color: #5b6172; margin: 10px 0 0; }\n' +
'.meta { display: flex; gap: 30px; margin-top: 24px; font-size: 13.5px; }\n' +
'.meta div span { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: #9096a6; margin-bottom: 1px; }\n' +
'section.page { padding-top: 30px; }\n' +
'section.part { margin: 56px 0 8px; background: linear-gradient(135deg, #222838 0%, #2d3555 100%); border-top: 3px solid var(--accent); scroll-margin-top: 0; }\n' +
'.part-in { max-width: 860px; margin: 0 auto; padding: 42px 44px 38px; }\n' +
'section.part h1 { margin: 0; font-size: 30px; color: #fff; letter-spacing: -.01em; }\n' +
'.p-pages { margin-top: 14px; color: rgba(255,255,255,.55); font-size: 13px; }\n' +
'h1.pt { font-size: 27px; margin: 24px 0 12px; letter-spacing: -.01em; }\n' +
'h1.pt.ps { font-size: 22px; }\n' +
'h1.pt.ps2 { font-size: 19px; }\n' +
'.secno { color: var(--accent); }\n' +
'h2 { font-size: 20px; margin: 30px 0 8px; }\n' +
'h3 { font-size: 16.5px; margin: 24px 0 6px; }\n' +
'h1.pt, h2, h3, .legend li { scroll-margin-top: 26px; }\n' +
'p { margin: 10px 0; }\n' +
'ul, ol { margin: 10px 0; padding-left: 26px; }\n' +
'li { margin: 3px 0; }\n' +
'a { color: var(--accent); }\n' +
'.ref { display: inline-flex; align-items: center; gap: 5px; background: rgba(' + rgb + ',.08); border: 1px solid rgba(' + rgb + ',.25); color: var(--accent); border-radius: 999px; padding: 0 9px 0 3px; font-size: .85em; font-weight: 600; text-decoration: none; vertical-align: baseline; line-height: 1.5; }\n' +
'.ref .rn { background: var(--accent); color: #fff; min-width: 15px; height: 15px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }\n' +
'.ref.broken { background: #fdf0f0; color: #b3372f; border-color: #eccfcd; padding: 0 9px; }\n' +
'code { background: #f1f2f6; border: 1px solid #e4e6ee; border-radius: 5px; padding: 1px 5px; font-family: ui-monospace, Consolas, "Courier New", monospace; font-size: .875em; }\n' +
'.codeblock { margin: 14px 0; border-radius: 10px; overflow: hidden; background: #232838; }\n' +
'.codelang { color: #8d94ab; padding: 7px 16px 0; font-size: 11px; }\n' +
'.codeblock pre { margin: 0; padding: 13px 16px; overflow-x: auto; }\n' +
'.codeblock code { background: none; border: none; padding: 0; color: #e6e9f2; font-size: 13px; }\n' +
'figure.fig { margin: 20px 0 26px; }\n' +
'.shot { position: relative; container-type: inline-size; }\n' +
'.shot img { width: 100%; display: block; border: 1px solid #dfe2ea; border-radius: 10px; box-shadow: 0 2px 10px rgba(15,20,40,.06); }\n' +
'.pin { position: absolute; width: 24px; height: 24px; transform: translate(-50%,-50%); border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; border: 2px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,.4); text-decoration: none; }\n' +
'.pin:hover { box-shadow: 0 0 0 3px rgba(' + rgb + ',.35), 0 1px 5px rgba(0,0,0,.4); }\n' +
'figcaption { color: #5b6172; font-size: 13px; margin-top: 9px; }\n' +
'figcaption b { color: #1e2430; }\n' +
'.legend { list-style: none; margin: 10px 0 0; padding: 10px 0 0; border-top: 1px dashed #e2e5ec; font-size: 13.5px; }\n' +
'.legend li { display: flex; gap: 9px; padding: 4px 0; }\n' +
'.legend .ln { flex: 0 0 auto; background: var(--accent); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; margin-top: 3px; }\n' +
'.legend .ld { color: #5b6172; }\n' +
'.legend .plink { color: var(--accent); text-decoration: none; }\n' +
'.legend .plink:hover { text-decoration: underline; }\n' +
'.legend li:target, .legend li.flash { animation: edflash 1.8s ease-out; }\n' +
'@keyframes edflash { 0% { background: rgba(' + rgb + ',.18); } 100% { background: transparent; } }\n' +
'.callout { display: flex; margin: 14px 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e5ec; }\n' +
'.callout .co-bar { width: 4px; flex: 0 0 auto; }\n' +
'.callout .co-body { padding: 9px 14px 10px; flex: 1; }\n' +
'.callout .co-k { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 1px; }\n' +
'.co-info { border-color: #d7e3f8; background: #f3f7fd; } .co-info .co-bar { background: #2f6fd0; } .co-info .co-k { color: #2f6fd0; }\n' +
'.co-tip { border-color: #d3ecd9; background: #f2faf4; } .co-tip .co-bar { background: #2c8a4b; } .co-tip .co-k { color: #2c8a4b; }\n' +
'.co-warning { border-color: #f2e3c3; background: #fdf7e8; } .co-warning .co-bar { background: #a26d10; } .co-warning .co-k { color: #a26d10; }\n' +
'.co-danger { border-color: #f0d2d2; background: #fdf3f3; } .co-danger .co-bar { background: #b3372f; } .co-danger .co-k { color: #b3372f; }\n' +
'table.tbl { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 14px; }\n' +
'.tbl th { background: #f4f5f9; text-align: left; font-weight: 600; }\n' +
'.tbl th, .tbl td { border: 1px solid #e2e5ec; padding: 7px 11px; vertical-align: top; }\n' +
'.tbl tr:nth-child(even) td { background: #fafbfd; }\n' +
'hr.div { border: none; border-top: 1px solid #e2e5ec; margin: 26px 0; }\n' +
'mark { background: #ffe9a8; border-radius: 3px; padding: 0 1px; }\n' +
'mark.cur { background: #ffc93c; }\n' +
'footer.gen { margin-top: 70px; padding-top: 14px; border-top: 1px solid #e6e8ee; color: #9096a6; font-size: 12px; }\n' +
'#printbtn { position: fixed; right: 22px; bottom: 22px; background: var(--accent); color: #fff; border: none; border-radius: 999px; padding: 11px 18px; font: 600 13px -apple-system, "Segoe UI", Roboto, sans-serif; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.22); }\n' +
'#menubtn { display: none; position: fixed; left: 14px; top: 12px; z-index: 60; background: #fff; border: 1px solid #d8dbe4; border-radius: 8px; padding: 7px 12px; font: 600 13px -apple-system, "Segoe UI", Roboto, sans-serif; cursor: pointer; }\n' +
'.print-toc { display: none; }\n' +
'@media (max-width: 900px) {\n' +
'  #side { transform: translateX(-100%); transition: transform .2s; z-index: 50; }\n' +
'  #side.open { transform: none; }\n' +
'  main { margin-left: 0; }\n' +
'  #menubtn { display: block; }\n' +
'  .wrap { padding: 56px 22px 0; }\n' +
'  main > .wrap:last-of-type { padding-bottom: 90px; }\n' +
'  .part-in { padding: 38px 22px 34px; }\n' +
'}\n' +
'@media print {\n' +
'  #side, #printbtn, #menubtn { display: none !important; }\n' +
'  main { margin: 0; display: block; }\n' +
'  .wrap { max-width: none; padding: 0; }\n' +
'  body { font-size: 11.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n' +
'  .cover { border-bottom: none; padding: 140px 0 0; break-after: page; }\n' +
'  .cover h1 { font-size: 34pt; }\n' +
'  .print-toc { display: block; break-after: page; }\n' +
'  .print-toc h2 { font-size: 20pt; margin: 0 0 14pt; }\n' +
'  .print-toc ol { list-style: none; padding: 0; font-size: 12pt; }\n' +
'  .print-toc ol ol { padding-left: 18pt; font-size: 10.5pt; }\n' +
'  .print-toc a { color: #1e2430; text-decoration: none; }\n' +
'  section.page { padding-top: 0; }\n' +
'  section.page ~ section.page:not(.sec) { break-before: page; }\n' +
'  section.page.sec h1 { break-after: avoid; }\n' +
'  .print-toc + section.page { break-before: page; }\n' +
'  section.part { break-before: page; break-after: page; margin: 34vh 0; }\n' +
'  .print-toc li.pgrp { margin-top: 8pt; font-weight: 700; text-transform: uppercase; font-size: 10pt; letter-spacing: .06em; }\n' +
'  figure.fig, .callout, .codeblock, table.tbl { break-inside: avoid; }\n' +
'  .codeblock pre { white-space: pre-wrap; }\n' +
'}\n' +
'@page { size: A4; margin: 17mm 16mm; }\n';
}

function docJS() {
  return '\n' +
'(function () {\n' +
'  var side = document.getElementById("side");\n' +
'  var mb = document.getElementById("menubtn");\n' +
'  if (mb) mb.addEventListener("click", function () { side.classList.toggle("open"); });\n' +
'  var pb = document.getElementById("printbtn");\n' +
'  if (pb) pb.addEventListener("click", function () { window.print(); });\n' +
'\n' +
'  var links = [].slice.call(document.querySelectorAll("#toc a"));\n' +
'  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });\n' +
'  function spy() {\n' +
'    var cur = -1;\n' +
'    for (var i = 0; i < targets.length; i++) {\n' +
'      if (targets[i] && targets[i].getBoundingClientRect().top < 140) cur = i;\n' +
'    }\n' +
'    links.forEach(function (a, i) { a.classList.toggle("on", i === cur); });\n' +
'  }\n' +
'  window.addEventListener("scroll", spy, { passive: true });\n' +
'  spy();\n' +
'\n' +
'  document.addEventListener("click", function (e) {\n' +
'    var a = e.target.closest ? e.target.closest("a") : null;\n' +
'    if (!a) return;\n' +
'    var href = a.getAttribute("href") || "";\n' +
'    if (href.charAt(0) !== "#") return;\n' +
'    var t = document.getElementById(href.slice(1));\n' +
'    if (!t) return;\n' +
'    t.classList.remove("flash");\n' +
'    void t.offsetWidth;\n' +
'    t.classList.add("flash");\n' +
'    if (side && side.classList.contains("open")) side.classList.remove("open");\n' +
'  });\n' +
'\n' +
'  var q = document.getElementById("q");\n' +
'  var srBar = document.getElementById("srbar");\n' +
'  var srCount = document.getElementById("srcount");\n' +
'  var wrap = document.querySelector("main");\n' +
'  var marks = [], mi = -1, deb = null;\n' +
'\n' +
'  function clearMarks() {\n' +
'    marks.forEach(function (m) {\n' +
'      var p = m.parentNode;\n' +
'      if (!p) return;\n' +
'      p.replaceChild(document.createTextNode(m.textContent), m);\n' +
'      p.normalize();\n' +
'    });\n' +
'    marks = []; mi = -1;\n' +
'  }\n' +
'\n' +
'  function go(i) {\n' +
'    if (!marks.length) return;\n' +
'    if (mi >= 0 && marks[mi]) marks[mi].classList.remove("cur");\n' +
'    mi = ((i % marks.length) + marks.length) % marks.length;\n' +
'    marks[mi].classList.add("cur");\n' +
'    marks[mi].scrollIntoView({ block: "center" });\n' +
'    srCount.textContent = (mi + 1) + " / " + marks.length;\n' +
'  }\n' +
'\n' +
'  function doSearch() {\n' +
'    clearMarks();\n' +
'    var term = q.value.trim().toLowerCase();\n' +
'    var lis = [].slice.call(document.querySelectorAll("#toc li"));\n' +
'    if (!term) { lis.forEach(function (li) { li.classList.remove("hide"); }); }\n' +
'    else {\n' +
'      lis.forEach(function (li) { li.classList.add("hide"); });\n' +
'      links.forEach(function (a) {\n' +
'        if (a.textContent.toLowerCase().indexOf(term) < 0) return;\n' +
'        var n = a.parentElement;\n' +
'        while (n && n.id !== "toc") { if (n.tagName === "LI") n.classList.remove("hide"); n = n.parentElement; }\n' +
'      });\n' +
'    }\n' +
'    if (term.length >= 2) {\n' +
'      var walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null);\n' +
'      var nodes = [];\n' +
'      while (walker.nextNode()) {\n' +
'        var nd = walker.currentNode;\n' +
'        if (!nd.nodeValue.trim()) continue;\n' +
'        var pe = nd.parentElement;\n' +
'        if (!pe || pe.closest("script,style,.print-toc,mark")) continue;\n' +
'        if (nd.nodeValue.toLowerCase().indexOf(term) > -1) nodes.push(nd);\n' +
'      }\n' +
'      var safe = term.replace(/[.*+?^\x24{}()|[\\]\\\\]/g, "\\\\$&");\n' +
'      nodes.forEach(function (nd) {\n' +
'        var parts = nd.nodeValue.split(new RegExp("(" + safe + ")", "ig"));\n' +
'        if (parts.length < 2) return;\n' +
'        var frag = document.createDocumentFragment();\n' +
'        parts.forEach(function (pt) {\n' +
'          if (pt.toLowerCase() === term) {\n' +
'            var m = document.createElement("mark");\n' +
'            m.textContent = pt;\n' +
'            frag.appendChild(m);\n' +
'            marks.push(m);\n' +
'          } else if (pt) frag.appendChild(document.createTextNode(pt));\n' +
'        });\n' +
'        nd.parentNode.replaceChild(frag, nd);\n' +
'      });\n' +
'    }\n' +
'    srBar.classList.toggle("on", !!term);\n' +
'    srCount.textContent = marks.length ? marks.length + " matches" : (term.length >= 2 ? "No matches" : "");\n' +
'  }\n' +
'\n' +
'  if (q) {\n' +
'    q.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(doSearch, 250); });\n' +
'    q.addEventListener("keydown", function (e) {\n' +
'      if (e.key === "Enter") { e.preventDefault(); if (!marks.length) doSearch(); go(e.shiftKey ? mi - 1 : mi + 1); }\n' +
'    });\n' +
'    document.getElementById("srnext").addEventListener("click", function () { go(mi + 1); });\n' +
'    document.getElementById("srprev").addEventListener("click", function () { go(mi - 1); });\n' +
'  }\n' +
'})();\n';
}

function buildExportHTML(project) {
  var p = project;
  var accent = p.accent || '#4f46e5';
  var annIdx = buildAnnIndex(p);
  var figNos = {};
  var fn = 0;
  p.pages.forEach(function (pg) {
    pg.blocks.forEach(function (b) { if (b.type === 'image') { fn++; figNos[b.id] = fn; } });
  });
  var pageIds = {};
  p.pages.forEach(function (pg) { pageIds[pg.id] = true; });

  function headingItems(pg, prefix) {
    return pg.blocks.filter(isH2Block).map(function (h, j) {
      return '<li><a href="#hd-' + h.id + '">' + prefix + '.' + (j + 1) + ' ' +
        escapeHtml(h.text || '') + '</a></li>';
    }).join('');
  }

  function renderDocPage(pg, num, depth) {
    var hIdx = 0;
    var cls = depth === 0 ? '' : depth === 1 ? ' ps' : ' ps2';
    var out = '<section class="page' + (depth ? ' sec' : '') + '" id="pg-' + pg.id + '">' +
      '<h1 class="pt' + cls + '"><span class="secno">' + num +
      (depth ? '' : '.') + '</span> ' + escapeHtml(pg.title || 'Untitled') + '</h1>';
    pg.blocks.forEach(function (b) {
      if (isH2Block(b)) hIdx++;
      out += renderDocBlock(b, { annIdx: annIdx, figNos: figNos, pageIds: pageIds, secno: num + '.' + hIdx });
    });
    return out + '</section>';
  }

  function walkPage(node, num, depth) {
    var childBase = node.page.blocks.filter(isH2Block).length;
    var sub = headingItems(node.page, num);
    var printSub = sub;
    var pageBody = renderDocPage(node.page, num, depth);
    node.children.forEach(function (cn, k) {
      var r = walkPage(cn, num + '.' + (childBase + k + 1), depth + 1);
      sub += r.toc;
      printSub += r.print;
      pageBody += r.body;
    });
    var link = '<a href="#pg-' + node.page.id + '">' + num + (depth ? ' ' : '. ') +
      escapeHtml(node.page.title || 'Untitled') + '</a>';
    return {
      toc: '<li>' + link + (sub ? '<ul>' + sub + '</ul>' : '') + '</li>',
      print: '<li>' + link + (printSub ? '<ol>' + printSub + '</ol>' : '') + '</li>',
      body: pageBody
    };
  }

  var toc = '';
  var printToc = '';
  var body = '';
  var pn = 0;
  pageTree(p).forEach(function (node) {
    if (node.page.kind === 'group') {
      var gt = escapeHtml(node.page.title || 'Group');
      var inTocSub = '';
      var inPrintSub = '';
      var inBody = '';
      node.children.forEach(function (cn) {
        pn++;
        var cr = walkPage(cn, String(pn), 0);
        inTocSub += cr.toc;
        inPrintSub += cr.print;
        inBody += cr.body;
      });
      var members = node.children.map(function (cn) {
        return escapeHtml(cn.page.title || 'Untitled');
      }).join(' &#183; ');
      toc += '<li class="tgrp"><a href="#pg-' + node.page.id + '">' + gt + '</a>' +
        (inTocSub ? '<ul>' + inTocSub + '</ul>' : '') + '</li>';
      printToc += '<li class="pgrp"><a href="#pg-' + node.page.id + '">' + gt + '</a>' +
        (inPrintSub ? '<ol>' + inPrintSub + '</ol>' : '') + '</li>';
      body += '</div><section class="part" id="pg-' + node.page.id + '"><div class="part-in">' +
        '<h1>' + gt + '</h1>' +
        (members ? '<div class="p-pages">' + members + '</div>' : '') +
        '</div></section><div class="wrap">' + inBody;
      return;
    }
    pn++;
    var r = walkPage(node, String(pn), 0);
    toc += r.toc;
    printToc += r.print;
    body += r.body;
  });

  var meta = '';
  if (p.author) meta += '<div><span>Author</span>' + escapeHtml(p.author) + '</div>';
  if (p.version) meta += '<div><span>Version</span>' + escapeHtml(p.version) + '</div>';
  if (p.date) meta += '<div><span>Date</span>' + escapeHtml(p.date) + '</div>';

  var sideSub = [p.version ? 'v' + p.version : '', p.date || ''].filter(Boolean).join(' - ');

  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + escapeHtml(p.title || 'Document') + '</title>\n' +
    '<link rel="icon" href="' + docFavicon(accent) + '">\n' +
    '<style>' + docCSS(accent) + '</style>\n</head>\n<body>\n' +
    '<nav id="side">' +
    '<div class="side-title">' + escapeHtml(p.title || 'Document') + '</div>' +
    '<div class="side-sub">' + escapeHtml(sideSub) + '</div>' +
    '<input id="q" type="search" placeholder="Search this document">' +
    '<div class="sr-bar" id="srbar"><button id="srprev">Prev</button><button id="srnext">Next</button><span id="srcount"></span></div>' +
    '<ul id="toc">' + toc + '</ul>' +
    '</nav>\n' +
    '<button id="menubtn">Contents</button>\n' +
    '<main><div class="wrap">\n' +
    '<header class="cover">' +
    (p.logo ? '<img class="logo" src="' + p.logo + '" alt="logo">' : '') +
    '<h1>' + escapeHtml(p.title || 'Document') + '</h1>' +
    (p.subtitle ? '<p class="sub">' + escapeHtml(p.subtitle) + '</p>' : '') +
    (meta ? '<div class="meta">' + meta + '</div>' : '') +
    '</header>\n' +
    '<section class="print-toc"><h2>Contents</h2><ol>' + printToc + '</ol></section>\n' +
    body + '\n' +
    '<footer class="gen">Generated with EasyDocs on ' + todayForFooter() + '</footer>\n' +
    '</div></main>\n' +
    '<button id="printbtn">Print or save as PDF</button>\n' +
    '<script>' + docJS() + '</script>\n</body>\n</html>\n';
}

function todayForFooter() {
  return new Date().toISOString().slice(0, 10);
}

/* Node hook for smoke tests. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildExportHTML: buildExportHTML,
    transformRefs: transformRefs,
    buildAnnIndex: buildAnnIndex,
    escapeHtml: escapeHtml,
    slugify: slugify,
    chipHtml: chipHtml,
    pageTree: pageTree
  };
}
