/* EasyDocs: app shell. Screen switching, topbar, page sidebar, settings,
   toasts, file inputs, paste and drop, and startup. */

var mdImportMode = 'newdoc';
var setLogoPending = null;
var dragPageId = null;

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
    Store.project = doc;
    Store.pageId = doc.pages[0].id;
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
  Store.project.pages.forEach(function (pg) {
    var li = el('li', 'page-item' + (pg.id === Store.pageId ? ' cur' : ''));
    li.dataset.id = pg.id;
    li.draggable = true;
    li.appendChild(el('span', 'pi-t', escapeHtml(pg.title || 'Untitled')));

    var del = el('button', 'icon-btn pi-del', icon('trash'));
    del.title = 'Delete page';
    del.addEventListener('click', function (e) { e.stopPropagation(); deletePage(pg.id); });
    li.appendChild(del);

    li.addEventListener('click', function () { switchPage(pg.id); });
    li.addEventListener('dblclick', function () { renamePageInline(li, pg); });

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
      if (!dragPageId || dragPageId === pg.id) return;
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', function () { li.classList.remove('drag-over'); });
    li.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!dragPageId || dragPageId === pg.id) return;
      var pages = Store.project.pages;
      var from = pages.findIndex(function (p) { return p.id === dragPageId; });
      var to = pages.findIndex(function (p) { return p.id === pg.id; });
      if (from < 0 || to < 0) return;
      var moved = pages.splice(from, 1)[0];
      pages.splice(to, 0, moved);
      renderSidebar();
      queueSave();
    });

    list.appendChild(li);
  });
}

function switchPage(id) {
  if (id === Store.pageId) return;
  Store.pageId = id;
  renderSidebar();
  renderPage();
  $('#content').scrollTop = 0;
}

function addPage() {
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
  if (pages.length <= 1) { toast('A document needs at least one page'); return; }
  var i = pages.findIndex(function (p) { return p.id === id; });
  if (i < 0) return;
  var removed = pages.splice(i, 1)[0];
  if (Store.pageId === id) {
    Store.pageId = pages[Math.min(i, pages.length - 1)].id;
    renderPage();
  }
  renderSidebar();
  queueSave();
  toastUndo('Page "' + (removed.title || 'Untitled') + '" deleted', function () {
    pages.splice(Math.min(i, pages.length), 0, removed);
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

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && Store.project) persistNow();
    });

    if (DB.unavailable) {
      toast('Browser storage is not available here. Work is kept in memory only, download .json backups often.', { ms: 9000 });
    }

    DB.all().then(function (docs) {
      if (!docs.length) {
        return DB.put(sampleProject()).catch(function () {});
      }
    }).then(function () {
      return renderHome();
    }).then(function () {
      showScreen('home');
    });
  });
});
