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
    docs.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    var grid = $('#docGrid');
    grid.innerHTML = '';
    $('#homeEmpty').hidden = docs.length > 0;
    docs.forEach(function (d) { grid.appendChild(docCard(d)); });
  });
}

function docCard(d) {
  var pages = (d.pages || []).length;
  var card = el('div', 'doc-card');
  card.innerHTML =
    '<div class="dc-accent" style="background:' + (d.accent || '#4f46e5') + '"></div>' +
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
    copy.title = (copy.title || 'Untitled') + ' copy';
    copy.updated = Date.now();
    DB.put(copy).then(renderHome);
  });

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

  acts.appendChild(dup);
  acts.appendChild(del);
  card.appendChild(acts);
  card.addEventListener('click', function (e) {
    if (e.target.closest('.dc-acts')) return;
    openDocument(d.id);
  });
  return card;
}

function initHome() {
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
