/* EasyDocs: composing helpers. Slash menu, Markdown autoformat, smart
   Enter, and block drag-reorder. Wired from the block renderers in
   blocks.js and initialised once from app.js. */

var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* Flags a freshly inserted block so it animates in once. The class is
   harmless after the animation and is dropped on the next full render. */
function flashNew(id) {
  if (reduceMotion || !id) return;
  var elB = $('.block[data-id="' + id + '"]');
  if (elB) elB.classList.add('b-new');
}

function focusStart(node) {
  node.focus();
  var r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(true);
  var s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function focusBlockStart(id) {
  var elB = $('.block[data-id="' + id + '"]');
  if (!elB) return;
  var ed = elB.querySelector('.ed');
  if (ed) focusStart(ed);
}

/* Turns a block into another type in place, keeping its position. Used by
   the slash menu and the Markdown shortcuts, which fire from an otherwise
   empty paragraph, so dropping its content is intended. Returns the block
   the caret should land in. */
function convertBlock(id, type) {
  var page = Store.page();
  if (!page) return null;
  var i = page.blocks.findIndex(function (b) { return b.id === id; });
  if (i < 0) return null;
  var nb = newBlock(type);
  page.blocks[i] = nb;
  renderPage();
  queueSave();
  flashNew(nb.id);
  if (type === 'divider') return addBlock('paragraph', nb.id);
  focusBlockEnd(nb.id);
  return nb;
}

/* Markdown line shortcuts. Each rule matches the whole content of an empty
   paragraph the moment its trigger is complete. */
var AUTOFORMAT = [
  { re: /^#\s$/, type: 'heading', level: 2 },
  { re: /^##\s$/, type: 'heading', level: 3 },
  { re: /^###\s$/, type: 'heading', level: 3 },
  { re: /^[-*]\s$/, type: 'list', ordered: false },
  { re: /^1\.\s$/, type: 'list', ordered: true },
  { re: /^>\s$/, type: 'callout' },
  { re: /^```$/, type: 'code' },
  { re: /^---$/, type: 'divider' }
];

function tryAutoformat(ed, b) {
  var txt = ed.textContent;
  for (var i = 0; i < AUTOFORMAT.length; i++) {
    var rule = AUTOFORMAT[i];
    if (!rule.re.test(txt)) continue;
    var nb = convertBlock(b.id, rule.type);
    if (!nb) return true;
    if (rule.type === 'heading') { nb.level = rule.level; rerenderBlock(nb.id); focusBlockEnd(nb.id); }
    if (rule.type === 'list') { nb.ordered = rule.ordered; rerenderBlock(nb.id); focusBlockEnd(nb.id); }
    return true;
  }
  return false;
}

/* Slash menu */

var slash = { open: false, ed: null, block: null, items: [], idx: 0 };

function openSlash(ed, b, q) {
  slash.open = true;
  slash.ed = ed;
  slash.block = b;
  slash.idx = 0;
  updateSlash(q || '');
}

function closeSlash() {
  slash.open = false;
  slash.ed = null;
  slash.block = null;
  $('#slashMenu').hidden = true;
}

function caretRect(ed) {
  var s = window.getSelection();
  if (s && s.rangeCount) {
    var rects = s.getRangeAt(0).getClientRects();
    if (rects.length && (rects[0].width || rects[0].height)) return rects[0];
    var rr = s.getRangeAt(0).getBoundingClientRect();
    if (rr && (rr.width || rr.height || rr.top)) return rr;
  }
  return ed.getBoundingClientRect();
}

function positionSlash() {
  var m = $('#slashMenu');
  var r = caretRect(slash.ed);
  var mw = m.offsetWidth || 180;
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 12)) + 'px';
  m.style.top = Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 12) + 'px';
}

function updateSlash(q) {
  var m = $('#slashMenu');
  q = String(q || '').toLowerCase();
  slash.items = BLOCK_ORDER.filter(function (t) {
    return !q || BLOCK_DEFS[t].label.toLowerCase().indexOf(q) === 0 || t.indexOf(q) === 0;
  });
  if (!slash.items.length) { closeSlash(); return; }
  if (slash.idx >= slash.items.length) slash.idx = slash.items.length - 1;
  m.innerHTML = '';
  slash.items.forEach(function (t, i) {
    var d = BLOCK_DEFS[t];
    var it = el('button', 'menu-item' + (i === slash.idx ? ' sel' : ''), icon(d.icon) + '<span>' + d.label + '</span>');
    it.addEventListener('mousedown', function (e) { e.preventDefault(); });
    it.addEventListener('mousemove', function () { slash.idx = i; markSlashSel(); });
    it.addEventListener('click', function () { chooseSlash(t); });
    m.appendChild(it);
  });
  m.hidden = false;
  positionSlash();
}

function markSlashSel() {
  $$('#slashMenu .menu-item').forEach(function (it, i) {
    it.classList.toggle('sel', i === slash.idx);
  });
}

function chooseSlash(type) {
  var b = slash.block;
  closeSlash();
  if (!b) return;
  if (type === 'image') {
    var elB = $('.block[data-id="' + b.id + '"]');
    var ed = elB && elB.querySelector('.ed');
    if (ed) { ed.innerHTML = ''; b.html = ''; queueSave(); }
    _imgInsertAfter = b.id;
    $('#fileImages').value = '';
    $('#fileImages').click();
    return;
  }
  convertBlock(b.id, type);
}

/* Smart Enter: splits the paragraph at the caret into a new block below,
   carrying any text after the caret with it. */
function splitParagraph(ed, b) {
  var tailHtml = '';
  var sel = window.getSelection();
  if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
    var range = sel.getRangeAt(0);
    var tail = range.cloneRange();
    tail.selectNodeContents(ed);
    tail.setStart(range.endContainer, range.endOffset);
    var tmp = el('div');
    tmp.appendChild(tail.extractContents());
    tailHtml = tmp.innerHTML;
  }
  b.html = ed.innerHTML;
  var page = Store.page();
  var nb = newBlock('paragraph');
  nb.html = tailHtml;
  var i = page.blocks.findIndex(function (x) { return x.id === b.id; });
  page.blocks.splice(i + 1, 0, nb);
  renderPage();
  queueSave();
  focusBlockStart(nb.id);
  flashNew(nb.id);
}

/* Attaches slash, autoformat, and smart Enter to a paragraph editable. */
function attachComposer(ed, b) {
  ed.addEventListener('input', function () {
    var t = ed.textContent;
    if (t.charAt(0) === '/' && !/\s/.test(t)) {
      var q = t.slice(1);
      if (slash.open) updateSlash(q); else openSlash(ed, b, q);
      return;
    }
    if (slash.open) closeSlash();
    tryAutoformat(ed, b);
  });

  ed.addEventListener('keydown', function (e) {
    if (slash.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); slash.idx = (slash.idx + 1) % slash.items.length; markSlashSel(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); slash.idx = (slash.idx - 1 + slash.items.length) % slash.items.length; markSlashSel(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseSlash(slash.items[slash.idx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      splitParagraph(ed, b);
    }
  });

  ed.addEventListener('blur', function () {
    setTimeout(function () { if (slash.open && slash.ed === ed) closeSlash(); }, 150);
  });
}

/* Drag handle shown in a block's control cluster. Draggable is turned on
   only while the handle is pressed so text selection stays normal. */
function addGripHandle(wrap, ctr) {
  var g = el('button', 'cb grip', icon('grip'));
  g.title = 'Drag to reorder';
  g.addEventListener('click', function (e) { e.stopPropagation(); });
  g.addEventListener('pointerdown', function () { wrap.setAttribute('draggable', 'true'); });
  g.addEventListener('pointerup', function () { wrap.removeAttribute('draggable'); });
  ctr.appendChild(g);
}

/* Block drag-reorder with a FLIP animation on drop. */

var _dragBlockId = null;
var _dropBlockId = null;
var _dropAfter = false;

function clearBlockDropMarks() {
  $$('#blocks .b-drop-before, #blocks .b-drop-after').forEach(function (elB) {
    elB.classList.remove('b-drop-before', 'b-drop-after');
  });
}

function flipMeasure() {
  var rects = {};
  $$('#blocks .block').forEach(function (elB) { rects[elB.dataset.id] = elB.getBoundingClientRect().top; });
  return rects;
}

function flipPlay(first) {
  if (reduceMotion) return;
  $$('#blocks .block').forEach(function (elB) {
    var was = first[elB.dataset.id];
    if (was == null) return;
    var d = was - elB.getBoundingClientRect().top;
    if (!d) return;
    elB.style.transition = 'none';
    elB.style.transform = 'translateY(' + d + 'px)';
    requestAnimationFrame(function () {
      elB.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      elB.style.transform = '';
    });
    elB.addEventListener('transitionend', function h() {
      elB.style.transition = '';
      elB.removeEventListener('transitionend', h);
    });
  });
}

function moveBlockTo(dragId, targetId, after) {
  var page = Store.page();
  var from = page.blocks.findIndex(function (b) { return b.id === dragId; });
  if (from < 0) return;
  var first = flipMeasure();
  var moved = page.blocks.splice(from, 1)[0];
  var to = page.blocks.findIndex(function (b) { return b.id === targetId; });
  if (to < 0) page.blocks.push(moved);
  else page.blocks.splice(after ? to + 1 : to, 0, moved);
  renderPage();
  queueSave();
  flipPlay(first);
}

function initBlockDrag() {
  var host = $('#blocks');
  if (!host) return;
  host.addEventListener('dragstart', function (e) {
    var blk = e.target.closest && e.target.closest('.block');
    if (!blk || !blk.draggable) return;
    _dragBlockId = blk.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', blk.dataset.id); } catch (_) { /* some browsers */ }
    blk.classList.add('b-dragging');
  });
  host.addEventListener('dragend', function (e) {
    var blk = e.target.closest && e.target.closest('.block');
    if (blk) { blk.draggable = false; blk.classList.remove('b-dragging'); }
    _dragBlockId = null;
    _dropBlockId = null;
    clearBlockDropMarks();
  });
  host.addEventListener('dragover', function (e) {
    if (!_dragBlockId) return;
    var blk = e.target.closest && e.target.closest('.block');
    if (!blk || blk.dataset.id === _dragBlockId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var rect = blk.getBoundingClientRect();
    var after = (e.clientY - rect.top) > rect.height / 2;
    clearBlockDropMarks();
    blk.classList.add(after ? 'b-drop-after' : 'b-drop-before');
    _dropBlockId = blk.dataset.id;
    _dropAfter = after;
  });
  host.addEventListener('drop', function (e) {
    if (!_dragBlockId || !_dropBlockId) { clearBlockDropMarks(); return; }
    e.preventDefault();
    e.stopPropagation();
    moveBlockTo(_dragBlockId, _dropBlockId, _dropAfter);
    _dragBlockId = null;
    _dropBlockId = null;
    clearBlockDropMarks();
  });
}
