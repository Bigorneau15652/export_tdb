# Changelog

## 0.15.0

- Course windows, second part: the Chart, Image and Indicator blocks now have their course, so the student cap is shown for the six types of blocks. Each course follows the same plan as the others: what the block is for, step by step, the settings one by one, examples with a small drawn result, good to know.
- The Chart course explains the data (kind, table, item, item in columns, calculations), the type, the legend and the labels of the values, with two examples drawn as bars. The Image course explains the column, the rank and the caption, with a drawn frame. The Indicator course explains the named value, the note, the size, the default colour and the rules of colour, with cards drawn in their colour and their symbol.
- Some explanations that were written for tables (item, item in columns, columns, legend) have their own wording for the chart, and the indicator settings have explanations of their own.
- Review of the labels and explanations: each menu they name exists in the panel, and the old names are gone.
- Tests: the six courses have all their texts in French and in English, the menus built by script are known to the check, and in the page each new course opens in the same window with its drawn sample.

## 0.14.0

- Course windows, first part: a button with a student cap, at the top of the settings panel next to the type of block, opens the course of the block in a window of the browser of its own. The window can be moved (to another screen too), resized and kept open while a block is set; a cross at its top right (or the Escape key) closes it, and a second click on the cap changes its content. Courses exist for the Text, Table and Sheet blocks; the cap is hidden for the other types until their courses are written (next version).
- A course tells what the block is for, how to set it step by step, each setting of the panel with its explanation, examples (the settings to make and a small result drawn with invented values) and good to know. The names of the menus are not typed in the texts: they are written between double brackets and replaced by the real name of the menu, and a test checks that each one is a menu of the panel. The courses are written in French and in English.
- The messages and explanations of the panel that named old things are corrected: the Explorer tab (gone since version 0.11.0), the "grouping column" (the menu is "Item") and the link of the rows ("Linked to the selected row by").
- New files `guide.html`, `guide.css`, `guide.js` and `guide-content.js`; the page of the course window has no script and its own strict Content-Security-Policy.
- Tests: every text of the courses exists in French and in English, every menu named is a real menu, the sections and the samples, and in the page the opening of the course window and its content.

## 0.13.0

- Nine palettes of twenty colours, chosen with a palette button of the tool bar for all the charts of the dashboard (the menu shows the name and the twenty colours of each palette): Classic (the colours of the earlier default palette, then lighter ones), Acid (very saturated), Pastel, Warm colours, Cool colours, three ramps of one hue (red, green, blue, from dark to light) and Greys. The palette is a setting of the page, so the menu "Palette" of each chart is gone.
- A dashboard saved before takes the palette of its first chart (the earlier "Vivid" becomes Classic, "Soft" Pastel, "Cool" Cool colours, "High contrast" Classic), so that the charts keep their colours. Nothing is lost.
- A ramp gives its colours spread over its range, so that two or three series are well told apart; the other palettes give their colours in order. The names written in the rectangles of a treemap are dark or white according to the colour under them.
- The colour checks of the earlier palettes (3 to 1 against white and a distance between every pair) are replaced by checks that fit nine palettes: twenty different colours each, the classic start kept at 3 to 1, consecutive colours told apart, ramps in even steps.
- Tests: the nine palettes, the spreading of the ramps, the readable text colour, the palette of the page and the migration, and in the page the palette menu.

## 0.12.0

- Settings panel made compact. It now starts with the type of the block, in a menu, and a cross that closes the panel: the type can be changed at any time, and what a table and a chart have in common (table, rows, item, calculations, filters, sort) is kept when changing between them; for the other changes the settings start again (Ctrl+Z brings the previous ones back). The title "Block settings", the "Close" button and the explanations that were always shown (help text of the text block, order hint of the sort, help of the named values) are gone.
- The "?" badges of the panel are gone: the explanation of a menu is shown when the mouse stays on its name. Only the badge of "Rows linked to the selected row by", which has a link to the window that counts the rows, is kept. The spaces between the menus are smaller. The delete button stays at the bottom, smaller.
- Tests: the hover explanations, the single remaining badge, the type menu and what is kept when changing the type.

## 0.11.1

- Tool bar: the diagnostic button now shows a developer behind a laptop, the named values button is an icon with the Greek letter pi (with its explanation under it on hover), and the page format button shows two sheets of different sizes so that it is no longer mistaken for the orientation button.
- The message "Saved in the widget." is no longer written after each change; only a failed save is reported.
- Tests: the named values button as an icon and the silence after a save.

## 0.11.0

- The tool bar is now a single line of small icon buttons, so that it no longer takes the screen. In reading mode: "Edit" and the print button. In editing mode: "Finish editing", then the plus button (a menu of the types of blocks: choosing one creates the block and opens its settings), the page format, the orientation (one button that switches between landscape and portrait and shows the current one), the margins, the footer text, the page numbers (a button that changes colour when it is on), the refresh of the data and the print button; the named values and the diagnostic are set apart on the right. The "Add a block" button and all the "?" badges of the tool bar are gone: the explanation of a button is written under it when the mouse stays on it, without covering it. The line of explanations that was always shown is now the tip of the "Finish editing" button.
- A thin zoom slider at the bottom right of the widget replaces the three zoom buttons (a double click brings it back to the width of the page).
- The "Explorer" and "Query lab" tabs are gone, and so is the tab bar. The widget keeps what the dashboard needs from the explorer (the reading of the document and of the selected row). The diagnostic report of the explorer is now given by a "debug" button of the editing tool bar: one click reads the document again, tests the attachments (nothing is written in the document) and copies the report to the clipboard, with a new section that describes the dashboard (page, blocks, saved size). If the browser refuses the clipboard, the report is shown in a box to copy by hand. The test that writes a marker in a cell is no longer part of it. About 80 texts of the explorer and of the lab were removed from the translations.
- The pencil of the blocks is gone: a double click opens the settings, and a cross (shown on the block under the mouse and on the selected block) deletes the block at once, with no question. So does the Delete key and the delete button of the settings. Ctrl+Z undoes the last change of the dashboard (a move, a deletion, a setting, up to 100 steps; typed text is grouped), Ctrl+Y or Ctrl+Shift+Z does it again. Inside a field the browser keeps its own Ctrl+Z for the text.
- New file `icons.js` (the icons are drawn with createElementNS, never written as HTML).
- Tests: the icons, the report with the dashboard, and in the page the menus of the tool bar, the orientation and numbers buttons, the zoom slider, the debug button, the cross and the undo.

## 0.10.1

- Charts: the name of a series (in the legend) is now the name of the column alone for a sum (`SUB`), then the column and the calculation in lower case for the others (`SUB (average)`, `SUB (maximum)`). The heading of a table is unchanged. A name typed in the settings still wins.
- Scatter plot made easier to use: choosing this kind on a chart that was grouped takes away the item and the item in columns by itself (the table becomes a plain list); the menus "Item" and the calculation menus of the columns are hidden since they do not apply; the title of the list of columns says what each column does (1st: horizontal axis, 2nd: vertical axis, 3rd, optional: colour); the message of the settings names the menus really used ("Item", "Item in columns") instead of a "grouping" that does not exist in the panel. The legend appears when a third column gives several colours, and not for a single series.
- Tests: the names of the series and, in the page, the change to a scatter plot, the hidden menus and the legend of a stacked chart.

## 0.10.0

- Three more kinds of chart in the block "Chart":
  - Stacked areas: like the stacked columns but with smooth layers, one per series, from a grouped or cross table.
  - Treemap: one rectangle per item, the area proportional to the first calculation, in the colours of the palette, with the name written inside (and the value or the percentage with the labels setting). Items with a zero or negative value are left out.
  - Scatter plot: made from a table without grouping. The first column gives the horizontal axis, the second the vertical axis (both must be numbers; a row without both is left out) and an optional third column gives one colour per value (at most ten colours). The axes carry the names of the columns and the legend only appears when there are several colours. The settings tell which column does what.
- The custom build of Apache ECharts now also holds the scatter and treemap charts (`vendor/echarts`, new checksum and `VENDOR.md` updated, same licences).
- Tests: the options of the three kinds, the points of a scatter chart (axes, colours, rows left out), the cleaning of the settings and the drawing in the page with the settings.

## 0.9.1

- Printing: a blank sheet was inserted after every page when the print dialog of the browser kept margins of its own (for example the choice "Minimum" in "Margins"): the page of the dashboard, a little taller than the printable area, spilled onto a second sheet. In print the page now follows the printable area (`100vw` by `100vh`), so there is exactly one sheet per page whatever the margins chosen; when the margins are at zero, as the dashboard asks, the page is the full sheet as before. The message of the print window also tells to set "Margins" to "Default" or "None".
- Named values: "Add a value" now gives the new value the same type as the previous one (for example "Column of the selected row") instead of always "Calculation on a table", so the same fields are asked. The type stays editable at the top right of the card. The first value still starts as a calculation.
- Tests: the PDF of the print window keeps one sheet per page when the dialog imposes margins, and the type of a new named value.

## 0.9.0

- Printing and PDF. A new button "Print" (always visible, next to "Edit") opens a window of the widget that holds all the pages of the dashboard for the selected row, drawn at their real size by the same code as the screen, then opens the print dialog of the browser: choose "Save as PDF" or a printer. The window waits until the pictures are loaded. If the dialog does not open (the frame of Grist may forbid it), the Print button of the window or the keys Ctrl+P do the same.
  - The size of the sheet follows the format and the orientation of the dashboard (screen, A3, A4, A5, square), with no margin added by the browser: the margins of the dashboard are the margins of the sheet. One small static style sheet per format and orientation is kept in the folder `print/`, because the size of a printed page cannot be set from a script. One page of the dashboard is one sheet.
  - The charts are kept as vector drawings, the text stays selectable in the PDF.
  - New page `print.html` with its own strict Content-Security-Policy (no script).
- Footer of the pages, set in the tools in editing mode: a checkbox "Page numbers" (written at the bottom right as "Page 2 of 5") and a free text "Footer" (written at the bottom left). Both are shown on screen and printed, in the bottom margin, which needs at least 5 mm. The settings are saved with the page settings (`numbers` and `footer`, off and empty by default: a dashboard saved before is unchanged).
- Tests: the cleaning of the new page settings and, in the page, the print window (number of pages, real size, blocks and chart drawn, the screen unchanged afterwards), the PDF produced from it (number of sheets and size A4 landscape), the footer and the page numbers.

## 0.8.1

- Image block: the caption is now the value of a column of the selected row, chosen in a menu (a column of a linked table is possible), written under the photo, centred and at the width of the photo. It changes with the row. The free text with fields of version 0.8.0 is dropped: the key `caption` now holds the path of the column, and an old text is not a path so it is simply ignored.
- Image block: the rank of the picture is typed with the keyboard (a number from 1 to 20) instead of being chosen in a list. A value out of range is ignored and the last valid number comes back when the field is left.
- Tests: the cleaning of the caption column and, in the page, the caption read from a column and the rank typed.

## 0.8.0

- The block "Image" shows a picture of the selected row. The picture comes from an attachments column or from a text column that holds https links, one per line; a column of a linked table can be chosen too (written Reference > Column). When the cell holds several pictures, a setting gives the rank of the one to show (the same rank for every row).
  - The picture fills the whole frame without being deformed: it stays centred and the edges are cut when its proportions differ from those of the block.
  - Share links of Nextcloud (the download address of the share is used), Google Drive and kDrive are converted into addresses that a browser can load; OneDrive links, links that are not https and files that are not pictures (PDF, TIFF...) give a clear message in the block. A picture that cannot be loaded gives a message too.
  - An optional caption under the picture accepts the fields `{Column}` like a text block. The title of the block is shown above the picture.
  - Attachments are loaded through a picture element with the short-lived token of Grist: the strict Content-Security-Policy of the page does not change and the widget still opens no network connection of its own.
- New pure module `image.js` (reading of the cell and conversion of the links, from the image_plus widget of the same author, MIT licence) and the settings of the type `image` in the model (`path`, `rank`, `caption`; an image block saved before is empty so nothing breaks). `fields.js` gives the columns that can hold a picture.
- Tests: the reading of attachments and links, the conversion of the Nextcloud, Google Drive and kDrive links, the refused links, the cleaning of the settings and, in the page, the attachment with its token, the Nextcloud link, the refused links, the rank and the settings.

## 0.7.1

- Legend of the charts: the text is smaller, long names break onto several lines and the legend no longer scrolls. The room it takes is reserved, so the legend never overlaps the drawing: a legend on the right keeps the pie or the bars to its left, a legend at the top or the bottom keeps them below or above it, and the legend always stays inside the block.
- Tests: the breaking of long names and the room kept for the legend.

## 0.7.0

- The block "Chart" draws charts in SVG, so that they stay sharp in print and in the PDF. Seven kinds: grouped columns, stacked columns, horizontal bars, stacked horizontal bars, line, pie and donut (area, scatter and treemap charts come later).
  - The data are set with the same panel as a table block: kind of table, table, rows linked to the selected row, "Item" (the categories), "Item in columns" (the series, one colour each), the calculation, filters and sort. Without an item in columns each calculation is a series. A pie or a donut uses the first series. The total lines and the slices, which only make sense in a table, are hidden.
  - Look: kind of chart, palette, legend (none, top, bottom, right) and labels of the values (none, values, percentages for pies and donuts). The title of the block is the title of the chart.
  - Four palettes of ten colours, checked by a test: each colour keeps a 3 to 1 contrast against white and every pair of colours of a palette is told apart. "Vivid" (the default), "Soft", "High contrast" (suited to colour-blind readers) and "Cool". The exact hues of the reference documents will be given later.
- Apache ECharts 6.1.0 is copied into the repository as a custom build (`vendor/echarts`): only the bar, line and pie charts, the grid and legend, the label layout and the SVG renderer are in it, with its licences (Apache-2.0, BSD-3-Clause and 0BSD) and a record `VENDOR.md` (source, version, checksum and how to build it again). Nothing is loaded from the network and the strict Content-Security-Policy of the page is kept.
- New pure module `chart-option.js` (the options of the drawing and the palettes) and the settings of the type `chart` in the model (the settings of a table block plus `chart`, `palette`, `legend` and `labels`; a chart saved before is empty so nothing breaks). The results of grouped and cross tables also give the numbers of their series.
- Tests: the palettes (contrast and distinction), the options of every kind of chart, the cleaning of the settings, the numbers of the series, the build (no code run from text, no network, licences, checksum) and the drawing in the page with its settings.

## 0.6.5

- Cross table: choosing an item in columns on a table that has no calculation yet now adds the calculation line by itself (Somme, with the column left to choose), so the table can be filled. If the calculation is removed, the button "Add a column" comes back. In a cross table the title of the section is "Calculation of the cells" instead of "Columns", because the columns of the table are the values of the item in columns and a single calculation fills all the cells.
- Test: the calculation line after the choice of an item in columns.

## 0.6.4

- Cross tables. In the settings of a table block, a new menu "Item in columns (cross table)" appears under "Item". When an item is chosen there, the table becomes a cross table: the values of the item of the lines go down the left side, the values of the item in columns are along the top, and each cell holds one calculation (the first line of the columns settings, which is the only one used and is shown alone). Without an item in columns the table stays grouped, so tables saved by 0.6.3 stay valid.
- New settings for a cross table: "Columns per slice" (all, or 3, 4, 5, 6, 8, 10 or 12) cuts a wide table into slices of at most that number of columns, stacked one under the other; each slice has its own heading line, its total line and, if asked, its Total column on the right that combines the columns of that slice with its own calculation. "Order of the columns": by label or in the order of the table that the item points to.
- The order of the lines uses the choices of the sort section: by label (ascending or descending), in the order of the referenced table or a manual list (the choice "by value" is not offered for a cross table). The option "Merge identical labels" applies to the lines and to the columns.
- A cross table cut in several slices is not continued on the following pages (a table in one piece still is); a cross table that is too long for its frame is reported by the overflow stripe.
- Tests: the cross result (cells, totals, right total, slices, orders, counts, missing calculation), the cleaning of the new settings and the menus in the page.

## 0.6.3

- The block "Indicator" is no longer an empty frame. It is a card with a label (the title of the block), a value in bold and an optional small note under it.
  - The value is a named value chosen in a menu (the number, its unit and its decimals come from the named value). A value that does not exist or cannot be calculated shows a dash.
  - The note accepts the fields and the named values like a text (`sur {surface_totale}`).
  - The colour follows up to four rules "greater or equal to" or "less or equal to" a limit, read in order: the first rule that the value meets gives the colour, otherwise the default colour. Colours: none, green, orange, red, blue and grey. The card has a pale tinted background and a coloured bar on the left, the text stays dark, and a small symbol (check mark, exclamation mark, cross, i) tells the state without colour, for printing in black and white.
  - Size of the text: small, normal or large.
- New pure module `indicator.js` (colour of a number, symbols), `indicator-panel.js` (the settings) and the model settings of the type `indicator`: `value`, `note`, `size`, `base` and `rules`.
- Tests: cleaning of the settings, the colour for a number (first rule met, missing number, rules without limit), and the card and its settings in the page.

## 0.6.2

- The button "Named values" moves next to the button "Done" at the top of the dashboard (it was at the end of the line of the tools, out of sight on a narrow screen). It shows only in the editing mode.
- Test: the button is on the line of the Done button and hidden in the reading mode.

## 0.6.1

- Named values. A new button "Named values" in the tools of the dashboard opens, in the settings panel, the editor of the values of the whole dashboard (up to 40). A named value is a figure calculated once and reused. Three kinds:
  - Calculation on a table: the table, the way to choose its rows for the selected row (the same sentences as a table block, or the whole table), the function (Somme, Moy, Min, Max, Nb, Nb dif), the column (only numbers for sum, average, minimum and maximum; any column or the number of rows for the counts) and up to two filters.
  - Column of the selected row, also through a reference (`Reference > Column`): a number when the column holds numbers, otherwise a text.
  - Expression: a calculation with other values written between braces, such as `{part} / {total} * 100` (four operations, parentheses and the minus sign, read by a small parser and never run as code). A division by zero or a missing value gives a dash. Values can be defined in any order; a loop, an unknown name, a duplicate name or an empty name is reported on the card.
- Each value has a unit and a number of decimals for its text, and its card shows the result for the selected row, or the reason why there is none.
- In a text block, `{name}` gives the text of the value (number with its unit). A value takes priority over a column of the same name. The menu "Insert a field" lists the values ("Value: name").
- New pure module `named.js` (calculation of the values, tables to load) and `values-panel.js` (the editor), a new function `runValue` in `table-query.js`, and `expr.js` is now loaded by the page. The model has a new list `values`; models saved by 0.6.0 stay valid.
- Tests: cleaning of the values, calculations with filters and counts, columns, expressions, errors, tables to load, and the editor and the use in a text in the page.

## 0.6.0

- New block type "Sheet" (the identity band of a sheet). It shows the row selected in Grist as a grid of information, each one a small label above its value. In the settings: the list of information (a column of the linked table or of a table it points to, written `Reference > Column`, with an optional label that replaces the name of the column, and arrows to move or remove it), the number of columns of the grid (1 to 4) and the size of the text. The values are read with the same module as the fields of the text blocks (numbers, dates, references and lists shown as text, never as HTML).
- New pure module `record.js` (cells of a record block) with Node tests; the model has the new type `record` with the settings `items`, `columns` and `size`.
- The tables that the sheets cross are loaded like those of the fields of the text blocks. An unreadable information is reported in the settings and its cell stays empty.
- Tests: cleaning of the settings, the cells through a reference, an unknown column, the display and the settings in the page.

## 0.5.12

- Long tables are now automatic: the tick box "Long table: continue on the following pages" is gone and every table block continues on the following pages when its rows do not fit in its frame. The setting `flow` of the model is dropped; tables saved by 0.5.11 stay valid (the key is ignored).
- Test: a table continues by itself and the settings have no tick box for it.

## 0.5.11

- A double click on the rest of a long table (the blue frames on the following pages) opens the settings of that table, like a double click on its first frame. A simple click selects the table. The frames of the rest still cannot be moved, resized or deleted by themselves: only the first frame is the block.
- Test: the double click on the rest of a long table.

## 0.5.10

- Pages are now managed by the program. The buttons "Add a page" and "Remove the last page" are gone.
  - A new block that does not fit in the existing pages gets a new page.
  - In editing mode an empty page with a dashed outline always shows at the end, "New page: drop a block here to create it". It becomes a real page when a block is dropped on it, and it is not part of the saved pages while it stays empty.
  - A page that holds no block is removed by itself, at the end or in the middle: the blocks of the following pages move up and the pages are numbered again. To keep a blank page, add a block and leave it empty (no title, no content).
  - The pages that the rest of a long table needs are drawn without being saved: they appear when the table needs them and disappear when it gets shorter. A long table now only reports missing room when the maximum of 40 pages is reached.
- Long tables: each frame of the rest of a table takes the height of its rows, so that the rest of the page stays free for other blocks. Several long tables avoid each other's frames on the pages that follow.
- The model functions `addPage` and `removeLastPage` are replaced by `compactPages`. `moveBlock` accepts a page after the last one, which then exists.
- Tests: pages added and removed by themselves, dropping a block on the empty page at the end, the height of the frame of the rest of a table.

## 0.5.9

- Long tables over several pages. A new tick box in the table settings, "Long table: continue on the following pages", is off by default. When it is on and the rows do not fit in the block, the rest of the rows moves to the top of the following pages, at the same horizontal position and with the same width, in the free places left by the other blocks of those pages (a free place shorter than four steps is not used). The heading row is repeated and the title is followed by "(continued)". The heights of the rows are measured in the page, so the cut follows the real layout, and the total line stays with the last rows.
- The pages are not added by themselves: when the pages that exist have no room for all the rows, a message in the table settings says how many rows are missing and that a page must be added with "Add a page", and the last frame shows the red stripe of the overflow. The settings also say how many pages the table uses.
- The continuation frames cannot be selected, moved or resized: only the first frame is the block.
- New pure module `flow.js` (free places of the pages, cut of the rows) with Node tests, including a random test that every row is placed once and in order.
- The model has a new key `flow` (false by default); tables saved by 0.5.8 stay valid.

## 0.5.8

- Correction of the version numbers. Version 0.5.7 was published with the number 0.5.5 on its pages, so the browser kept old files from the cache and mixed them with the new ones, which could leave the menus empty. Every page, the package, the lock file and the explorer now carry 0.5.8, so the browser loads fresh files.
- Version 0.5.6 (the Total column on the right with its own calculation and decimals) was never published; it is part of this version, merged with the order of the items of 0.5.7.

## 0.5.7

- Order of the lines of a grouped table, in the Sort section of the "Filters and sort" menu. New choices next to "By label" (alphabetical and numeric order) and "By value":
  - "Order of the referenced table", offered when the item is a reference column or starts with one (for example the floors). The lines follow the order that you give to that table in Grist, which the widget reads from the manual order column that Grist sends for ordinary tables (without it, the order of the rows). The Direction menu reverses it.
  - "Manual list": the labels found in the table are listed with arrows to move them up or down. A label that you ranked is remembered even when the rows now shown do not have it (it is marked "missing here" and can be removed with its cross). Labels that are not ranked come after, in alphabetical order.
- The model keeps the manual order as `sort.order` and accepts the new sort kinds `ref` and `manual`; tables saved by 0.5.6 stay valid.
- Tests: the two new orders, with and without the manual order column, and the cleaning of the manual list.

## 0.5.6

- Total line (right): the Total column has its own calculation (Somme, Moy, Min, Max, Nb or Nb dif) and its own decimals buttons, shown under the tick box once it is ticked, whatever the calculations of the columns. It only needs at least two columns. Somme, Moy, Min and Max use the numbers of the line; Nb counts the filled cells and Nb dif the different values. In a list, the numbers are taken from the columns that hold numbers (every column for Nb and Nb dif). With the line below, the bottom right cell combines the totals of the columns with the same calculation.
- Tests: the calculations and the decimals of the total on the right, in a list and in a grouped table.

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
