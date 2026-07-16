/* EasyDocs: sample document. It doubles as the user guide and shows every
   feature, including an annotated demo screenshot drawn on a canvas. */

function _rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function demoScreenshot() {
  var W = 960, H = 600;
  var c = document.createElement('canvas');
  c.width = W; c.height = H;
  var g = c.getContext('2d');

  g.fillStyle = '#eef1f5'; g.fillRect(0, 0, W, H);

  g.fillStyle = '#232a36'; g.fillRect(0, 0, W, 44);
  ['#f26d6d', '#f2c94c', '#6dd28f'].forEach(function (col, i) {
    g.beginPath(); g.arc(22 + i * 20, 22, 6, 0, 7); g.fillStyle = col; g.fill();
  });
  g.fillStyle = '#c8cede'; g.font = '600 13px Segoe UI, Arial';
  g.fillText('Acme Console', 88, 27);

  g.fillStyle = '#ffffff'; g.fillRect(0, 44, 220, H - 44);
  g.strokeStyle = '#e3e7ee'; g.beginPath(); g.moveTo(220.5, 44); g.lineTo(220.5, H); g.stroke();
  for (var i = 0; i < 5; i++) {
    var y = 84 + i * 44;
    if (i === 0) { g.fillStyle = '#eef0ff'; _rr(g, 12, y - 20, 196, 34, 8); g.fill(); }
    g.fillStyle = i === 0 ? '#4f46e5' : '#9aa1b2';
    _rr(g, 26, y - 8, i === 0 ? 92 : 66 + (i * 37) % 60, 10, 5); g.fill();
  }

  g.fillStyle = '#1f2430'; g.font = '700 20px Segoe UI, Arial';
  g.fillText('Dashboard', 250, 86);

  g.fillStyle = '#ffffff'; _rr(g, 640, 62, 200, 32, 8); g.fill();
  g.strokeStyle = '#d7dbe4'; _rr(g, 640, 62, 200, 32, 8); g.stroke();
  g.strokeStyle = '#9aa1b2'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(660, 77, 6, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(664.5, 81.5); g.lineTo(670, 87); g.stroke();
  g.lineWidth = 1;

  g.fillStyle = '#4f46e5'; g.beginPath(); g.arc(884, 78, 16, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 12px Segoe UI, Arial';
  g.textAlign = 'center'; g.fillText('AP', 884, 82); g.textAlign = 'left';

  var stats = ['1,284', '98.2%', '312'];
  for (i = 0; i < 3; i++) {
    var x = 250 + i * 232;
    g.fillStyle = '#ffffff'; _rr(g, x, 116, 208, 92, 10); g.fill();
    g.strokeStyle = '#e3e7ee'; _rr(g, x, 116, 208, 92, 10); g.stroke();
    g.fillStyle = '#9aa1b2'; _rr(g, x + 18, 134, 84, 9, 4); g.fill();
    g.fillStyle = '#1f2430'; g.font = '700 24px Segoe UI, Arial';
    g.fillText(stats[i], x + 18, 188);
  }

  g.fillStyle = '#ffffff'; _rr(g, 250, 232, 672, 300, 10); g.fill();
  g.strokeStyle = '#e3e7ee'; _rr(g, 250, 232, 672, 300, 10); g.stroke();
  g.fillStyle = '#1f2430'; _rr(g, 274, 258, 150, 12, 5); g.fill();
  g.fillStyle = '#c3c8d4';
  for (i = 0; i < 6; i++) {
    _rr(g, 274, 294 + i * 30, 620 - (i * 47) % 180, 10, 5); g.fill();
  }

  g.fillStyle = '#4f46e5'; _rr(g, 782, 484, 118, 34, 8); g.fill();
  g.fillStyle = '#ffffff'; g.font = '600 13px Segoe UI, Arial';
  g.textAlign = 'center'; g.fillText('Save changes', 841, 505); g.textAlign = 'left';

  return c.toDataURL('image/png');
}

function sampleProject() {
  var shot = '';
  try { shot = demoScreenshot(); } catch (e) { shot = ''; }

  var aSave = { id: uid(), x: 87.6, y: 83.5, name: 'Save changes button', desc: 'Stores every edit made on this screen' };
  var aSearch = { id: uid(), x: 77.1, y: 13.0, name: 'Search field', desc: 'Finds records by name or id' };
  var aNav = { id: uid(), x: 11.5, y: 16.4, name: 'Navigation menu', desc: 'Switches between the main sections' };

  var welcomeId = uid();
  var pageWelcome = {
    id: welcomeId, title: 'Welcome', blocks: [
      { id: uid(), type: 'paragraph', html: 'EasyDocs is a small documentation editor that runs in your browser. You write in pages and blocks, drop in screenshots, tag spots on them with numbered pins, and reference those pins from your text. The result exports as a single HTML file or a PDF.' },
      { id: uid(), type: 'callout', kind: 'tip', html: 'This sample document is also the user guide. It stays on your home screen as a reference and cannot be deleted. Create your own documents alongside it with New document.' },
      { id: uid(), type: 'heading', level: 2, text: 'Quick start' },
      {
        id: uid(), type: 'list', ordered: true, html:
          '<li>Click <b>Add page</b> in the left sidebar and give the page a title.</li>' +
          '<li>Use the buttons under the last block to add text, headings, lists, screenshots, and more.</li>' +
          '<li>Click a screenshot (or its <b>Annotate</b> button) and click spots on it to add numbered pins.</li>' +
          '<li>Put the cursor in any paragraph and press <b>Ref</b> in the small toolbar to link a pin.</li>' +
          '<li>Press <b>Export HTML</b> or <b>PDF</b> in the top bar when you are done.</li>'
      },
      { id: uid(), type: 'heading', level: 2, text: 'Good to know' },
      {
        id: uid(), type: 'table', header: true, rows: [
          ['Action', 'How'],
          ['Save', 'Automatic. Everything is stored in this browser as you type.'],
          ['Backup', 'Save .json in the top bar downloads the document as a file you can re-import.'],
          ['Paste a screenshot', 'Take one with Win+Shift+S, then press Ctrl+V inside the editor.'],
          ['Rename a page', 'Double-click its name in the sidebar.'],
          ['Reorder pages', 'Drag them in the sidebar. A page moves together with its sections.'],
          ['Add a section', 'Hover a page in the sidebar and press the + button. The same button on a section adds a subsection.'],
          ['Group pages', 'Press Add group at the bottom of the sidebar, then drop pages onto the label to move them in. Click a label to select it: Add page then creates the page inside that group. Groups become part dividers in the exports.'],
          ['Collapse the tree', 'Click the small arrow next to any group, page, or section that has something nested in it.'],
          ['Move or delete a block', 'Hover a block and use the small buttons in its top right corner.']
        ]
      }
    ]
  };

  var structureId = uid();
  var sectionStructure = {
    id: structureId, parentId: welcomeId, title: 'Pages and sections', blocks: [
      { id: uid(), type: 'paragraph', html: 'A document is a set of pages, and any page can hold <b>sections</b> like the one you are reading now. Hover a page in the sidebar and press the + button to create one. Sections can hold one level of <b>subsections</b> of their own, like the one right below. Related pages can also be gathered under a <b>group</b> label, like the Using the editor group in this guide: press Add group at the bottom of the sidebar, and drag pages onto the label to move them in. Groups become part dividers in the exports.' },
      {
        id: uid(), type: 'list', ordered: false, html:
          '<li>Everything drags together with what is nested in it.</li>' +
          '<li>Drop near the top or bottom edge of an item to place before or after it; drop on its middle to nest inside it, when the hierarchy allows.</li>' +
          '<li>Deleting a page deletes everything nested in it. The Undo button in the toast brings it all back.</li>'
      }
    ]
  };

  aNav.pageId = structureId;

  var subNumbering = {
    id: uid(), parentId: structureId, title: 'How numbering works', blocks: [
      { id: uid(), type: 'paragraph', html: 'This page is a <b>subsection</b>: a section inside a section, added with the + button on its parent.' },
      { id: uid(), type: 'callout', kind: 'info', html: 'Exports number everything in document order: the Welcome page is 1, its headings are 1.1 and 1.2, the Pages and sections section is 1.3, and this subsection is 1.3.1. A heading inside it would be 1.3.1.1.' }
    ]
  };

  var shotsId = uid();
  var pageShots = {
    id: shotsId, title: 'Screenshots and pins', blocks: [
      { id: uid(), type: 'paragraph', html: 'Add screenshots with the <b>Screenshots</b> button (you can select several files at once), by dragging image files into the page, or by pasting from the clipboard. Below is a demo screenshot with three pins on it.' },
      {
        id: uid(), type: 'image', src: shot, caption: 'The Acme Console dashboard used in this guide', width: 100,
        annotations: [aSave, aSearch, aNav]
      },
      {
        id: uid(), type: 'paragraph', html: 'Pins can be referenced from any text. The chips in this sentence are live links: press ' +
          chipHtml(aSave.id, 1, aSave.name) + ' to store your work, use ' +
          chipHtml(aSearch.id, 2, aSearch.name) + ' to find a record, and switch views with ' +
          chipHtml(aNav.id, 3, aNav.name) + '. In the exported document each chip jumps to the pin legend under the figure.'
      }
    ]
  };

  var sectionAnnotate = {
    id: uid(), parentId: shotsId, title: 'How to annotate', blocks: [
      {
        id: uid(), type: 'list', ordered: true, html:
          '<li>Click the screenshot. The annotate view opens.</li>' +
          '<li>Click any spot on the image to drop a numbered pin. Zoom with the controls in the header, or Ctrl + scroll, for pixel-accurate placement.</li>' +
          '<li>Give the pin a name and an optional description in the panel on the right.</li>' +
          '<li>Optionally pick a page, section, or subsection the pin should link to. Readers can then jump there from the figure legend; pin 3 on the demo screenshot links to Pages and sections.</li>' +
          '<li>Drag pins to fine-tune their position, and use the pin size slider if they cover too much of the image.</li>' +
          '<li>Press <b>Done</b> to apply.</li>'
      },
      { id: uid(), type: 'callout', kind: 'info', html: 'Pin positions are stored as percentages of the image size, so they stay in place at any width, in the editor, in the HTML export, and in the PDF.' }
    ]
  };

  var blocksPageId = uid();
  var pageBlocks = {
    id: blocksPageId, title: 'Blocks', blocks: [
      { id: uid(), type: 'paragraph', html: 'A page is a stack of blocks. Hover any block to move, duplicate, or delete it, or to insert a new block right after it. These are the available types:' },
      { id: uid(), type: 'heading', level: 2, text: 'Text, lists, and headings' },
      { id: uid(), type: 'paragraph', html: 'Paragraphs support <b>bold</b>, <i>italic</i>, <code>inline code</code>, and links through the small toolbar that appears while you edit. Headings come in two sizes and show up in the table of contents of the exported document.' },
      { id: uid(), type: 'heading', level: 2, text: 'Code' },
      { id: uid(), type: 'code', lang: 'js', code: 'function greet(name) {\n  return "Hello, " + name;\n}' },
      { id: uid(), type: 'heading', level: 2, text: 'Callouts' },
      { id: uid(), type: 'callout', kind: 'warning', html: 'Callouts come in four kinds: note, tip, warning, and danger. Hover a callout and use the label button in its corner to switch the kind.' }
    ]
  };

  var sectionTables = {
    id: uid(), parentId: blocksPageId, title: 'Tables and dividers', blocks: [
      { id: uid(), type: 'paragraph', html: 'Tables suit settings, parameters, and comparisons. A divider draws a quiet line between topics inside one page.' },
      {
        id: uid(), type: 'table', header: true, rows: [
          ['Type', 'Best for'],
          ['Table', 'Settings, parameters, comparisons'],
          ['Divider', 'Separating topics inside one page']
        ]
      },
      { id: uid(), type: 'divider' }
    ]
  };

  var exportId = uid();
  var pageExport = {
    id: exportId, title: 'Export and PDF', blocks: [
      { id: uid(), type: 'paragraph', html: 'A finished document leaves EasyDocs in two forms, covered by the sections below. Both are built from the same content, so they always match. Note how these sections appear in the sidebar and in the exported contents.' }
    ]
  };

  var sectionHtml = {
    id: uid(), parentId: exportId, title: 'HTML export', blocks: [
      { id: uid(), type: 'paragraph', html: '<b>Export HTML</b> downloads one self-contained file: styles, scripts, and images are all embedded, so you can mail it or put it on a share and it just opens. Readers get a sidebar with the table of contents and a search box that highlights matches in the text.' }
    ]
  };

  var sectionPdf = {
    id: uid(), parentId: exportId, title: 'PDF', blocks: [
      { id: uid(), type: 'paragraph', html: 'The <b>PDF</b> button builds a real PDF: selectable text, a cover page, a table of contents with page numbers, and page footers. Screenshots keep their pins and legends.' },
      { id: uid(), type: 'callout', kind: 'info', html: 'A second path to PDF: open the exported HTML file and press Ctrl+P. The print styles produce a clean A4 layout with a cover sheet and per-page breaks.' }
    ]
  };

  var sectionMd = {
    id: uid(), parentId: exportId, title: 'Markdown import', blocks: [
      { id: uid(), type: 'paragraph', html: 'Existing docs written in Markdown can be imported from the home screen (each level-1 heading becomes a page) or appended to the current page with the <b>Markdown</b> button under the last block.' }
    ]
  };

  var groupUsing = { id: uid(), kind: 'group', title: 'Using the editor', blocks: [] };
  pageShots.parentId = groupUsing.id;
  pageBlocks.parentId = groupUsing.id;
  pageExport.parentId = groupUsing.id;

  return {
    id: uid(),
    fmt: 2,
    example: true,
    title: 'EasyDocs Guide',
    subtitle: 'A short tour of the editor, written in the editor',
    author: 'EasyDocs',
    version: '1.0',
    date: todayStr(),
    accent: '#4f46e5',
    logo: '',
    maxImageWidth: 1600,
    updated: Date.now(),
    pages: [
      pageWelcome, sectionStructure, subNumbering,
      groupUsing,
      pageShots, sectionAnnotate,
      pageBlocks, sectionTables,
      pageExport, sectionHtml, sectionPdf, sectionMd
    ]
  };
}
