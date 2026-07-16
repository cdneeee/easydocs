/* EasyDocs: shared helpers, data model, and storage. */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function icon(name) { return '<svg class="ic"><use href="#i-' + name + '"/></svg>'; }

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/* IndexedDB wrapper. Falls back to an in-memory map when IndexedDB
   cannot be opened, so the app still works for the session. */
var DB = {
  _db: null,
  _mem: {},
  unavailable: false,

  open: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
      var req = indexedDB.open('easydocs', 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore('docs', { keyPath: 'id' });
      };
      req.onsuccess = function () { self._db = req.result; resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  },

  _tx: function (mode, fn) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var tx = self._db.transaction('docs', mode);
      var req = fn(tx.objectStore('docs'));
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  },

  put: function (doc) {
    if (this.unavailable) { this._mem[doc.id] = deepClone(doc); return Promise.resolve(); }
    return this._tx('readwrite', function (s) { return s.put(doc); });
  },
  get: function (id) {
    if (this.unavailable) { return Promise.resolve(this._mem[id] ? deepClone(this._mem[id]) : null); }
    return this._tx('readonly', function (s) { return s.get(id); });
  },
  del: function (id) {
    if (this.unavailable) { delete this._mem[id]; return Promise.resolve(); }
    return this._tx('readwrite', function (s) { return s.delete(id); });
  },
  all: function () {
    var self = this;
    if (this.unavailable) {
      return Promise.resolve(Object.keys(this._mem).map(function (k) { return deepClone(self._mem[k]); }));
    }
    return this._tx('readonly', function (s) { return s.getAll(); });
  }
};

/* Current document and lookups into it. */
var Store = {
  project: null,
  pageId: null,

  page: function (id) {
    if (!this.project) return null;
    var pid = id || this.pageId;
    return this.project.pages.find(function (p) { return p.id === pid; }) || null;
  },

  pageOf: function (blockId) {
    if (!this.project) return null;
    return this.project.pages.find(function (p) {
      return p.blocks.some(function (b) { return b.id === blockId; });
    }) || null;
  },

  block: function (id) {
    if (!this.project) return null;
    for (var i = 0; i < this.project.pages.length; i++) {
      var b = this.project.pages[i].blocks.find(function (x) { return x.id === id; });
      if (b) return b;
    }
    return null;
  },

  /* Finds an annotation by id. Returns { ann, num, block, page, figNo } or null. */
  annotation: function (id) {
    if (!this.project) return null;
    var figNo = 0;
    for (var i = 0; i < this.project.pages.length; i++) {
      var page = this.project.pages[i];
      for (var j = 0; j < page.blocks.length; j++) {
        var b = page.blocks[j];
        if (b.type !== 'image') continue;
        figNo++;
        var anns = b.annotations || [];
        for (var k = 0; k < anns.length; k++) {
          if (anns[k].id === id) {
            return { ann: anns[k], num: k + 1, block: b, page: page, figNo: figNo };
          }
        }
      }
    }
    return null;
  },

  /* All annotations in document order, each as { ann, num, block, page, figNo }. */
  allAnnotations: function () {
    var out = [];
    if (!this.project) return out;
    var figNo = 0;
    this.project.pages.forEach(function (page) {
      page.blocks.forEach(function (b) {
        if (b.type !== 'image') return;
        figNo++;
        (b.annotations || []).forEach(function (a, k) {
          out.push({ ann: a, num: k + 1, block: b, page: page, figNo: figNo });
        });
      });
    });
    return out;
  }
};

var _saveTimer = null;

function queueSave() {
  if (!Store.project) return;
  Store.project.updated = Date.now();
  if (typeof setSaveState === 'function') setSaveState('saving');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(persistNow, 600);
}

function persistNow() {
  if (!Store.project) return Promise.resolve();
  clearTimeout(_saveTimer);
  return DB.put(Store.project).then(function () {
    if (typeof setSaveState === 'function') setSaveState('saved');
  }).catch(function () {
    if (typeof setSaveState === 'function') setSaveState('error');
  });
}

function defaultProject(title) {
  return {
    id: uid(),
    title: title || 'Untitled document',
    subtitle: '',
    author: '',
    version: '1.0',
    date: todayStr(),
    accent: '#4f46e5',
    logo: '',
    maxImageWidth: 1600,
    updated: Date.now(),
    pages: [{
      id: uid(),
      title: 'Introduction',
      blocks: [{ id: uid(), type: 'paragraph', html: '' }]
    }]
  };
}

/* Basic shape check for imported .json files. */
function validProject(o) {
  return !!(o && typeof o === 'object' && Array.isArray(o.pages) && o.pages.length &&
    o.pages.every(function (p) { return p && Array.isArray(p.blocks); }));
}
