/* EasyDocs: one-click PDF through pdfmake. The block model is mapped
   straight to a pdfmake document definition, so text stays selectable. */

var PDF_CW = 499; /* A4 width in points minus the page margins */

var CO_PDF = {
  info: { bar: '#2f6fd0', bg: '#f3f7fd', label: 'NOTE' },
  tip: { bar: '#2c8a4b', bg: '#f2faf4', label: 'TIP' },
  warning: { bar: '#a26d10', bg: '#fdf7e8', label: 'WARNING' },
  danger: { bar: '#b3372f', bg: '#fdf3f3', label: 'DANGER' }
};

function pdfReady() {
  if (typeof pdfMake === 'undefined' || typeof pdfMake.createPdf !== 'function') return false;
  if (pdfMake.vfs) return true;
  if (typeof vfs !== 'undefined' && vfs) {
    if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
    else pdfMake.vfs = vfs;
    return true;
  }
  return false;
}

/* Parses stored block HTML into pdfmake text runs. */
function htmlToRuns(html, annIdx, accent) {
  if (!html) return [{ text: '' }];
  var root = new DOMParser().parseFromString('<div id="rt">' + html + '</div>', 'text/html').getElementById('rt');
  var runs = [];

  function pushText(text, st) {
    if (!text) return;
    var r = { text: text.replace(/\u00a0/g, ' ') };
    if (st.bold) r.bold = true;
    if (st.italics) r.italics = true;
    if (st.code) { r.background = '#eef0f4'; r.color = '#333a4d'; }
    if (st.link) { r.link = st.link; r.color = accent; r.decoration = 'underline'; }
    runs.push(r);
  }

  function walk(node, st) {
    node.childNodes.forEach(function (ch) {
      if (ch.nodeType === 3) { pushText(ch.nodeValue, st); return; }
      if (ch.nodeType !== 1) return;
      var tag = ch.tagName;
      if (tag === 'BR') { runs.push({ text: '\n' }); return; }
      if (ch.classList && ch.classList.contains('ref-chip')) {
        var id = ch.getAttribute('data-ref');
        var info = annIdx[id];
        if (info) {
          runs.push({ text: info.num + ' ' + info.name, color: accent, bold: true, linkToDestination: 'pin-' + id });
        } else {
          runs.push({ text: ch.textContent, color: '#b3372f' });
        }
        return;
      }
      var st2 = {
        bold: st.bold || tag === 'B' || tag === 'STRONG',
        italics: st.italics || tag === 'I' || tag === 'EM',
        code: st.code || tag === 'CODE',
        link: tag === 'A' ? ch.getAttribute('href') : st.link
      };
      walk(ch, st2);
      if (tag === 'DIV' || tag === 'P') runs.push({ text: '\n' });
    });
  }

  walk(root, {});
  while (runs.length && !String(runs[runs.length - 1].text).trim()) runs.pop();
  return runs.length ? runs : [{ text: '' }];
}

function runsEmpty(runs) {
  return !runs.some(function (r) { return String(r.text).trim(); });
}

/* Draws the numbered pins onto a copy of the screenshot at full resolution. */
function compositeAnnotatedImage(b, accent) {
  return new Promise(function (resolve) {
    var anns = b.annotations || [];
    if (!anns.length) { resolve(b.src); return; }
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        var scale = (b.pinSize || 24) / 24;
        var R = Math.max(7, Math.round(c.width / 58 * scale));
        anns.forEach(function (a, i) {
          var x = a.x / 100 * c.width;
          var y = a.y / 100 * c.height;
          g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2);
          g.fillStyle = accent; g.fill();
          g.lineWidth = Math.max(2, R / 5.5);
          g.strokeStyle = '#ffffff'; g.stroke();
          g.fillStyle = '#ffffff';
          g.font = '700 ' + Math.round(R * 1.05) + 'px Arial';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(String(i + 1), x, y + R * 0.05);
        });
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(b.src); }
    };
    img.onerror = function () { resolve(b.src); };
    img.src = b.src;
  });
}

function pdfBlock(b, ctx) {
  var out = [];
  switch (b.type) {
    case 'paragraph': {
      var runs = htmlToRuns(b.html, ctx.annIdx, ctx.accent);
      if (!runsEmpty(runs)) out.push({ text: runs, style: 'para' });
      break;
    }
    case 'heading': {
      if ((b.level || 2) === 3) {
        out.push({ text: b.text || '', style: 'h3', id: 'hd-' + b.id });
      } else {
        out.push({ text: [{ text: ctx.secno + ' ', color: ctx.accent }, b.text || ''], style: 'h2', id: 'hd-' + b.id });
      }
      break;
    }
    case 'list': {
      var root = new DOMParser().parseFromString('<ul id="rt">' + (b.html || '') + '</ul>', 'text/html').getElementById('rt');
      var items = [];
      root.querySelectorAll(':scope > li').forEach(function (li) {
        items.push({ text: htmlToRuns(li.innerHTML, ctx.annIdx, ctx.accent), margin: [0, 1, 0, 1] });
      });
      if (items.length) {
        var node = { style: 'para', margin: [4, 3, 0, 5] };
        node[b.ordered ? 'ol' : 'ul'] = items;
        out.push(node);
      }
      break;
    }
    case 'code': {
      var codeStack = [];
      if (b.lang) codeStack.push({ text: b.lang, color: '#8d94ab', fontSize: 7.5, margin: [0, 0, 0, 3] });
      codeStack.push({ text: b.code || '', preserveLeadingSpaces: true, fontSize: 8.5, color: '#e6e9f2', lineHeight: 1.35 });
      out.push({
        table: { widths: ['*'], body: [[{ stack: codeStack, fillColor: '#232838', margin: [10, 7, 10, 8] }]] },
        layout: 'noBorders', margin: [0, 5, 0, 8]
      });
      break;
    }
    case 'callout': {
      var k = CO_PDF[b.kind || 'info'] || CO_PDF.info;
      var coRuns = htmlToRuns(b.html, ctx.annIdx, ctx.accent);
      out.push({
        table: {
          widths: [3, '*'],
          body: [[
            { text: '', fillColor: k.bar },
            {
              stack: [
                { text: k.label, color: k.bar, bold: true, fontSize: 7, characterSpacing: 0.6 },
                { text: coRuns, margin: [0, 2, 0, 0] }
              ],
              fillColor: k.bg, margin: [8, 6, 10, 7]
            }
          ]]
        },
        layout: 'noBorders', margin: [0, 6, 0, 8]
      });
      break;
    }
    case 'table': {
      var rows = b.rows || [];
      if (!rows.length || !rows[0].length) break;
      var body = rows.map(function (row, r) {
        return row.map(function (cell) {
          var cellNode = { text: htmlToRuns(cell, ctx.annIdx, ctx.accent), fontSize: 9, margin: [2, 3, 2, 3] };
          if (b.header && r === 0) { cellNode.bold = true; cellNode.fillColor = '#f4f5f9'; }
          return cellNode;
        });
      });
      out.push({
        table: { headerRows: b.header ? 1 : 0, widths: rows[0].map(function () { return '*'; }), body: body },
        layout: {
          hLineWidth: function () { return 0.7; }, vLineWidth: function () { return 0.7; },
          hLineColor: function () { return '#e2e5ec'; }, vLineColor: function () { return '#e2e5ec'; }
        },
        margin: [0, 6, 0, 8]
      });
      break;
    }
    case 'image': {
      if (!b.src) break;
      var fno = ctx.figNos[b.id];
      var w = Math.round(PDF_CW * (b.width || 100) / 100);
      out.push({ image: ctx.comp[b.id] || b.src, fit: [w, 620], margin: [0, 8, 0, 4] });
      out.push({ text: [{ text: 'Figure ' + fno + '.', bold: true }, ' ' + (b.caption || '')], style: 'caption', id: 'fig-' + b.id });
      var anns = b.annotations || [];
      if (anns.length) {
        out.push({
          ol: anns.map(function (a, i) {
            var nameRun = { text: a.name || 'Pin ' + (i + 1), bold: true };
            if (a.pageId && ctx.pageIds && ctx.pageIds[a.pageId]) {
              nameRun.color = ctx.accent;
              nameRun.linkToDestination = 'pg-' + a.pageId;
            }
            var runs = [nameRun];
            if (a.desc) runs.push({ text: '  ' + a.desc, color: '#5b6172' });
            return { text: runs, id: 'pin-' + a.id, margin: [0, 1, 0, 1] };
          }),
          fontSize: 9, margin: [6, 2, 0, 10]
        });
      }
      break;
    }
    case 'divider':
      out.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: PDF_CW, y2: 0, lineWidth: 0.7, lineColor: '#e2e5ec' }],
        margin: [0, 12, 0, 12]
      });
      break;
  }
  return out;
}

function assembleDocDefinition(p, accent, annIdx, comp) {
  var figNos = {};
  var fn = 0;
  p.pages.forEach(function (pg) {
    pg.blocks.forEach(function (b) { if (b.type === 'image') { fn++; figNos[b.id] = fn; } });
  });
  var pageIds = {};
  p.pages.forEach(function (pg) { pageIds[pg.id] = true; });

  var content = [];

  if (p.logo) content.push({ image: p.logo, fit: [170, 64], margin: [0, 120, 0, 40] });
  content.push({ text: p.title || 'Document', fontSize: 30, bold: true, color: accent, margin: [0, p.logo ? 0 : 170, 0, 0] });
  if (p.subtitle) content.push({ text: p.subtitle, fontSize: 13, color: '#5b6172', margin: [0, 10, 0, 0] });
  var meta = [];
  if (p.author) meta.push(['AUTHOR', p.author]);
  if (p.version) meta.push(['VERSION', p.version]);
  if (p.date) meta.push(['DATE', p.date]);
  if (meta.length) {
    content.push({
      table: {
        body: meta.map(function (r) {
          return [
            { text: r[0], color: '#9096a6', fontSize: 7.5, characterSpacing: 1, margin: [0, 3, 16, 0] },
            { text: r[1], fontSize: 10, margin: [0, 1, 0, 1] }
          ];
        })
      },
      layout: 'noBorders', margin: [0, 34, 0, 0]
    });
  }

  content.push({ toc: { title: { text: 'Contents', style: 'h1' } }, pageBreak: 'before' });

  function pdfPage(pg, num, depth) {
    content.push({
      text: num + (depth ? ' ' : '. ') + (pg.title || 'Untitled'),
      style: depth === 0 ? 'h1' : depth === 1 ? 'h1s' : 'h1ss',
      tocItem: true,
      tocMargin: [depth * 14, 0, 0, 0],
      id: 'pg-' + pg.id,
      pageBreak: 'before'
    });
    var hIdx = 0;
    pg.blocks.forEach(function (b) {
      if (isH2Block(b)) hIdx++;
      var ctx = { annIdx: annIdx, accent: accent, figNos: figNos, comp: comp, pageIds: pageIds, secno: num + '.' + hIdx };
      pdfBlock(b, ctx).forEach(function (node) { content.push(node); });
    });
  }

  function walkPdf(node, num, depth) {
    pdfPage(node.page, num, depth);
    var childBase = node.page.blocks.filter(isH2Block).length;
    node.children.forEach(function (cn, k) {
      walkPdf(cn, num + '.' + (childBase + k + 1), depth + 1);
    });
  }

  var pn = 0;
  pageTree(p).forEach(function (node) {
    if (node.page.kind === 'group') {
      var members = node.children.map(function (cn) {
        return cn.page.title || 'Untitled';
      }).join('  ·  ');
      var stack = [
        {
          text: node.page.title || 'Group', fontSize: 26, bold: true, color: '#1e2430',
          margin: [0, 240, 0, 0], tocItem: true, tocStyle: { bold: true }, id: 'pg-' + node.page.id
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 2, lineColor: accent }], margin: [0, 14, 0, 0] }
      ];
      if (members) stack.push({ text: members, color: '#5b6172', fontSize: 9.5, margin: [0, 12, 0, 0] });
      content.push({ stack: stack, pageBreak: 'before' });
      node.children.forEach(function (cn) {
        pn++;
        walkPdf(cn, String(pn), 0);
      });
      return;
    }
    pn++;
    walkPdf(node, String(pn), 0);
  });

  return {
    content: content,
    pageSize: 'A4',
    pageMargins: [48, 52, 48, 56],
    info: { title: p.title || 'Document', author: p.author || '' },
    header: function (page) {
      if (page === 1) return null;
      return { text: p.title || '', alignment: 'right', margin: [0, 24, 48, 0], fontSize: 8, color: '#9096a6' };
    },
    footer: function (page, total) {
      if (page === 1) return null;
      return { text: page + ' / ' + total, alignment: 'center', margin: [0, 18, 0, 0], fontSize: 8, color: '#9096a6' };
    },
    styles: {
      h1: { fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
      h1s: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] },
      h1ss: { fontSize: 13.5, bold: true, margin: [0, 0, 0, 7] },
      h2: { fontSize: 14, bold: true, margin: [0, 14, 0, 4] },
      h3: { fontSize: 11.5, bold: true, margin: [0, 10, 0, 3] },
      para: { margin: [0, 3, 0, 5] },
      caption: { fontSize: 9, color: '#5b6172', margin: [0, 0, 0, 2] }
    },
    defaultStyle: { fontSize: 10.5, lineHeight: 1.3, color: '#1e2430' }
  };
}

function buildDocDefinition(p) {
  var accent = p.accent || '#4f46e5';
  var annIdx = buildAnnIndex(p);
  var imgBlocks = [];
  p.pages.forEach(function (pg) {
    pg.blocks.forEach(function (b) { if (b.type === 'image' && b.src) imgBlocks.push(b); });
  });
  return Promise.all(imgBlocks.map(function (b) { return compositeAnnotatedImage(b, accent); }))
    .then(function (srcs) {
      var comp = {};
      imgBlocks.forEach(function (b, i) { comp[b.id] = srcs[i]; });
      return assembleDocDefinition(p, accent, annIdx, comp);
    });
}

function downloadPDF() {
  if (!Store.project) return;
  if (!pdfReady()) {
    toast('The PDF engine files are missing from the vendor folder. Opening the print view instead: press Ctrl+P there and choose Save as PDF.', { ms: 9000 });
    var html = buildExportHTML(Store.project);
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url);
    return;
  }
  toast('Building PDF');
  buildDocDefinition(Store.project).then(function (dd) {
    pdfMake.createPdf(dd).download(slugify(Store.project.title) + '.pdf');
  }).catch(function (e) {
    console.error(e);
    toast('PDF build failed: ' + (e && e.message ? e.message : 'unknown error'));
  });
}
