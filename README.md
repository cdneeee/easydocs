# EasyDocs

A lightweight documentation creator that runs entirely in your browser. No install, no build step, no server, and nothing ever leaves your machine.

## Run it

Open `index.html` in Chrome, Edge, or Firefox. That is all.

The first launch creates a sample document called "EasyDocs Guide". It is written in EasyDocs itself and walks through every feature. Open it and look around, or delete it from the home screen (you can bring it back with "Add the sample guide").

## What it does

- **Multi-document home screen.** Documents live in the browser (IndexedDB) and autosave as you type. Duplicate, delete with undo, import and export.
- **Editor zoom.** The minus and plus buttons in the top bar scale the editing surface from 50 to 200 percent (click the percentage to reset). It is a view preference for this browser and never affects exports.
- **Pages, sections, and blocks.** Each document is a set of pages (drag to reorder, double-click to rename). A page can hold sections, and a section can hold subsections: hover an item in the sidebar and press the + button. The tree shows in the sidebar, in the exported contents, and in the numbering (page 1, its headings 1.1 and 1.2, a section as 1.3, a subsection as 1.3.1). A page is a stack of blocks: text, headings, lists, screenshots, code, callouts, tables, and dividers. Hover a block for move, duplicate, delete, and insert controls.
- **Groups.** Add group creates a folder label in the sidebar that holds pages, which separates large documents visually (for example an HMI screens part holding several pages with their sections). Delete the label to ungroup (pages stay). Groups appear as unnumbered part dividers in the exported HTML and PDF; page numbering continues across them.
- **Drag and drop everywhere.** Every sidebar item moves together with everything nested in it. Drop near the top or bottom edge of a target to place before or after it; drop on the middle to nest inside it (page into a group, section into a page, and so on), whenever the hierarchy allows. Groups always stay at the top level and nesting stops at subsections.
- **Screenshot annotation.** Import several screenshots at once (file picker, drag and drop, or Ctrl+V straight from Win+Shift+S). Click a screenshot to open the annotator, then click spots on the image to drop numbered pins with a name and description. A pin can also link to a page, section, or subsection: readers jump there from the figure legend in the editor, the HTML export, and the PDF (plain text stays the default). A pin size slider adjusts how large the markers render for that screenshot.
- **Pin references in text.** While editing text, press the Ref button in the small toolbar and pick a pin. An inline chip appears that stays in sync when pins are renamed and turns into a jump link in the exports.
- **HTML export.** One self-contained file with a navigation sidebar, live search with match highlighting, figure numbering, and print styles.
- **One-click PDF.** The PDF button produces a real PDF (selectable text) with a cover page, a table of contents with page numbers, page footers, and pins drawn onto the figures.
- **Markdown import.** Bring existing docs in from the home screen (level-1 headings become pages) or append Markdown to the current page.

## Getting a PDF

Two ways:

1. Press **PDF** in the editor top bar. This uses the bundled pdfmake engine in `vendor/` and downloads a finished PDF.
2. Open an exported HTML file and press **Ctrl+P** (or its floating print button). The print styles produce a clean A4 layout with a cover sheet, contents, and per-page breaks. Pick "Save as PDF" as the printer.

The first way gives you page numbers in the table of contents. The second preserves the exact web styling.

## Backups and moving between machines

Autosave covers browser storage only. For a file you can keep or move, use **Save .json** in the top bar and re-import it later with **Open .json** on the home screen. Exported HTML files are for readers; .json files are the editable source.

## Files

```
index.html      the app
css/app.css     editor styles
js/state.js     data model, IndexedDB, autosave
js/home.js      document manager
js/blocks.js    block editing, image import and downscaling
js/annotate.js  screenshot pin editor
js/refs.js      text toolbar and reference picker
js/export.js    standalone HTML builder
js/pdf.js       pdfmake document builder
js/markdown.js  Markdown to blocks converter
js/sample.js    the built-in guide document
js/app.js       app shell and wiring
vendor/         pdfmake.min.js and vfs_fonts.js (pdfmake 0.2.23, MIT)
```

## Notes and limits

- Screenshots are stored inside the document as data URIs and are downscaled on import (default max width 1600 px, adjustable in document settings) to keep files small.
- The bundled Roboto font in the PDF covers Latin and Cyrillic text.
- If the `vendor/` files are missing, the PDF button falls back to opening the print view of the HTML export.
- Clearing browser site data deletes the stored documents. Keep .json backups of anything important.

## Quick smoke checklist

1. Open `index.html`, open the sample guide.
2. Add a page, paste or import two screenshots at once.
3. Click a screenshot, add two pins, press Done.
4. In a paragraph, press Ref and insert both pins, then rename a pin and watch the chip update.
5. Export HTML, open it, search for a word, click a reference chip.
6. Press PDF and check the contents page numbers and the pins on figures.
