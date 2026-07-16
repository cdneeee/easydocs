/* EasyDocs: the home screen, a manager for the documents in this browser. */

function fmtWhen(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var today = new Date();
  var sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return 'today ' + d.toTimeString().slice(0, 5);
  return d.toISOString().slice(0, 10);
}

function renderHome() {
  return DB.all().then(function (docs) {
    docs.sort(function (a, b) {
      if (!!b.example !== !!a.example) return a.example ? -1 : 1;
      return (b.updated || 0) - (a.updated || 0);
    });
    var grid = $('#docGrid');
    grid.innerHTML = '';
    $('#homeEmpty').hidden = docs.length > 0;
    docs.forEach(function (d, i) {
      var card = docCard(d);
      if (!reduceMotion) {
        card.classList.add('card-in');
        card.style.animationDelay = (Math.min(i, 12) * 40) + 'ms';
      }
      grid.appendChild(card);
    });
  });
}

function docCard(d) {
  var pages = (d.pages || []).length;
  var card = el('div', 'doc-card');
  card.innerHTML =
    '<div class="dc-accent" style="background:' + (d.accent || '#4f46e5') + '"></div>' +
    (d.example ? '<span class="dc-tag">Example</span>' : '') +
    '<h3>' + escapeHtml(d.title || 'Untitled') + '</h3>' +
    (d.subtitle ? '<p class="dc-sub">' + escapeHtml(d.subtitle) + '</p>' : '') +
    '<p class="dc-meta">' + pages + (pages === 1 ? ' page' : ' pages') + ' &#183; edited ' + fmtWhen(d.updated) + '</p>';

  var acts = el('div', 'dc-acts');

  var dup = el('button', 'icon-btn', icon('copy'));
  dup.title = 'Duplicate';
  dup.addEventListener('click', function (e) {
    e.stopPropagation();
    var copy = deepClone(d);
    copy.id = uid();
    delete copy.example;
    copy.title = (copy.title || 'Untitled') + ' copy';
    copy.updated = Date.now();
    DB.put(copy).then(renderHome);
  });

  acts.appendChild(dup);

  if (!d.example) {
    var del = el('button', 'icon-btn', icon('trash'));
    del.title = 'Delete';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      var backup = deepClone(d);
      DB.del(d.id).then(renderHome).then(function () {
        toastUndo('"' + (backup.title || 'Untitled') + '" deleted', function () {
          DB.put(backup).then(renderHome);
        });
      });
    });
    acts.appendChild(del);
  }
  card.appendChild(acts);
  card.addEventListener('click', function (e) {
    if (e.target.closest('.dc-acts')) return;
    openDocument(d.id);
  });
  return card;
}

function initHome() {
  var dismissed = false;
  try { dismissed = localStorage.getItem('easydocs:backupNote') === '1'; } catch (e) { /* pref only */ }
  if (!dismissed) $('#backupNote').hidden = false;
  $('#backupNoteX').addEventListener('click', function () {
    $('#backupNote').hidden = true;
    try { localStorage.setItem('easydocs:backupNote', '1'); } catch (e) { /* pref only */ }
  });

  $('#homeNew').addEventListener('click', function () {
    var proj = defaultProject();
    DB.put(proj).then(function () { openDocument(proj.id); });
  });

  $('#homeSample').addEventListener('click', function () {
    DB.put(sampleProject()).then(renderHome);
  });

  $('#homeImportJson').addEventListener('click', function () {
    $('#fileJson').value = '';
    $('#fileJson').click();
  });

  $('#homeImportMd').addEventListener('click', function () {
    mdImportMode = 'newdoc';
    $('#fileMd').value = '';
    $('#fileMd').click();
  });
}
