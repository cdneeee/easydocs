/* EasyDocs: app shell. Screen switching, topbar, page sidebar, settings,
   toasts, file inputs, paste and drop, and startup. */

var mdImportMode = 'newdoc';
var setLogoPending = null;
var dragPageId = null;
var selectedGroupId = null;
var collapsedIds = {};
var GROUP_HUES = [244, 168, 28, 336, 275, 150];

/* Small UI helpers */

function toast(msg, opts) {
  opts = opts || {};
  var t = el('div', 'toast');
  t.appendChild(el('span', '', escapeHtml(msg)));
  if (opts.action) {
    var b = el('button', 'toast-act', escapeHtml(opts.action));
    b.addEventListener('click', function () { t.remove(); opts.onAction(); });
    t.appendChild(b);
  }
  $('#toasts').appendChild(t);
  setTimeout(function () {
    t.classList.add('out');
    setTimeout(function () { t.remove(); }, 350);
  }, opts.ms || 4000);
}

function toastUndo(msg, fn) {
  toast(msg, { action: 'Undo', onAction: fn, ms: 6000 });
}

function setSaveState(state) {
  var s = $('#saveState');
  s.classList.toggle('err', state === 'error');
  s.textContent = state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : state === 'error' ? 'Save failed, use Save .json' : '';
}

function downloadFile(name, mime, content) {
  var url = URL.createObjectURL(new Blob([content], { type: mime }));
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

function showModal(sel) { $(sel).hidden = false; }
function closeModal(sel) {
  var m = typeof sel === 'string' ? $(sel) : sel;
  if (m) m.hidden = true;
}

function showScreen(name) {
  $('#home').hidden = name !== 'home';
  $('#editor').hidden = name !== 'editor';
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color || '#4f46e5');
}

/* Document open and close */

function openDocument(id) {
  return DB.get(id).then(function (doc) {
    if (!doc) { toast('Could not open the document'); return; }
    migrateGroupMembership(doc);
    normalizePageOrder(doc);
    if (!doc.pages.some(function (p) { return p.kind !== 'group'; })) {
      doc.pages.push({ id: uid(), title: 'Untitled', blocks: [{ id: uid(), type: 'paragraph', html: '' }] });
    }
    Store.project = doc;
    Store.pageId = doc.pages.find(function (p) { return p.kind !== 'group'; }).id;
    loadCollapsed();
    selectGroup(null);
    applyAccent(doc.accent);
    $('#docTitle').textContent = doc.title || 'Untitled';
    renderSidebar();
    renderAddbar();
    renderPage();
    setSaveState('saved');
    showScreen('editor');
  });
}

function goHome() {
  persistNow().then(function () {
    Store.project = null;
    Store.pageId = null;
    applyAccent('#4f46e5');
    renderHome().then(function () { showScreen('home'); });
  });
}

/* Page sidebar */

function renderSidebar() {
  var list = $('#pageList');
  list.innerHTML = '';
  var byId = {};
  var vls = {};
  var tls = {};
  var hues = {};
  var hasKids = {};
  var gIdx = 0;
  Store.project.pages.forEach(function (pg) { byId[pg.id] = pg; });
  Store.project.pages.forEach(function (pg) {
    if (pg.parentId) hasKids[pg.parentId] = true;
  });
  Store.project.pages.forEach(function (pg) {
    if (pg.kind === 'group') {
      vls[pg.id] = 0;
      hues[pg.id] = GROUP_HUES[gIdx % GROUP_HUES.length];
      gIdx++;
      list.appendChild(groupListItem(pg, hasKids[pg.id], hues[pg.id]));
      return;
    }
    var par = pg.parentId ? byId[pg.parentId] : null;
    vls[pg.id] = par ? Math.min((vls[par.id] || 0) + 1, 3) : 0;
    tls[pg.id] = par && par.kind !== 'group' ? Math.min((tls[par.id] || 0) + 1, 2) : 0;
    hues[pg.id] = par ? hues[par.id] : null;
    list.appendChild(pageListItem(pg, tls[pg.id], vls[pg.id], hasKids[pg.id], hues[pg.id]));
  });
  applyCollapse();
}

function isGroup(pg) { return !!pg && pg.kind === 'group'; }

/* Collapse state is a view preference kept per document in this browser. */

function loadCollapsed() {
  collapsedIds = {};
  try {
    var raw = localStorage.getItem('easydocs:collapsed:' + Store.project.id);
    if (raw) JSON.parse(raw).forEach(function (id) { collapsedIds[id] = true; });
  } catch (e) { /* view pref only */ }
}

function saveCollapsed() {
  try {
    localStorage.setItem('easydocs:collapsed:' + Store.project.id, JSON.stringify(Object.keys(collapsedIds)));
  } catch (e) { /* view pref only */ }
}

function toggleCollapse(id) {
  if (collapsedIds[id]) delete collapsedIds[id];
  else collapsedIds[id] = true;
  saveCollapsed();
  applyCollapse();
}

/* Hides every item that has a collapsed ancestor and marks collapsed
   parents so their arrow rotates. The class change animates through CSS. */
function applyCollapse() {
  var byId = {};
  Store.project.pages.forEach(function (p) { byId[p.id] = p; });
  $$('#pageList > li').forEach(function (li) {
    var pg = byId[li.dataset.id];
    if (!pg) return;
    var hid = false;
    var cur = pg;
    var guard = 0;
    while (cur && cur.parentId && guard++ < 5) {
      if (collapsedIds[cur.parentId]) { hid = true; break; }
      cur = byId[cur.parentId];
    }
    li.classList.toggle('hid', hid);
    li.classList.toggle('clpsd', !!collapsedIds[pg.id]);
  });
}

function selectGroup(id) {
  selectedGroupId = id;
  $$('#pageList .page-group').forEach(function (g) {
    g.classList.toggle('sel', g.dataset.id === id);
  });
  $('#btnAddPage').innerHTML = icon('plus') + '<span>' + (id ? 'Add page to group' : 'Add page') + '</span>';
}

/* Tree helpers over the flat pages array. */

function descendantIdSet(pages, id) {
  var ids = {};
  ids[id] = true;
  for (var pass = 0; pass < 3; pass++) {
    pages.forEach(function (p) {
      if (p.parentId && ids[p.parentId]) ids[p.id] = true;
    });
  }
  delete ids[id];
  return ids;
}

/* Nesting level below a page: page 0, section 1, subsection 2.
   Group ancestors do not count. */
function levelOf(pg) {
  var pages = Store.project.pages;
  var d = 0;
  var cur = pg;
  while (cur && cur.parentId && d < 4) {
    var par = pages.find(function (p) { return p.id === cur.parentId; });
    if (!par || par.kind === 'group') break;
    d++;
    cur = par;
  }
  return d;
}

function subtreeHeight(pg) {
  var kids = Store.childrenOf(pg.id);
  if (!kids.length) return 0;
  return 1 + Math.max.apply(null, kids.map(subtreeHeight));
}

/* Removes a page and everything nested in it, returning the removed run. */
function spliceSubtree(pages, id) {
  var i = pages.findIndex(function (p) { return p.id === id; });
  if (i < 0) return [];
  var desc = descendantIdSet(pages, id);
  var count = 1;
  while (i + count < pages.length && desc[pages[i + count].id]) count++;
  return pages.splice(i, count);
}

/* Drop rules with three zones. Everything drags together with what is
   nested in it. Drop near the top or bottom edge of a target to land
   before or after it as a sibling; drop on its middle to nest inside it,
   whenever the hierarchy allows: groups always stay at the top level,
   nesting below a page is capped at subsections, and a subtree never
   lands inside itself. */
function dropAllowed(target, zone) {
  if (!dragPageId || dragPageId === target.id) return false;
  var pages = Store.project.pages;
  var dragged = pages.find(function (p) { return p.id === dragPageId; });
  if (!dragged) return false;
  if (descendantIdSet(pages, dragged.id)[target.id]) return false;
  if (isGroup(dragged)) {
    if (zone === 'into') return false;
    return isGroup(target) || !target.parentId;
  }
  var h = subtreeHeight(dragged);
  if (zone === 'into') {
    if (isGroup(target)) return true;
    return levelOf(target) + 1 + h <= 2;
  }
  if (isGroup(target)) return true;
  return levelOf(target) + h <= 2;
}

function subtreeEnd(pages, id) {
  var desc = descendantIdSet(pages, id);
  var at = pages.findIndex(function (p) { return p.id === id; }) + 1;
  while (at < pages.length && desc[pages[at].id]) at++;
  return at;
}

function dropPage(target, zone) {
  var pages = Store.project.pages;
  var dragged = pages.find(function (p) { return p.id === dragPageId; });
  if (!dragged) return;
  var moved = spliceSubtree(pages, dragged.id);
  if (!moved.length) return;
  var at;
  if (zone === 'into') {
    dragged.parentId = target.id;
    at = subtreeEnd(pages, target.id);
  } else {
    dragged.parentId = target.parentId || null;
    at = zone === 'before'
      ? pages.findIndex(function (p) { return p.id === target.id; })
      : subtreeEnd(pages, target.id);
  }
  if (at < 0) at = pages.length;
  pages.splice.apply(pages, [at, 0].concat(moved));
  renderSidebar();
  queueSave();
}

var dragZone = 'before';

function clearDropMarks(li) {
  li.classList.remove('drag-over');
  li.classList.remove('drag-after');
  li.classList.remove('drag-into');
}

/* Picks the drop zone from the pointer position: edges mean before or
   after, the middle means nest inside. Falls back to whichever zone the
   hierarchy accepts. */
function pickZone(li, pg, e) {
  var rect = li.getBoundingClientRect();
  var y = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
  var canInto = dropAllowed(pg, 'into');
  var zone = (canInto && y > 0.3 && y < 0.7) ? 'into' : (y < 0.5 ? 'before' : 'after');
  if (dropAllowed(pg, zone)) return zone;
  if (canInto) return 'into';
  var alt = zone === 'before' ? 'after' : 'before';
  if (dropAllowed(pg, alt)) return alt;
  return null;
}

function wireDrag(li, pg) {
  li.addEventListener('dragstart', function (e) {
    dragPageId = pg.id;
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', function () {
    dragPageId = null;
    renderSidebar();
  });
  li.addEventListener('dragover', function (e) {
    var zone = pickZone(li, pg, e);
    if (!zone) return;
    e.preventDefault();
    dragZone = zone;
    clearDropMarks(li);
    li.classList.add(zone === 'into' ? 'drag-into' : zone === 'before' ? 'drag-over' : 'drag-after');
  });
  li.addEventListener('dragleave', function () { clearDropMarks(li); });
  li.addEventListener('drop', function (e) {
    e.preventDefault();
    clearDropMarks(li);
    var zone = pickZone(li, pg, e);
    if (!zone) return;
    dropPage(pg, zone);
  });
}

function collapseToggleEl(pg, hasKids) {
  if (!hasKids) return el('span', 'pi-tg sp');
  var tg = el('button', 'pi-tg', icon('down'));
  tg.title = 'Collapse or expand';
  tg.addEventListener('click', function (e) { e.stopPropagation(); toggleCollapse(pg.id); });
  return tg;
}

function groupListItem(pg, hasKids, hue) {
  var li = el('li', 'page-group gt' + (pg.id === selectedGroupId ? ' sel' : ''));
  li.dataset.id = pg.id;
  li.draggable = true;
  li.style.setProperty('--gh', hue);
  li.appendChild(collapseToggleEl(pg, hasKids));
  li.appendChild(el('span', 'pg-ic', icon('folder')));
  li.appendChild(el('span', 'pi-t', escapeHtml(pg.title || 'Group')));

  var add = el('button', 'icon-btn pi-act', icon('plus'));
  add.title = 'Add a page to this group';
  add.addEventListener('click', function (e) { e.stopPropagation(); addPageInGroup(pg.id); });
  li.appendChild(add);

  var del = el('button', 'icon-btn pi-act', icon('trash'));
  del.title = 'Remove the group label (its pages stay)';
  del.addEventListener('click', function (e) { e.stopPropagation(); deleteGroup(pg.id); });
  li.appendChild(del);

  li.addEventListener('click', function () {
    selectGroup(pg.id === selectedGroupId ? null : pg.id);
  });
  li.addEventListener('dblclick', function () { renamePageInline(li, pg); });
  wireDrag(li, pg);
  return li;
}

function pageListItem(pg, tl, vl, hasKids, hue) {
  var cls = 'page-item' + (pg.id === Store.pageId ? ' cur' : '');
  if (vl > 0) cls += ' lv' + vl;
  if (tl === 1) cls += ' t-sec';
  if (tl === 2) cls += ' t-sub';
  if (hue != null) cls += ' gt';
  var li = el('li', cls);
  li.dataset.id = pg.id;
  li.draggable = true;
  if (hue != null) li.style.setProperty('--gh', hue);
  li.appendChild(collapseToggleEl(pg, hasKids));
  li.appendChild(el('span', 'pi-t', escapeHtml(pg.title || 'Untitled')));

  if (tl < 2) {
    var add = el('button', 'icon-btn pi-act', icon('plus'));
    add.title = tl === 0 ? 'Add a section inside this page' : 'Add a subsection inside this section';
    add.addEventListener('click', function (e) { e.stopPropagation(); addSection(pg.id); });
    li.appendChild(add);
  }

  var del = el('button', 'icon-btn pi-act', icon('trash'));
  del.title = tl === 0 ? 'Delete page and everything inside it' :
    tl === 1 ? 'Delete section and its subsections' : 'Delete subsection';
  del.addEventListener('click', function (e) { e.stopPropagation(); deletePage(pg.id); });
  li.appendChild(del);

  li.addEventListener('click', function () { switchPage(pg.id); });
  li.addEventListener('dblclick', function () { renamePageInline(li, pg); });
  wireDrag(li, pg);
  return li;
}

function addGroup() {
  var pg = { id: uid(), kind: 'group', title: 'New group', blocks: [] };
  Store.project.pages.push(pg);
  renderSidebar();
  queueSave();
  var li = $('#pageList .page-group[data-id="' + pg.id + '"]');
  if (li) {
    li.scrollIntoView({ block: 'nearest' });
    renamePageInline(li, pg);
  }
}

function addPageInGroup(groupId) {
  addSection(groupId);
}

function deleteGroup(id) {
  var pages = Store.project.pages;
  var i = pages.findIndex(function (p) { return p.id === id; });
  if (i < 0) return;
  var members = pages.filter(function (p) { return p.parentId === id; });
  members.forEach(function (p) { p.parentId = null; });
  var removed = pages.splice(i, 1)[0];
  if (selectedGroupId === id) selectGroup(null);
  renderSidebar();
  queueSave();
  toastUndo('Group "' + (removed.title || 'Group') + '" removed, its pages stay', function () {
    pages.splice(Math.min(i, pages.length), 0, removed);
    members.forEach(function (p) { p.parentId = removed.id; });
    renderSidebar();
    queueSave();
  });
}

function addSection(parentId) {
  var pages = Store.project.pages;
  var parent = pages.find(function (p) { return p.id === parentId; });
  if (!parent) return;
  var title;
  if (isGroup(parent)) title = 'New page';
  else if (levelOf(parent) === 0) title = 'New section';
  else if (levelOf(parent) === 1) title = 'New subsection';
  else return;
  var pg = { id: uid(), title: title, parentId: parentId, blocks: [newBlock('paragraph')] };
  pages.splice(subtreeEnd(pages, parentId), 0, pg);
  if (collapsedIds[parentId]) { delete collapsedIds[parentId]; saveCollapsed(); }
  Store.pageId = pg.id;
  renderSidebar();
  renderPage();
  queueSave();
  $('#pageTitle').focus();
  $('#pageTitle').select();
}

function switchPage(id) {
  if (selectedGroupId) selectGroup(null);
  if (id === Store.pageId) return;
  var pg = Store.project.pages.find(function (p) { return p.id === id; });
  if (!pg || isGroup(pg)) return;
  Store.pageId = id;
  renderSidebar();
  renderPage();
  $('#content').scrollTop = 0;
}

function addPage() {
  var grp = selectedGroupId && Store.project.pages.find(function (p) {
    return p.id === selectedGroupId && p.kind === 'group';
  });
  if (grp) { addSection(grp.id); return; }
  var pg = { id: uid(), title: 'New page', blocks: [newBlock('paragraph')] };
  Store.project.pages.push(pg);
  Store.pageId = pg.id;
  renderSidebar();
  renderPage();
  queueSave();
  $('#pageTitle').focus();
  $('#pageTitle').select();
}

function deletePage(id) {
  var pages = Store.project.pages;
  var i = pages.findIndex(function (p) { return p.id === id; });
  if (i < 0) return;
  var desc = descendantIdSet(pages, id);
  var count = 1;
  while (i + count < pages.length && desc[pages[i + count].id]) count++;
  var realLeft = pages.filter(function (p) { return p.kind !== 'group'; }).length - count;
  if (realLeft < 1) { toast('A document needs at least one page'); return; }
  var removed = pages.splice(i, count);
  var removedCurrent = removed.some(function (p) { return p.id === Store.pageId; });
  if (removedCurrent) {
    var next = pages[Math.min(i, pages.length - 1)];
    if (!next || isGroup(next)) next = pages.find(function (p) { return p.kind !== 'group'; });
    Store.pageId = next.id;
    renderPage();
  }
  renderSidebar();
  queueSave();
  var what = removed[0].parentId ? 'Section' : 'Page';
  var msg = what + ' "' + (removed[0].title || 'Untitled') + '"' +
    (count > 1 ? ' and ' + (count - 1) + (count === 2 ? ' nested section' : ' nested sections') : '') + ' deleted';
  toastUndo(msg, function () {
    var at = Math.min(i, pages.length);
    removed.forEach(function (pg, j) { pages.splice(at + j, 0, pg); });
    normalizePageOrder(Store.project);
    renderSidebar();
    queueSave();
  });
}

function renamePageInline(li, pg) {
  var span = li.querySelector('.pi-t');
  if (!span) return;
  var input = el('input', 'pi-edit');
  input.value = pg.title || '';
  span.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = pg.title || ''; input.blur(); }
  });
  input.addEventListener('blur', function () {
    pg.title = input.value.trim() || 'Untitled';
    renderSidebar();
    if (pg.id === Store.pageId) $('#pageTitle').value = pg.title;
    queueSave();
  });
}

/* Settings modal */

function openSettings() {
  var p = Store.project;
  setLogoPending = null;
  $('#setTitle').value = p.title || '';
  $('#setSubtitle').value = p.subtitle || '';
  $('#setAuthor').value = p.author || '';
  $('#setVersion').value = p.version || '';
  $('#setDate').value = p.date || '';
  $('#setAccent').value = p.accent || '#4f46e5';
  $('#setMaxW').value = String(p.maxImageWidth != null ? p.maxImageWidth : 1600);
  var prev = $('#setLogoPrev');
  prev.hidden = !p.logo;
  if (p.logo) prev.src = p.logo;
  $('#setLogoClear').hidden = !p.logo;
  showModal('#setModal');
}

function initSettings() {
  $('#setLogoPick').addEventListener('click', function () {
    $('#fileLogo').value = '';
    $('#fileLogo').click();
  });

  $('#fileLogo').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    downscaleImage(f, 480).then(function (src) {
      setLogoPending = src;
      var prev = $('#setLogoPrev');
      prev.src = src;
      prev.hidden = false;
      $('#setLogoClear').hidden = false;
    }).catch(function () { toast('Could not read the logo file'); });
  });

  $('#setLogoClear').addEventListener('click', function () {
    setLogoPending = '';
    $('#setLogoPrev').hidden = true;
    $('#setLogoClear').hidden = true;
  });

  $('#setSave').addEventListener('click', function () {
    var p = Store.project;
    p.title = $('#setTitle').value.trim() || 'Untitled document';
    p.subtitle = $('#setSubtitle').value.trim();
    p.author = $('#setAuthor').value.trim();
    p.version = $('#setVersion').value.trim();
    p.date = $('#setDate').value;
    p.accent = $('#setAccent').value;
    p.maxImageWidth = +$('#setMaxW').value;
    if (setLogoPending !== null) p.logo = setLogoPending;
    applyAccent(p.accent);
    $('#docTitle').textContent = p.title;
    queueSave();
    closeModal('#setModal');
    toast('Settings saved');
  });
}

/* Markdown modal */

function openMdModal() {
  $('#mdText').value = '';
  showModal('#mdModal');
  $('#mdText').focus();
}

function initMdModal() {
  $('#mdAdd').addEventListener('click', function () {
    var text = $('#mdText').value;
    closeModal('#mdModal');
    if (!text.trim()) return;
    var blocks = markdownToBlocks(text);
    insertBlocksAfter(blocks, null);
    toast(blocks.length + (blocks.length === 1 ? ' block added' : ' blocks added'));
  });

  $('#mdFilePick').addEventListener('click', function () {
    mdImportMode = 'append';
    $('#fileMd').value = '';
    $('#fileMd').click();
  });

  $('#fileMd').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    f.text().then(function (text) {
      if (mdImportMode === 'append') {
        closeModal('#mdModal');
        var blocks = markdownToBlocks(text);
        insertBlocksAfter(blocks, null);
        toast(blocks.length + (blocks.length === 1 ? ' block added from ' : ' blocks added from ') + f.name);
      } else {
        var res = markdownToPages(text);
        var proj = defaultProject(res.title || cleanFileName(f.name) || 'Imported document');
        proj.pages = res.pages;
        DB.put(proj).then(function () { openDocument(proj.id); });
      }
    }).catch(function () { toast('Could not read that file'); });
  });
}

/* Editor zoom. A view preference for this browser, not part of the document. */

var editorZoom = 100;

function applyZoom() {
  $('.page-inner').style.zoom = editorZoom / 100;
  $('#zoomReset').textContent = editorZoom + '%';
  try { localStorage.setItem('easydocs:zoom', String(editorZoom)); } catch (e) { /* view pref only */ }
}

function setZoom(v) {
  editorZoom = clamp(Math.round(v / 10) * 10, 50, 200);
  applyZoom();
}

function initZoom() {
  var saved = 100;
  try { saved = parseInt(localStorage.getItem('easydocs:zoom'), 10) || 100; } catch (e) { /* keep default */ }
  editorZoom = clamp(saved, 50, 200);
  applyZoom();
  $('#zoomIn').addEventListener('click', function () { setZoom(editorZoom + 10); });
  $('#zoomOut').addEventListener('click', function () { setZoom(editorZoom - 10); });
  $('#zoomReset').addEventListener('click', function () { setZoom(100); });
}

/* Topbar */

function initTopbar() {
  $('#btnHome').addEventListener('click', goHome);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#docTitle').addEventListener('click', openSettings);

  $('#btnSaveJson').addEventListener('click', function () {
    persistNow().then(function () {
      downloadFile(slugify(Store.project.title) + '.easydocs.json', 'application/json', JSON.stringify(Store.project));
      toast('Backup file downloaded');
    });
  });

  $('#btnExport').addEventListener('click', function () {
    persistNow().then(function () {
      downloadFile(slugify(Store.project.title) + '.html', 'text/html;charset=utf-8', buildExportHTML(Store.project));
      toast('HTML file downloaded');
    });
  });

  $('#btnPreview').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([buildExportHTML(Store.project)], { type: 'text/html' }));
    window.open(url);
  });

  $('#btnPdf').addEventListener('click', downloadPDF);

  $('#btnAddPage').addEventListener('click', addPage);
  $('#btnAddGroup').addEventListener('click', addGroup);

  $('#pageTitle').addEventListener('input', function () {
    var page = Store.page();
    if (!page) return;
    page.title = this.value;
    var cur = $('#pageList .page-item.cur .pi-t');
    if (cur) cur.textContent = this.value || 'Untitled';
    queueSave();
  });
}

/* Modals, paste, drop, keys */

function initModals() {
  $$('.modal-back').forEach(function (back) {
    back.addEventListener('click', function (e) {
      if (e.target !== back) return;
      if (back.id === 'annoModal') annoState = null;
      back.hidden = true;
    });
  });
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var back = btn.closest('.modal-back');
      if (back.id === 'annoModal') annoState = null;
      back.hidden = true;
    });
  });
}

function initPaste() {
  document.addEventListener('paste', function (e) {
    if ($('#editor').hidden || !Store.project) return;
    if (e.target.closest && e.target.closest('.modal-back')) return;

    var files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) {
      var hasImage = Array.prototype.some.call(files, function (f) { return f.type.indexOf('image/') === 0; });
      if (hasImage) {
        e.preventDefault();
        var active = document.activeElement;
        var blockEl = active && active.closest ? active.closest('.block') : null;
        importImages(files, blockEl ? blockEl.dataset.id : null);
        return;
      }
    }

    var ed = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (ed) {
      e.preventDefault();
      var text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  });
}

function initDrop() {
  var content = $('#content');
  content.addEventListener('dragover', function (e) {
    if (!Store.project) return;
    if (dragPageId) return;
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) {
      e.preventDefault();
      content.classList.add('drop');
    }
  });
  content.addEventListener('dragleave', function (e) {
    if (e.target === content) content.classList.remove('drop');
  });
  content.addEventListener('drop', function (e) {
    content.classList.remove('drop');
    if (!Store.project || dragPageId) return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
      importImages(e.dataTransfer.files, null);
    }
  });
}

function initKeys() {
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = $$('.modal-back').find(function (m) { return !m.hidden; });
      if (open) {
        if (open.id === 'annoModal') annoState = null;
        open.hidden = true;
        return;
      }
      closeBlockMenu();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (Store.project) {
        persistNow().then(function () {
          toast('Saved in this browser. Use Save .json for a file backup.');
        });
      }
    }
  });
}

function initFileInputs() {
  $('#fileImages').addEventListener('change', function () {
    importImages(this.files, _imgInsertAfter);
    _imgInsertAfter = null;
  });

  $('#fileJson').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    f.text().then(function (text) {
      var obj;
      try { obj = JSON.parse(text); } catch (err) { toast('That file is not valid JSON'); return; }
      if (!validProject(obj)) { toast('That file is not an EasyDocs document'); return; }
      obj.id = uid();
      obj.updated = Date.now();
      DB.put(obj).then(function () { openDocument(obj.id); });
    }).catch(function () { toast('Could not read that file'); });
  });
}

/* Startup */

window.addEventListener('DOMContentLoaded', function () {
  var openTimeout = new Promise(function (resolve) {
    setTimeout(function () { resolve('timeout'); }, 2000);
  });
  Promise.race([DB.open(), openTimeout]).then(function (r) {
    if (r === 'timeout' && !DB._db) DB.unavailable = true;
  }).catch(function () { DB.unavailable = true; }).then(function () {
    initZoom();
    initTopbar();
    initHome();
    initModals();
    initSettings();
    initMdModal();
    initFileInputs();
    initAnnotator();
    initTextTools();
    initRefPicker();
    initPaste();
    initDrop();
    initKeys();
    initBlockDrag();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && Store.project) persistNow();
    });

    if (DB.unavailable) {
      toast('Browser storage is not available here. Work is kept in memory only, download .json backups often.', { ms: 9000 });
    }

    DB.all().then(function (docs) {
      var hasExample = docs.some(function (d) { return d.example; });
      if (!hasExample) {
        return DB.put(sampleProject()).catch(function () {});
      }
    }).then(function () {
      return renderHome();
    }).then(function () {
      showScreen('home');
    });
  });
});
