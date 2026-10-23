// Tests of the text report of the explorer.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { buildReport } = require(`../report.js`);
const { buildSchema, findDescendants } = require(`../schema.js`);
const { metadata } = require(`./fixtures/demo-data.js`);

const schema = buildSchema(metadata._grist_Tables, metadata._grist_Tables_column);
const base = {
  version: `0.1.0`, reveal: false, linked: `Sites`, record: 1, events: 3,
  tables: schema.order.map((id) => schema.tables.get(id)), descendants: findDescendants(schema, `Sites`),
  shapes: [{ table: `Rooms`, column: `Tags`, type: `ChoiceList`, shape: `["L", text(6)]`, filled: 2, empty: 4 }],
  timings: [{ table: `Rooms`, rows: 6, columns: 11, ms: 12.4 }],
  tests: [{ name: `attachment token`, ok: true, detail: `` }, { name: `write`, ok: false, detail: `denied` }]
};

test(`the report has its six parts`, () => {
  const text = buildReport(base);
  for (const title of [`1. Linked table`, `2. Tables of the document (8)`, `3. Tables that descend`, `4. Shape of the values`, `5. Loading times`, `6. Tests of the API`]) {
    assert.ok(text.includes(title), title);
  }
});

test(`the report names the descendants, the shapes, the times and the tests`, () => {
  const text = buildReport(base);
  assert.match(text, /Rooms: \d+ path\(s\)/);
  assert.match(text, /Rooms\.Tags \[ChoiceList\] \["L", text\(6\)\] \(2\/4\)/);
  assert.match(text, /Rooms: 6 rows, 11 columns, 12 ms/);
  assert.match(text, /attachment token: OK/);
  assert.match(text, /write: FAILED - denied/);
});

test(`the report says whether values are shown and never prints the row id`, () => {
  assert.match(buildReport(base), /Values shown: no \(shapes only\)/);
  assert.match(buildReport({ ...base, reveal: true }), /Values shown: yes/);
  assert.doesNotMatch(buildReport({ ...base, record: 987654 }), /987654/);
});

test(`the report copes with nothing found`, () => {
  const text = buildReport({ ...base, linked: ``, record: null, tables: [], descendants: [], shapes: [], timings: [], tests: [] });
  assert.match(text, /Table: unknown/);
  assert.match(text, /Selected row id: none/);
});

test(`the loading line says whether the manual order column came with the table`, () => {
  const text = buildReport({ version: `x`, reveal: false, linked: `Sites`, record: 1, events: 1, tables: [], descendants: [], shapes: [], timings: [{ table: `Sites`, rows: 2, columns: 3, ms: 5, manualSort: true }, { table: `Rooms`, rows: 6, columns: 9, ms: 7, manualSort: false }, { table: `Old`, rows: 1, columns: 1, ms: 1 }], tests: [] });
  assert.match(text, /Sites: 2 rows, 3 columns, 5 ms, manual order column present/);
  assert.match(text, /Rooms: 6 rows, 9 columns, 7 ms, manual order column absent/);
  assert.match(text, /Old: 1 rows, 1 columns, 1 ms\n/);
});
