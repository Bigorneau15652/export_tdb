# Changelog

## 0.4.1

- Fields of a text were empty in Grist: by default Grist gives a widget only the columns shown in its right panel, and shows the content of references instead of their row number. The widget now asks for the raw values of every normal column (`keepEncoded`, `expandRefs: false`, `includeColumns: normal`), which is what the fields and the references need.
- The settings panel of a block no longer has the page, position and size fields (the blocks are moved and resized on the page): more room for the text settings. The title field is hidden for a text block, which shows no title.

## 0.4.0

- Text block. Markdown is drawn safely: titles (levels 1 to 3), paragraphs, bulleted and numbered lists, bold, italic and https links without credentials. HTML is never made; anything else stays plain text.
- Fields `{Column}` and `{Reference.Column}` are replaced by the value of the selected row, and the text follows the cursor of Grist. A field is replaced only inside plain text, so a value that holds Markdown signs cannot change the layout. Numeric columns and dates are written the French way, references by their label. The tables that the fields need are loaded once; a "Refresh the data" button loads them again.
- Two sources for the text: a fixed text kept in the widget, or a Text column of the selected row. In the second case what is typed in the settings panel is written back into the cell (after a short pause, or when the row changes), after checking that the column exists, is of type Text and holds no formula. Two writing methods of the Grist API are tried one after the other.
- Settings of a text block: size (small, normal, large), alignment (left, centred, justified) and a background among five light colours. A menu inserts a field at the cursor. The text size follows the scale of the page.
- A text longer than its block is marked in the editing mode.
- The model keeps the settings of each block under `config` (cleaned when read; models saved by 0.3 stay valid).
- New pure modules `markdown.js` and `fields.js` with unit tests (including random texts), and the display files `markdown-view.js` and `data-cache.js`. `grist-access.js` also reads tables and writes a cell.

## 0.3.0

- New first tab, Dashboard (the explorer and the query lab stay as the second and third tabs). The widget opens in reading mode; the Edit button shows the tools.
- Pages in millimetres: A3, A4, A5, square (210 x 210) and screen 16/9 (297 x 167), portrait or landscape, margins of 0 to 20 mm, grid of 5 mm. Zoom and fit to the width of the panel.
- Blocks of five types (text, table, chart, image, indicator) with a title, empty for now. They are added at the first free place (a page is added when there is no room), moved and resized with the pointer (the Shift key keeps the proportions), moved with the arrow keys, deleted with the Delete key after a confirmation, and edited in a settings panel (title, type, page, place and size in millimetres) opened with a double click or the pencil. The panel becomes a sheet at the bottom of the widget when it is narrow.
- Blocks never overlap and never leave the page: a move or a resize that would break this goes to the closest valid place.
- The model (page settings and blocks) is saved in the options of the widget under the key `model`, cleaned when it is read (known types, bounded numbers, no overlap) and protected against a newer format.
- A "?" help badge before every menu of the tools and of the settings panel.
- New pure modules `layout.js` (geometry and collisions) and `model.js` (model, cleaning, changes), `grist-access.js` (the only place where the dashboard talks to Grist), `tabs.js`, with unit tests including random sequences of changes.

## 0.2.3

- Query lab: a warning appears when a sum or an average is calculated on a column read through a reference (its value is counted once per row that points to it, which inflates the total).

## 0.2.2

- Query lab: several columns can be calculated at once (list of check boxes, one calculation for all of them, one result column each with its total).
- The table and the link start empty and the lab asks to choose them, instead of guessing.
- A "?" badge before every menu shows an explanation on hover, focus or click.

## 0.2.1

- Query lab: the starting row can be the selected row or a parent of it (for example the building of a selected room); the table to calculate on and the link are chosen from it, with the best link first (summary tables and chains through lists come last and are labelled); the result is calculated again when the selected row changes; a switch merges rows that have the same label; a help text explains the principle.
- New pure functions `findAncestors`, `pathQuality`, `rankDescendants` and `contextRowId`, and the `merge` option of the groupings, with tests.

## 0.2.0

- Data engine, in pure modules tested with Node: reading of the raw values of Grist (`values.js`), tables in memory with labels of references, paths through references and inverse indexes (`dataset.js`), rows that belong to the selected row by any chain of references and filters (`rowset.js`), grouping, cross tables, totals and slices of columns (`aggregate.js`), calculation of named values without running text as code (`expr.js`), French writing of numbers, percentages and dates (`format.js`).
- Two rows that have the same label stay two groups (the grouping uses the number of a referenced row).
- A "Query lab" tab to try these calculations on real data and compare the figures.

## 0.1.0

- First version: an explorer that reads the structure of the Grist document (tables, columns, references, descendant tables), describes the shape of the values without revealing them, measures the loading time of the tables and tests the API functions that the dashboard widget will need (selected table, metadata, attachment token, writing in a cell). It produces a report to copy.
- Pure modules `schema.js`, `shape.js` and `report.js` with unit tests; integration tests in a browser with a fake Grist object and an invented document.
