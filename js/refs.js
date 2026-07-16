/* EasyDocs: the floating text toolbar and the pin reference picker. */

var toolsTarget = null;
var savedRange = null;

function initTextTools() {
  var tt = $('#texttools');

  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t.closest && t.closest('#texttools')) return;
    var ed = (t.closest && t.closest('.rich[contenteditable]')) || null;
    if (ed) {
      toolsTarget = ed;
      positionTools();
      tt.hidden = false;
    } else {
      tt.hidden = true;
      toolsTarget = null;
    }
  });

  document.addEventListener('click', function (e) {
    if (tt.hidden) return;
    if (e.target.closest && (e.target.closest('#texttools') || e.target.closest('.rich[contenteditable]'))) return;
    tt.hidden = true;
    toolsTarget = null;
  });

  window.addEventListener('scroll', positionTools, true);
  window.addEventListener('resize', positionTools);

  tt.addEventListener('mousedown', function (e) { e.preventDefault(); });

  tt.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || !toolsTarget) return;
    var cmd = btn.dataset.cmd;
    if (cmd === 'bold') document.execCommand('bold');
    if (cmd === 'italic') document.execCommand('italic');
    if (cmd === 'code') insertInlineCode();
    if (cmd === 'link') {
      var url = prompt('Link address (https://...)');
      if (url) {
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed) document.execCommand('createLink', false, url);
        else document.execCommand('insertHTML', false, '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>');
      }
    }
    if (cmd === 'ref') { captureRange(); openRefPicker(); }
  });
}

function positionTools() {
  var tt = $('#texttools');
  if (tt.hidden || !toolsTarget || !toolsTarget.isConnected) return;
  var r = toolsTarget.getBoundingClientRect();
  var top = r.top - tt.offsetHeight - 6;
  if (top < 8) top = r.bottom + 6;
  tt.style.top = top + 'px';
  tt.style.left = Math.max(8, Math.min(r.left, window.innerWidth - tt.offsetWidth - 12)) + 'px';
}

function insertInlineCode() {
  var sel = window.getSelection();
  if (!sel || sel.isCollapsed || !toolsTarget || !toolsTarget.contains(sel.anchorNode)) return;
  document.execCommand('insertHTML', false, '<code>' + escapeHtml(sel.toString()) + '</code>');
}

function captureRange() {
  var sel = window.getSelection();
  if (sel && sel.rangeCount && toolsTarget && toolsTarget.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
  } else {
    savedRange = null;
  }
}

/* Reference picker */

function openRefPicker() {
  var all = Store.allAnnotations();
  $('#refEmpty').hidden = all.length > 0;
  $('#refSearch').value = '';
  renderRefList('');
  showModal('#refModal');
  if (all.length) $('#refSearch').focus();
}

function renderRefList(term) {
  var host = $('#refList');
  host.innerHTML = '';
  var all = Store.allAnnotations();
  var q = String(term || '').trim().toLowerCase();
  var lastGroup = null;
  all.forEach(function (item) {
    var hay = (item.ann.name + ' ' + item.ann.desc + ' ' + item.page.title + ' ' + (item.block.caption || '')).toLowerCase();
    if (q && hay.indexOf(q) < 0) return;
    var groupKey = item.page.id + '/' + item.block.id;
    if (groupKey !== lastGroup) {
      lastGroup = groupKey;
      var glabel = escapeHtml(item.page.title || 'Untitled') + '  /  Figure ' + item.figNo +
        (item.block.caption ? ': ' + escapeHtml(item.block.caption) : '');
      host.appendChild(el('div', 'ref-group', glabel));
    }
    var row = el('button', 'ref-item');
    row.innerHTML = '<span class="rn">' + item.num + '</span><span class="rt"><b>' +
      escapeHtml(item.ann.name || 'Pin ' + item.num) + '</b>' +
      (item.ann.desc ? ' <span class="rd">' + escapeHtml(item.ann.desc) + '</span>' : '') + '</span>';
    row.addEventListener('click', function () { insertChip(item.ann.id); });
    host.appendChild(row);
  });
  if (!host.children.length && q) {
    host.appendChild(el('div', 'ref-group', 'No pins match "' + escapeHtml(term) + '"'));
  }
}

function initRefPicker() {
  $('#refSearch').addEventListener('input', function () {
    renderRefList($('#refSearch').value);
  });
}

function insertChip(annId) {
  closeModal('#refModal');
  var info = Store.annotation(annId);
  var target = toolsTarget;
  if (!info || !target || !target.isConnected) return;
  target.focus();
  var sel = window.getSelection();
  sel.removeAllRanges();
  var r = savedRange;
  if (!r || !target.contains(r.startContainer)) {
    r = document.createRange();
    r.selectNodeContents(target);
    r.collapse(false);
  }
  sel.addRange(r);
  r.deleteContents();
  var tmp = el('span', '', chipHtml(annId, info.num, info.ann.name || 'Pin ' + info.num));
  var chip = tmp.firstChild;
  r.insertNode(chip);
  var space = document.createTextNode(' ');
  chip.after(space);
  r.setStartAfter(space);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  chip.dispatchEvent(new Event('input', { bubbles: true }));
  savedRange = null;
}

/* Keeps chip labels and numbers in step with the pins, and flags chips
   whose pin was deleted. */
function syncChips() {
  var changed = [];
  $$('#blocks .ref-chip').forEach(function (ch) {
    var info = Store.annotation(ch.getAttribute('data-ref'));
    if (info) {
      var want = chipInner(info.num, info.ann.name || 'Pin ' + info.num);
      if (ch.innerHTML !== want) { ch.innerHTML = want; markChanged(ch); }
      if (ch.classList.contains('broken')) { ch.classList.remove('broken'); markChanged(ch); }
      ch.title = info.ann.desc || info.ann.name || '';
    } else if (!ch.classList.contains('broken')) {
      ch.classList.add('broken');
      ch.title = 'The pin behind this reference was deleted';
      markChanged(ch);
    }
  });

  function markChanged(ch) {
    var blockEl = ch.closest('.block');
    if (blockEl && changed.indexOf(blockEl) < 0) changed.push(blockEl);
  }

  if (!changed.length) return;
  changed.forEach(function (blockEl) {
    var b = Store.block(blockEl.dataset.id);
    if (!b) return;
    if (b.type === 'paragraph' || b.type === 'callout') {
      var ed = blockEl.querySelector('.ed[contenteditable]');
      if (ed) b.html = ed.innerHTML;
    } else if (b.type === 'list') {
      var list = blockEl.querySelector('ol.listed, ul.listed');
      if (list) b.html = list.innerHTML;
    } else if (b.type === 'table') {
      var cells = blockEl.querySelectorAll('.tbl-ed tr');
      Array.prototype.forEach.call(cells, function (tr, rIdx) {
        Array.prototype.forEach.call(tr.children, function (td, cIdx) {
          if (b.rows[rIdx]) b.rows[rIdx][cIdx] = td.innerHTML;
        });
      });
    }
  });
  queueSave();
}
