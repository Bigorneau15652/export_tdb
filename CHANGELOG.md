# Changelog

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
