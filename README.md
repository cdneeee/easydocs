# EasyDocs

**A lightweight documentation creator that runs entirely in your browser.** Write pages and blocks, drop in screenshots and tag them with numbered pins, then export a single self-contained HTML file or a real PDF. No install, no build step, no server — and nothing ever leaves your machine.

![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)
![Build step: none](https://img.shields.io/badge/build-none-brightgreen)
![External runtime deps: 0](https://img.shields.io/badge/CDN%20deps-0-brightgreen)
![Storage: local only](https://img.shields.io/badge/storage-local%20only-informational)

> **Live demo:** replace this line with your GitHub Pages URL after deploying, e.g. `https://<your-user>.github.io/easydocs/`

![The EasyDocs editor with an annotated screenshot](docs/screenshots/editor-annotated.jpg)

---

## Screenshots

| Home — your private set of documents | Annotate a screenshot with numbered pins |
| --- | --- |
| ![Home screen](docs/screenshots/home.jpg) | ![Screenshot annotator](docs/screenshots/annotator.jpg) |

| Type `/` for a block menu | |
| --- | --- |
| ![Slash menu](docs/screenshots/slash-menu.jpg) | |

## Run it

Open `index.html` in Chrome, Edge, or Firefox. That is all — there is nothing to install or build.

The first launch creates a sample document called **EasyDocs Guide**. It is written in EasyDocs itself and walks through every feature. It stays pinned on your home screen as a permanent reference and cannot be deleted; create your own documents alongside it with **New document**.

Everything is stored locally in your browser, so each browser holds its own private set of documents and nobody else can see them. Because that storage can be cleared, the home screen shows a reminder to keep **Save .json** backups of anything important.

## What it does

- **Multi-document home screen.** Documents live in the browser (IndexedDB) and autosave as you type. Duplicate, delete with undo, import and export. The built-in example guide is always present and undeletable.
- **Fast composing.** Type `/` on an empty line for a block picker that filters as you type. Markdown shortcuts convert while you write, Enter splits a paragraph into a new block, and every block has a drag handle for reordering (see the table below).
- **Pages, sections, and blocks.** Each document is a set of pages (drag to reorder, double-click to rename). A page can hold sections, and a section can hold subsections: hover an item in the sidebar and press the + button. The tree shows in the sidebar, in the exported contents, and in the numbering (page 1, its headings 1.1 and 1.2, a section as 1.3, a subsection as 1.3.1). A page is a stack of blocks: text, headings, lists, screenshots, code, callouts, tables, and dividers.
- **Groups.** Add group creates a folder label in the sidebar that holds pages, which separates large documents visually. Delete the label to ungroup (pages stay). Groups appear as unnumbered part dividers in the exports; page numbering continues across them.
- **Drag and drop everywhere.** Every sidebar item moves together with everything nested in it. Drop near the top or bottom edge of a target to place before or after it; drop on the middle to nest inside it, whenever the hierarchy allows. Groups always stay at the top level and nesting stops at subsections.
- **Screenshot annotation.** Import several screenshots at once (file picker, drag and drop, or Ctrl+V straight from Win+Shift+S). Click a screenshot to open the annotator, then click spots on the image to drop numbered pins with a name and description. Zoom with the header controls or Ctrl + scroll for pixel-accurate placement. A pin can also link to a page, section, or subsection: readers jump there from the figure legend in the editor, the HTML export, and the PDF. A pin size slider adjusts how large the markers render.
- **Pin references in text.** While editing text, press the Ref button in the small toolbar and pick a pin. An inline chip appears that stays in sync when pins are renamed and turns into a jump link in the exports.
- **HTML export.** One self-contained file with a navigation sidebar, live search with match highlighting, figure numbering, and print styles.
- **One-click PDF.** The PDF button produces a real PDF (selectable text) with a cover page, a table of contents with page numbers, page footers, and pins drawn onto the figures.
- **Markdown import.** Bring existing docs in from the home screen (level-1 headings become pages) or append Markdown to the current page.
- **Editor zoom.** The minus and plus buttons in the top bar scale the editing surface from 50 to 200 percent. It is a view preference for this browser and never affects exports.

## Composing shortcuts

Everything below fires on an otherwise-empty line, so it never gets in the way of normal typing.

| Type this | You get |
| --- | --- |
| `/` | a block menu, filtered as you keep typing (`/co` &rarr; Code) |
| `# ` / `## ` | a heading (H2 / H3) |
| `- ` or `* ` | a bullet list |
| `1. ` | a numbered list |
| `> ` | a callout |
| <code>&#96;&#96;&#96;</code> | a code block |
| `---` | a divider |
| `Enter` | split the paragraph at the cursor into a new block |
| `Enter` on an empty list item | leave the list and start a new paragraph |

Drag the grip in a block's hover controls to reorder blocks; use the up / down arrows for single steps.

## Getting a PDF

Two ways:

1. Press **PDF** in the editor top bar. This uses the bundled pdfmake engine in `vendor/` and downloads a finished PDF.
2. Open an exported HTML file and press **Ctrl+P** (or its floating print button). The print styles produce a clean A4 layout with a cover sheet, contents, and per-page breaks. Pick "Save as PDF" as the printer.

The first way gives you page numbers in the table of contents. The second preserves the exact web styling.

## Backups and moving between machines

Autosave covers browser storage only. For a file you can keep or move, use **Save .json** in the top bar and re-import it later with **Open .json** on the home screen. Exported HTML files are for readers; `.json` files are the editable source.

## Host it yourself

EasyDocs is a static site with no build step and no backend, so any static host works and there is nothing to run or pay for. Data stays in each visitor's browser.

Using **GitHub Pages**:

1. Push this repository to GitHub (public or private).
2. In the repository, open **Settings &rarr; Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick the `main` branch and the `/ (root)` folder, and save.
4. Wait for the build, then open the URL it shows (for a project site it looks like `https://<user>.github.io/<repo>/`).

The paths in `index.html` are relative, so it works from a subpath without changes. The `.nojekyll` file tells Pages to serve the files as-is. Any other static host (Cloudflare Pages, Netlify, Vercel) works the same way: point it at this repository, no build command, output directory is the repository root.

## Files

```
index.html      the app
css/app.css     editor styles
js/state.js     data model, IndexedDB, autosave
js/home.js      document manager
js/blocks.js    block editing, image import and downscaling
js/compose.js   slash menu, Markdown autoformat, smart Enter, block drag
js/annotate.js  screenshot pin editor
js/refs.js      text toolbar and reference picker
js/export.js    standalone HTML builder
js/pdf.js       pdfmake document builder
js/markdown.js  Markdown to blocks converter
js/sample.js    the built-in guide document
js/app.js       app shell and wiring
vendor/         pdfmake.min.js and vfs_fonts.js (pdfmake 0.2.23, MIT)
docs/           screenshots used in this README
```

## Notes and limits

- Screenshots are stored inside the document as data URIs and are downscaled on import (default max width 1600 px, adjustable in document settings) to keep files small.
- The bundled Roboto font in the PDF covers Latin and Cyrillic text.
- If the `vendor/` files are missing, the PDF button falls back to opening the print view of the HTML export.
- Clearing browser site data deletes the stored documents. Keep `.json` backups of anything important.

## Quick smoke checklist

1. Open `index.html`, open the sample guide.
2. Add a page, then type `/` and pick a block; try `# `, `- `, and `> ` shortcuts.
3. Paste or import two screenshots at once, click one, add two pins, press Done.
4. In a paragraph, press Ref and insert both pins, then rename a pin and watch the chip update.
5. Export HTML, open it, search for a word, click a reference chip.
6. Press PDF and check the contents page numbers and the pins on figures.

## License

EasyDocs is released under the MIT License. See [LICENSE](LICENSE).

It bundles pdfmake (MIT) and the Roboto font (Apache-2.0) in `vendor/`. Their license texts are in [vendor/LICENSES.md](vendor/LICENSES.md) and must be kept with any copy you distribute.
