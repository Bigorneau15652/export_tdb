# Changelog

## 0.1.0

- First version: an explorer that reads the structure of the Grist document (tables, columns, references, descendant tables), describes the shape of the values without revealing them, measures the loading time of the tables and tests the API functions that the dashboard widget will need (selected table, metadata, attachment token, writing in a cell). It produces a report to copy.
- Pure modules `schema.js`, `shape.js` and `report.js` with unit tests; integration tests in a browser with a fake Grist object and an invented document.
