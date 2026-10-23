# Changelog

## 0.5.5

- Table block, column lines on two rows. First row: the calculation (Somme, Moy, Min, Max, Nb, Nb dif, in a narrow menu), the two decimals buttons (the word auto is gone) and the name of the column. Second row: the column, then the buttons to move it up, down or remove it. The name field is now called Name and takes the room that is left.
- The Learn more button is gone. The help badge of the menu "Linked to the selected row by" now has a "Learn more" link in its bubble. It opens a floating window that can be moved by its title bar and closed with its cross. The window stays open while the menu is changed and counts again the rows kept by each choice.
- Totals: "Total line (below)" and the new "Total line (right)" are tick boxes. The line on the right adds a Total column that combines the columns of each line (sum, average, minimum, maximum or count). It is only possible when at least two columns share the same calculation, otherwise the box is greyed. With the line below, the bottom right cell is the overall total.
- A folded menu "Filters and sort" at the bottom of the table settings holds the Filters and Sort sections with their + and - buttons. It opens by itself when a filter or a sort is set.
- Tests: total on the right (calculation, list and grouped table), the two-row column lines, the floating window.

## 0.5.4

- Table block, lighter settings panel, following the trials of 0.5.3.
  - The "Type" menu is gone from the settings panel: the type of a block is chosen when it is added.
  - The example sentence under "Kind of table" is now in its help badge, written without any name from your document. The help texts no longer quote tables or columns: they are general, and the sentence that names the real tables and columns (the current choice of "Linked to the selected row by") is built from your document and shown in the help badge of that menu instead of under it.
  - The "Item" menu and the column menus are sorted by level: first the columns of the table in alphabetical order, then the columns of the linked tables (`Reference > Column`) in alphabetical order.
  - "Filters", "Sort" and "Total line" are three lines one after the other, each with its help badge and a + button. The + button shows the settings of the filters or of the sort (the - button removes them), and adds the total line (the - button removes it). The folded section "Filters, sort and decimals" is gone.
  - The calculation and the number of decimals are chosen on each column line: the calculation as before, the number of decimals with two buttons like those of Grist (fewer and more decimals), with the value shown between them. The model keeps the decimals of the table as the default for the columns that have none, so tables saved by 0.5.3 stay valid.
- Tests: sorting of the choices, decimals per column in the model and in the calculation, the + and - buttons of the panel.

## 0.5.3

- Table block, simpler settings, following the first trials in Grist.
  - New menu "Kind of table": Dynamic (the table follows the selected row) or Fixed (the whole table, whatever the selected row). The menu that links the rows to the selected row only appears for a dynamic table. The old "Rows to keep" with its "All the rows" choice is replaced by this.
  - The menu "List or Grouped" is gone: a table is grouped as soon as an item is chosen, and a list otherwise. "Group by" is now "Item", and the second grouping ("Then by") is removed (columns are added with "Add a column"; a two-level grouping with subtotals will come back later).
  - For a dynamic table the table menu only offers the table of the selected row, the tables attached to it, the tables of its items (building, site, floor...) and its summary tables, in groups. A fixed table offers every table.
  - The menu "Linked to the selected row by" offers only the direct links, like the Select by menu of Grist. The advanced links come with the tick box "More choices". A "Learn more" button opens a panel that counts, for the row selected now, how many rows each choice keeps.
  - In a grouped table each column line starts with the calculation, then the column. A calculation on numbers (sum, average, minimum, maximum) only offers the columns of numbers; counting offers every column, or the number of rows. In a list the column comes first and the function of the total line second.
  - "Total line" is out of the folded section, which is now called "Filters, sort and decimals".
- The model keeps its keys: the kind of table (list or grouped) is now worked out from the item, and a fixed table is the link `all`, so tables saved by 0.5.2 stay valid.
- Tests of the translations (same keys in French and English, every text asked for exists).
- The explorer report says whether the manual order column of a table comes with its data (needed to follow the order that the user gives to a reference table in Grist).

## 0.5.2

- Pages by hand. The program no longer adds a page when a new block does not fit and no longer removes an empty page. A new block that does not fit is refused with the message "No room left on the pages: add a page with Add a page, then add the block". The "Add a page" button adds a page at the end, and the new "Remove the last page" button removes it, only when it is empty (otherwise a message asks to move or delete its blocks first; the only page cannot be removed). Moving or deleting a block never changes the number of pages. The only case where pages are added by the program is a change of format or a saved model whose blocks no longer fit: pages are then added so that no block is lost.
- The "Rows to keep" menu of a table block is shorter and in plain words. The same link reached by a long way and a short way is offered once, with short sentences such as "Same Batiment as the selected row", "Etage = Etage of the selected row" or "Only Etage of the selected row". The links that cross several tables, use a list or a summary table go to an "Advanced links" group at the end of the menu with their full sentence, and the full sentence of the chosen link is repeated under the menu.
- Simpler help texts for the table settings, with an example (areas per floor), shorter explanations in the help badges of the grouping, filter and total, and a note in the help of the block that a page must be added first when there is no room.

## 0.5.1

- Table block: the choice of the rows is simpler. The "Starting row" menu is gone. The table menu now lists every table of the document (the ordinary tables first, the summary tables last), and the "Rows to keep" menu gives sentences such as "The rows whose BDD_Etages.Batiment is BDD_Batiments of the selected row (via BDD_Salles.Batiment)", the best choices first and "All the rows of the table" last. The chosen sentence is repeated under the menu. A line of help at the top of the table settings says what to choose in which order. The table that holds the figures (for example the floors for areas per floor) can now be found even when it does not descend from the selected row.
- The help badges showed two bubbles one over the other (the drawn one and the native one of the browser). Only the drawn one is kept.

## 0.5.0

- Table block, lists and groupings. In the settings panel, the same menus as the query lab (starting row, table, link, grouping by one or two columns, calculation per column, filters, sort), laid out more tightly: pairs of menus on one line, one line per column with its calculation and heading, and the filters, sort, decimals and total in a folded section.
- Two kinds of table. List: one line per row, with columns chosen in order (also through references, such as `Building > Name`), an optional sort by a column, and a total line with a function chosen for each column. Grouped: one line per group with sums, averages, minimums, maximums or counts, sorted by label or by value, and a total line.
- Numbers of Numeric columns are written the French way with an optional number of decimals, dates as day/month/year, references by their label. The total line is separated by a thicker rule. The title of the block is shown above the table.
- The table follows the selected row, and the starting row can be the selected row or an item it points to, as in the lab. The data of the tables are loaded once (the "Refresh the data" button loads them again).
- A table longer than its block is marked in the editing mode (long tables over several pages come in a later version).
- The version is written under the title of the widget, and a test checks that the page, the package and the changelog carry the same version, so that a stale page is easy to recognise.
- The filter controls are now shared by the lab and the tables (`filter-ui.js`) and the help badge has its own file (`help.js`). New pure module `table-query.js` with unit tests (including random configurations).
- The settings of a table block are saved in the model under `config` and cleaned when read.

## 0.4.2

- The fields of a text no longer depend on what Grist sends with the selected row. The value of a column is taken from the selected row when it has the expected type (text, number, yes or no), and otherwise from the loaded table, which holds the raw values (row numbers of references, encoded dates). The table of the row is loaded again, once, when the selected row is not in it yet.
- Explorer report: a new section 7 shows the shape of each value that Grist gave with the selected row, to see what a widget really receives.

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
