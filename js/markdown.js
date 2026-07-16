/* EasyDocs: small Markdown to blocks converter. No dependency, covers the
   common subset: headings, paragraphs, lists, code fences, quotes, tables,
   dividers, and inline bold, italic, code, and links. */

function mdInline(t) {
  var s = escapeHtml(t);
  s = s.replace(/`([^`]+)`/g, function (m, c) { return '<code>' + c + '</code>'; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1 (image)</a>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

var MD_CALLOUT_KINDS = {
  note: 'info', info: 'info', tip: 'tip', hint: 'tip',
  warning: 'warning', caution: 'warning', important: 'warning', danger: 'danger'
};

function markdownToBlocks(text) {
  var blocks = [];
  var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  var para = [];
  var i = 0;

  function flushPara() {
    if (para.length) {
      blocks.push({ id: uid(), type: 'paragraph', html: mdInline(para.join(' ')) });
      para = [];
    }
  }

  while (i < lines.length) {
    var line = lines[i];
    var m;

    if ((m = /^```(\S*)\s*$/.exec(line))) {
      flushPara();
      var lang = m[1];
      var code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ id: uid(), type: 'code', lang: lang, code: code.join('\n') });
      continue;
    }

    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushPara();
      blocks.push({ id: uid(), type: 'divider' });
      i++;
      continue;
    }

    if ((m = /^(#{2,6})\s+(.*)$/.exec(line))) {
      flushPara();
      blocks.push({ id: uid(), type: 'heading', level: m[1].length === 2 ? 2 : 3, text: m[2].trim() });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      var q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      var kind = 'info';
      if (q.length && /^\[!\w+\]\s*$/.test(q[0].trim())) {
        var k = q.shift().trim().replace(/^\[!|\]$/g, '').toLowerCase();
        kind = MD_CALLOUT_KINDS[k] || 'info';
      }
      blocks.push({ id: uid(), type: 'callout', kind: kind, html: mdInline(q.join(' ').trim()) });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      flushPara();
      var ordered = /^\s*\d/.test(line);
      var items = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        i++;
      }
      blocks.push({
        id: uid(), type: 'list', ordered: ordered,
        html: items.map(function (t) { return '<li>' + mdInline(t) + '</li>'; }).join('')
      });
      continue;
    }

    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flushPara();
      var parseRow = function (l) {
        return l.replace(/^\s*\||\|\s*$/g, '').split('|').map(function (c) { return mdInline(c.trim()); });
      };
      var rows = [parseRow(line)];
      i += 2;
      while (i < lines.length && /^\|.*\|/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      var cols = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      rows = rows.map(function (r) { while (r.length < cols) r.push(''); return r; });
      blocks.push({ id: uid(), type: 'table', header: true, rows: rows });
      continue;
    }

    if (!line.trim()) { flushPara(); i++; continue; }

    para.push(line.trim());
    i++;
  }

  flushPara();
  if (!blocks.length) blocks.push({ id: uid(), type: 'paragraph', html: '' });
  return blocks;
}

/* Splits a Markdown file into pages on level-1 headings.
   Returns { title, pages }. Text before the first heading, or a document
   without level-1 headings, becomes a single page. */
function markdownToPages(md) {
  var text = String(md || '').replace(/\r\n?/g, '\n');
  var parts = [];
  var cur = { title: '', body: [] };
  var inFence = false;
  text.split('\n').forEach(function (line) {
    if (/^```/.test(line)) inFence = !inFence;
    var m = !inFence && /^#\s+(.*)$/.exec(line);
    if (m) { parts.push(cur); cur = { title: m[1].trim(), body: [] }; }
    else cur.body.push(line);
  });
  parts.push(cur);

  var docTitle = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].title) { docTitle = parts[i].title; break; }
  }

  var pages = [];
  parts.forEach(function (part) {
    var bodyText = part.body.join('\n').trim();
    if (!part.title && !bodyText) return;
    pages.push({ id: uid(), title: part.title || 'Introduction', blocks: markdownToBlocks(bodyText) });
  });
  if (!pages.length) {
    pages.push({ id: uid(), title: 'Content', blocks: [{ id: uid(), type: 'paragraph', html: '' }] });
  }
  return { title: docTitle, pages: pages };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { markdownToBlocks: markdownToBlocks, markdownToPages: markdownToPages, mdInline: mdInline };
}
