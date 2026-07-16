/* EasyDocs: block rendering, editing, and operations. */

var BLOCK_ORDER = ['paragraph', 'heading', 'list', 'image', 'code', 'callout', 'table', 'divider'];

var BLOCK_DEFS = {
  paragraph: { label: 'Text', icon: 'text' },
  heading: { label: 'Heading', icon: 'h' },
  list: { label: 'List', icon: 'list' },
  image: { label: 'Screenshots', icon: 'image' },
  code: { label: 'Code', icon: 'code' },
  callout: { label: 'Callout', icon: 'info' },
  table: { label: 'Table', icon: 'table' },
  divider: { label: 'Divider', icon: 'minus' }
};

var CALLOUT_KINDS = ['info', 'tip', 'warning', 'danger'];

var _imgInsertAfter = null;

function newBlock(type) {
  var b = { id: uid(), type: type };
  if (type === 'paragraph') b.html = '';
  if (type === 'heading') { b.text = ''; b.level = 2; }
  if (type === 'list') { b.html = '<li></li>'; b.ordered = false; }
  if (type === 'code') { b.code = ''; b.lang = ''; }
  if (type === 'callout') { b.kind = 'info'; b.html = ''; }
  if (type === 'table') { b.header = true; b.rows = [['', ''], ['', '']]; }
  return b;
}

/* Rendering */

function renderPage() {
  var page = Store.page();
  if (!page) return;
  $('#pageTitle').value = page.title || '';
  var wrap = $('#blocks');
  wrap.innerHTML = '';
  page.blocks.forEach(function (b) { wrap.appendChild(renderBlock(b)); });
  if (typeof syncChips === 'function') syncChips();
}

function rerenderBlock(id) {
  var b = Store.block(id);
  var old = $('.block[data-id="' + id + '"]');
  if (b && old) old.replaceWith(renderBlock(b));
  if (typeof syncChips === 'function') syncChips();
}

function renderBlock(b) {
  var wrap = el('div', 'block bt-' + b.type);
  wrap.dataset.id = b.id;
  var body = el('div', 'b-body');
  var renderers = {
    paragraph: bodyParagraph, heading: bodyHeading, list: bodyList, image: bodyImage,
    code: bodyCode, callout: bodyCallout, table: bodyTable, divider: bodyDivider
  };
  renderers[b.type](b, body);

  var ctr = el('div', 'b-ctr');
  addTypeTag(b, ctr);
  ctrBtn(ctr, 'up', 'Move up', function () { moveBlock(b.id, -1); });
  ctrBtn(ctr, 'down', 'Move down', function () { moveBlock(b.id, 1); });
  ctrBtn(ctr, 'plus', 'Insert a block below', function (e) { openBlockMenu(b.id, e.currentTarget); });
  ctrBtn(ctr, 'copy', 'Duplicate', function () { duplicateBlock(b.id); });
  ctrBtn(ctr, 'trash', 'Delete', function () { deleteBlock(b.id); });

  wrap.appendChild(ctr);
  wrap.appendChild(body);
  return wrap;
}

function ctrBtn(ctr, ic, title, fn) {
  var btn = el('button', 'cb', icon(ic));
  btn.title = title;
  btn.addEventListener('click', function (e) { e.stopPropagation(); fn(e); });
  ctr.appendChild(btn);
}

function addTypeTag(b, ctr) {
  if (b.type === 'heading') {
    var ht = el('button', 'cb tag', 'H' + (b.level || 2));
    ht.title = 'Switch between H2 and H3';
    ht.addEventListener('click', function () {
      b.level = (b.level || 2) === 2 ? 3 : 2;
      rerenderBlock(b.id); queueSave();
    });
    ctr.appendChild(ht);
  }
  if (b.type === 'list') {
    var lt = el('button', 'cb tag', b.ordered ? '1.' : '&#8226;');
    lt.title = 'Switch between bullets and numbers';
    lt.addEventListener('click', function () {
      b.ordered = !b.ordered;
      rerenderBlock(b.id); queueSave();
    });
    ctr.appendChild(lt);
  }
}

/* Body renderers */

function bodyParagraph(b, body) {
  var ed = el('div', 'ed rich p-ed');
  ed.contentEditable = 'true';
  ed.setAttribute('data-ph', 'Type text. Select it for bold, links, and pin references.');
  ed.innerHTML = b.html || '';
  ed.addEventListener('input', function () { b.html = ed.innerHTML; queueSave(); });
  ed.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !ed.textContent && !ed.querySelector('img,.ref-chip')) {
      var page = Store.page();
      if (page && page.blocks.length > 1) { e.preventDefault(); removeBlockSilent(b.id); }
    }
  });
  body.appendChild(ed);
}

function bodyHeading(b, body) {
  var h = el((b.level || 2) === 3 ? 'h3' : 'h2', 'ed hd');
  h.contentEditable = 'true';
  h.setAttribute('data-ph', 'Heading');
  h.textContent = b.text || '';
  h.addEventListener('input', function () { b.text = h.textContent; queueSave(); });
  h.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addBlock('paragraph', b.id); }
  });
  body.appendChild(h);
}

function bodyList(b, body) {
  var list = el(b.ordered ? 'ol' : 'ul', 'ed rich listed');
  list.contentEditable = 'true';
  list.innerHTML = b.html || '<li></li>';
  list.addEventListener('input', function () { b.html = list.innerHTML; queueSave(); });
  body.appendChild(list);
}

function bodyCode(b, body) {
  var box = el('div', 'code-ed');
  var lang = el('input', 'lang-in');
  lang.placeholder = 'language';
  lang.value = b.lang || '';
  lang.addEventListener('input', function () { b.lang = lang.value; queueSave(); });
  var pre = el('pre');
  var code = el('code', 'ed');
  code.contentEditable = 'plaintext-only';
  if (code.contentEditable !== 'plaintext-only') code.contentEditable = 'true';
  code.textContent = b.code || '';
  code.addEventListener('input', function () { b.code = code.innerText.replace(/\n$/, ''); queueSave(); });
  code.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  pre.appendChild(code);
  box.appendChild(lang);
  box.appendChild(pre);
  body.appendChild(box);
}

function bodyCallout(b, body) {
  var kind = b.kind || 'info';
  var box = el('div', 'co co-' + kind);
  box.appendChild(el('div', 'co-bar'));
  var inner = el('div', 'co-inner');
  var kbtn = el('button', 'co-kbtn', (typeof CALLOUT_LABELS !== 'undefined' && CALLOUT_LABELS[kind]) || 'Note');
  kbtn.title = 'Change the callout kind';
  kbtn.addEventListener('click', function () {
    var next = CALLOUT_KINDS[(CALLOUT_KINDS.indexOf(b.kind || 'info') + 1) % CALLOUT_KINDS.length];
    b.kind = next;
    rerenderBlock(b.id); queueSave();
  });
  var ed = el('div', 'ed rich co-ed');
  ed.contentEditable = 'true';
  ed.setAttribute('data-ph', 'Callout text');
  ed.innerHTML = b.html || '';
  ed.addEventListener('input', function () { b.html = ed.innerHTML; queueSave(); });
  inner.appendChild(kbtn);
  inner.appendChild(ed);
  box.appendChild(inner);
  body.appendChild(box);
}

function bodyTable(b, body) {
  var t = el('table', 'tbl-ed');
  (b.rows || []).forEach(function (row, r) {
    var tr = el('tr');
    row.forEach(function (cell, cIdx) {
      var td = el(b.header && r === 0 ? 'th' : 'td', 'ed rich');
      td.contentEditable = 'true';
      td.innerHTML = cell || '';
      td.addEventListener('input', function () { b.rows[r][cIdx] = td.innerHTML; queueSave(); });
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  var tools = el('div', 'tbl-tools');
  var cols = function () { return b.rows[0] ? b.rows[0].length : 0; };
  tblBtn(tools, 'Add row', function () {
    b.rows.push(new Array(cols()).fill(''));
  });
  tblBtn(tools, 'Add column', function () {
    b.rows.forEach(function (row) { row.push(''); });
  });
  tblBtn(tools, 'Remove last row', function () {
    if (b.rows.length > 1) b.rows.pop();
  });
  tblBtn(tools, 'Remove last column', function () {
    if (cols() > 1) b.rows.forEach(function (row) { row.pop(); });
  });
  tblBtn(tools, b.header ? 'Header: on' : 'Header: off', function () {
    b.header = !b.header;
  });
  function tblBtn(host, label, fn) {
    var btn = el('button', 'tbl-btn', label);
    btn.addEventListener('click', function () { fn(); rerenderBlock(b.id); queueSave(); });
    host.appendChild(btn);
  }
  body.appendChild(t);
  body.appendChild(tools);
}

function applyPinSize(pin, size) {
  pin.style.width = size + 'px';
  pin.style.height = size + 'px';
  pin.style.fontSize = Math.round(size * 0.5) + 'px';
}

function bodyImage(b, body) {
  var shot = el('div', 'shot-ed');
  shot.style.width = (b.width || 100) + '%';
  shot.title = 'Click to annotate';
  var img = el('img');
  img.src = b.src;
  img.alt = b.caption || '';
  img.draggable = false;
  shot.appendChild(img);
  (b.annotations || []).forEach(function (a, i) {
    var pin = el('span', 'pin', String(i + 1));
    pin.style.left = a.x + '%';
    pin.style.top = a.y + '%';
    applyPinSize(pin, b.pinSize || 24);
    pin.title = a.name || '';
    shot.appendChild(pin);
  });
  shot.addEventListener('click', function () { openAnnotator(b.id); });

  var row = el('div', 'fig-row');
  var cap = el('input', 'cap-in');
  cap.placeholder = 'Caption';
  cap.value = b.caption || '';
  cap.addEventListener('input', function () { b.caption = cap.value; queueSave(); });
  var width = el('input', 'width-in');
  width.type = 'range'; width.min = 30; width.max = 100;
  width.value = b.width || 100;
  width.title = 'Image width';
  width.addEventListener('input', function () {
    b.width = +width.value;
    shot.style.width = b.width + '%';
    queueSave();
  });
  var ann = el('button', 'btn small', icon('pin') + '<span>Annotate</span>');
  ann.addEventListener('click', function () { openAnnotator(b.id); });
  row.appendChild(cap);
  row.appendChild(width);
  row.appendChild(ann);

  body.appendChild(shot);
  body.appendChild(row);
  if ((b.annotations || []).length) body.appendChild(renderLegend(b));
}

function renderLegend(b) {
  var ol = el('ol', 'legend');
  (b.annotations || []).forEach(function (a, i) {
    var li = el('li');
    li.innerHTML = '<span class="ln">' + (i + 1) + '</span><span class="lt"><b>' +
      escapeHtml(a.name || 'Pin ' + (i + 1)) + '</b>' +
      (a.desc ? ' <span class="ld">' + escapeHtml(a.desc) + '</span>' : '') + '</span>';
    ol.appendChild(li);
  });
  return ol;
}

function bodyDivider(b, body) {
  body.appendChild(el('hr', 'div-ed'));
}

/* Block operations */

function focusEnd(node) {
  node.focus();
  var r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  var s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function focusBlockEnd(id) {
  var elB = $('.block[data-id="' + id + '"]');
  if (!elB) return;
  var ed = elB.querySelector('.ed');
  if (ed) focusEnd(ed);
  else elB.scrollIntoView({ block: 'center' });
}

function addBlock(type, afterId) {
  var page = Store.page();
  var b = newBlock(type);
  var idx = page.blocks.length;
  if (afterId) {
    var i = page.blocks.findIndex(function (x) { return x.id === afterId; });
    if (i > -1) idx = i + 1;
  }
  page.blocks.splice(idx, 0, b);
  renderPage(); queueSave();
  focusBlockEnd(b.id);
  return b;
}

function insertBlocksAfter(blocks, afterId) {
  var page = Store.page();
  var idx = page.blocks.length;
  if (afterId) {
    var i = page.blocks.findIndex(function (x) { return x.id === afterId; });
    if (i > -1) idx = i + 1;
  }
  blocks.forEach(function (b, j) { page.blocks.splice(idx + j, 0, b); });
  renderPage(); queueSave();
  if (blocks.length) {
    var first = $('.block[data-id="' + blocks[0].id + '"]');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function moveBlock(id, dir) {
  var page = Store.page();
  var i = page.blocks.findIndex(function (x) { return x.id === id; });
  var j = i + dir;
  if (i < 0 || j < 0 || j >= page.blocks.length) return;
  var tmp = page.blocks[i];
  page.blocks[i] = page.blocks[j];
  page.blocks[j] = tmp;
  renderPage(); queueSave();
  var elB = $('.block[data-id="' + id + '"]');
  if (elB) elB.scrollIntoView({ block: 'nearest' });
}

function duplicateBlock(id) {
  var page = Store.page();
  var i = page.blocks.findIndex(function (x) { return x.id === id; });
  if (i < 0) return;
  var copy = deepClone(page.blocks[i]);
  copy.id = uid();
  if (copy.annotations) copy.annotations.forEach(function (a) { a.id = uid(); });
  page.blocks.splice(i + 1, 0, copy);
  renderPage(); queueSave();
}

function deleteBlock(id) {
  var page = Store.page();
  var i = page.blocks.findIndex(function (x) { return x.id === id; });
  if (i < 0) return;
  var removed = page.blocks.splice(i, 1)[0];
  if (!page.blocks.length) page.blocks.push(newBlock('paragraph'));
  renderPage(); queueSave();
  toastUndo('Block deleted', function () {
    page.blocks.splice(i, 0, removed);
    renderPage(); queueSave();
  });
}

function removeBlockSilent(id) {
  var page = Store.page();
  var i = page.blocks.findIndex(function (x) { return x.id === id; });
  if (i < 0) return;
  page.blocks.splice(i, 1);
  renderPage(); queueSave();
  var prev = page.blocks[Math.max(0, i - 1)];
  if (prev) focusBlockEnd(prev.id);
}

/* Image intake */

function cleanFileName(name) {
  return String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
}

function downscaleImage(file, maxW) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () {
      if (!maxW) { resolve(fr.result); return; }
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth <= maxW) { resolve(fr.result); return; }
        try {
          var scale = maxW / img.naturalWidth;
          var c = document.createElement('canvas');
          c.width = maxW;
          c.height = Math.round(img.naturalHeight * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var keepPng = file.type === 'image/png' || file.type === 'image/gif';
          resolve(keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85));
        } catch (e) { resolve(fr.result); }
      };
      img.onerror = function () { reject(new Error('bad image')); };
      img.src = fr.result;
    };
    fr.onerror = function () { reject(fr.error); };
    fr.readAsDataURL(file);
  });
}

function importImages(fileList, afterId) {
  var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
    return f.type && f.type.indexOf('image/') === 0;
  });
  if (!files.length) return;
  var maxW = Store.project.maxImageWidth;
  if (maxW == null) maxW = 1600;
  Promise.all(files.map(function (f) { return downscaleImage(f, maxW); }))
    .then(function (srcs) {
      var blocks = srcs.map(function (src, i) {
        return { id: uid(), type: 'image', src: src, caption: cleanFileName(files[i].name), width: 100, annotations: [] };
      });
      insertBlocksAfter(blocks, afterId);
      toast(blocks.length === 1 ? 'Screenshot added' : blocks.length + ' screenshots added');
    })
    .catch(function () { toast('Could not read one of the image files'); });
}

/* Add bar and insert menu */

function renderAddbar() {
  var bar = $('#addbar');
  bar.innerHTML = '';
  BLOCK_ORDER.forEach(function (t) {
    var d = BLOCK_DEFS[t];
    var btn = el('button', 'add-btn', icon(d.icon) + '<span>' + d.label + '</span>');
    btn.title = 'Add a ' + d.label.toLowerCase() + ' block';
    btn.addEventListener('click', function () {
      if (t === 'image') {
        _imgInsertAfter = null;
        $('#fileImages').value = '';
        $('#fileImages').click();
      } else {
        addBlock(t);
      }
    });
    bar.appendChild(btn);
  });
  var md = el('button', 'add-btn', icon('md') + '<span>Markdown</span>');
  md.title = 'Convert Markdown into blocks on this page';
  md.addEventListener('click', function () { openMdModal(); });
  bar.appendChild(md);
}

function openBlockMenu(afterId, anchor) {
  var m = $('#blockMenu');
  m.innerHTML = '';
  BLOCK_ORDER.forEach(function (t) {
    var d = BLOCK_DEFS[t];
    var it = el('button', 'menu-item', icon(d.icon) + '<span>' + d.label + '</span>');
    it.addEventListener('click', function () {
      closeBlockMenu();
      if (t === 'image') {
        _imgInsertAfter = afterId;
        $('#fileImages').value = '';
        $('#fileImages').click();
      } else {
        addBlock(t, afterId);
      }
    });
    m.appendChild(it);
  });
  var r = anchor.getBoundingClientRect();
  m.hidden = false;
  var mw = m.offsetWidth || 180;
  m.style.left = Math.min(r.left, window.innerWidth - mw - 12) + 'px';
  m.style.top = Math.min(r.bottom + 4, window.innerHeight - m.offsetHeight - 12) + 'px';
  setTimeout(function () { document.addEventListener('click', closeBlockMenu, { once: true }); }, 0);
}

function closeBlockMenu() {
  $('#blockMenu').hidden = true;
}
