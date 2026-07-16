/* EasyDocs: the screenshot annotator. Works on a copy of the pins and
   commits them on Done, so Cancel loses nothing. */

var annoState = null;

function openAnnotator(blockId) {
  var b = Store.block(blockId);
  if (!b || b.type !== 'image') return;
  annoState = { blockId: blockId, anns: deepClone(b.annotations || []), selId: null, pinSize: b.pinSize || 24 };
  $('#annoImg').src = b.src;
  $('#annoSize').value = annoState.pinSize;
  $('#annoSizeVal').textContent = annoState.pinSize + ' px';
  renderAnnoPins();
  renderAnnoList();
  showModal('#annoModal');
}

function renderAnnoPins() {
  var host = $('#annoPins');
  host.innerHTML = '';
  annoState.anns.forEach(function (a, i) {
    host.appendChild(annoPinEl(a, i));
  });
}

function annoPinEl(a, i) {
  var pin = el('span', 'pin big' + (annoState.selId === a.id ? ' sel' : ''), String(i + 1));
  pin.style.left = a.x + '%';
  pin.style.top = a.y + '%';
  applyPinSize(pin, annoState.pinSize);
  pin.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var img = $('#annoImg');
    var startX = ev.clientX, startY = ev.clientY;
    var moved = false;
    function onMove(mv) {
      if (!moved && Math.abs(mv.clientX - startX) + Math.abs(mv.clientY - startY) < 4) return;
      moved = true;
      var rect = img.getBoundingClientRect();
      a.x = Math.round(clamp((mv.clientX - rect.left) / rect.width * 100, 0, 100) * 10) / 10;
      a.y = Math.round(clamp((mv.clientY - rect.top) / rect.height * 100, 0, 100) * 10) / 10;
      pin.style.left = a.x + '%';
      pin.style.top = a.y + '%';
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      selectAnno(a.id, !moved);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  return pin;
}

function selectAnno(id, focusName) {
  annoState.selId = id;
  renderAnnoPins();
  $$('#annoList .anno-item').forEach(function (item) {
    item.classList.toggle('sel', item.dataset.id === id);
  });
  var item = $('#annoList .anno-item[data-id="' + id + '"]');
  if (item) {
    item.scrollIntoView({ block: 'nearest' });
    if (focusName) {
      var name = item.querySelector('.a-name');
      if (name && !name.value) name.focus();
    }
  }
}

function renderAnnoList() {
  var host = $('#annoList');
  host.innerHTML = '';
  $('#annoEmpty').hidden = annoState.anns.length > 0;
  annoState.anns.forEach(function (a, i) {
    var item = el('div', 'anno-item' + (annoState.selId === a.id ? ' sel' : ''));
    item.dataset.id = a.id;

    var num = el('span', 'ln', String(i + 1));
    var fields = el('div', 'anno-fields');
    var name = el('input', 'a-name');
    name.placeholder = 'Name';
    name.value = a.name || '';
    name.addEventListener('input', function () { a.name = name.value; });
    var desc = el('input', 'a-desc');
    desc.placeholder = 'Description (optional)';
    desc.value = a.desc || '';
    desc.addEventListener('input', function () { a.desc = desc.value; });
    fields.appendChild(name);
    fields.appendChild(desc);

    var del = el('button', 'icon-btn a-del', icon('trash'));
    del.title = 'Delete this pin';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      annoState.anns = annoState.anns.filter(function (x) { return x.id !== a.id; });
      if (annoState.selId === a.id) annoState.selId = null;
      renderAnnoPins();
      renderAnnoList();
    });

    item.addEventListener('click', function () { selectAnno(a.id, false); });
    item.appendChild(num);
    item.appendChild(fields);
    item.appendChild(del);
    host.appendChild(item);
  });
}

function initAnnotator() {
  $('#annoSize').addEventListener('input', function () {
    if (!annoState) return;
    annoState.pinSize = +this.value;
    $('#annoSizeVal').textContent = annoState.pinSize + ' px';
    renderAnnoPins();
  });

  $('#annoWrap').addEventListener('click', function (e) {
    if (e.target.closest('.pin')) return;
    var img = $('#annoImg');
    var rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var x = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
    var y = clamp((e.clientY - rect.top) / rect.height * 100, 0, 100);
    var a = {
      id: uid(),
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      name: '',
      desc: ''
    };
    annoState.anns.push(a);
    annoState.selId = a.id;
    renderAnnoPins();
    renderAnnoList();
    selectAnno(a.id, true);
  });

  $('#annoDone').addEventListener('click', function () {
    if (!annoState) { closeModal('#annoModal'); return; }
    var b = Store.block(annoState.blockId);
    if (b) {
      b.annotations = annoState.anns;
      b.pinSize = annoState.pinSize;
      rerenderBlock(b.id);
      queueSave();
    }
    closeModal('#annoModal');
    annoState = null;
  });

  $('#annoCancel').addEventListener('click', function () {
    closeModal('#annoModal');
    annoState = null;
  });
}
