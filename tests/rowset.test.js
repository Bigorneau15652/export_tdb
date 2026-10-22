// Tests of the search of the rows that belong to the selected row, and of the filters.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { findDescendants } = require(`../schema.js`);
const { rowsInContext, contextRowId, allRows, applyFilters } = require(`../rowset.js`);
const { schema, dataset } = require(`./helpers-dataset.js`);

const pathsOf = (start, table) => findDescendants(schema, start).find((entry) => entry.table === table).paths;
const byColumns = (paths, columns) => paths.find((path) => path.map((s) => s.column).join(`.`) === columns);

test(`the rows of a table that point directly to the selected row`, () => {
  const chain = byColumns(pathsOf(`Sites`, `Rooms`), `Site`);
  assert.deepEqual(rowsInContext(dataset, chain, 1), [0, 1, 2, 3]);
  assert.deepEqual(rowsInContext(dataset, chain, 2), [4, 5]);
});

test(`the rows reached through a building are not the same when the data disagrees`, () => {
  const chain = byColumns(pathsOf(`Sites`, `Rooms`), `Building.Site`);
  assert.deepEqual(rowsInContext(dataset, chain, 1), [0, 1, 2, 3, 5]);
  assert.deepEqual(rowsInContext(dataset, chain, 2), [4]);
});

test(`a chain of three references finds the rows`, () => {
  const chain = byColumns(pathsOf(`Sites`, `Rooms`), `Floor.Building.Site`);
  assert.deepEqual(rowsInContext(dataset, chain, 1), [0, 1, 2, 3, 5]);
});

test(`a chain through a list of references finds the rows`, () => {
  const chain = pathsOf(`Contacts`, `Buildings`)[0];
  assert.deepEqual(rowsInContext(dataset, chain, 2), [0, 3]);
  assert.deepEqual(rowsInContext(dataset, chain, 1), [0]);
});

test(`a row with no child gives no rows`, () => {
  const chain = byColumns(pathsOf(`Sites`, `Rooms`), `Site`);
  assert.deepEqual(rowsInContext(dataset, chain, 99), []);
});

test(`allRows lists every row`, () => {
  assert.deepEqual(allRows(dataset, `Floors`), [0, 1, 2, 3]);
  assert.deepEqual(allRows(dataset, `Missing`), []);
});

const context = { dataset, linked: `Buildings`, selectedId: 1 };
const keep = (rows, filters, ctx = context) => applyFilters(rows, `Rooms`, filters, ctx);
const everything = [0, 1, 2, 3, 4, 5];

test(`a filter compares a column with a constant`, () => {
  assert.deepEqual(keep(everything, [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 20 } }]).rows, [0, 1, 4]);
  assert.deepEqual(keep(everything, [{ path: `Area`, op: `le`, value: { kind: `const`, value: 8.25 } }]).rows, [3, 5]);
  assert.deepEqual(keep(everything, [{ path: `Seats`, op: `eq`, value: { kind: `const`, value: 0 } }]).rows, [2, 5]);
  assert.deepEqual(keep(everything, [{ path: `Seats`, op: `ne`, value: { kind: `const`, value: 0 } }]).rows, [0, 1, 3, 4]);
});

test(`a filter compares a column with a field of the selected row`, () => {
  const sameSite = { path: `Site`, op: `eq`, value: { kind: `field`, path: `Site` } };
  assert.deepEqual(keep(everything, [sameSite]).rows, [0, 1, 2, 3]);
  assert.deepEqual(keep(everything, [sameSite], { ...context, selectedId: 3 }).rows, [4, 5]);
});

test(`a filter compares a column with the number of the selected row`, () => {
  assert.deepEqual(keep(everything, [{ path: `Building`, op: `eq`, value: { kind: `id` } }]).rows, [0, 1, 5]);
});

test(`a filter on a reference column compares with the label`, () => {
  assert.deepEqual(keep(everything, [{ path: `Usage`, op: `eq`, value: { kind: `const`, value: `Office` } }]).rows, [0, 2, 5]);
  assert.deepEqual(keep(everything, [{ path: `Usage`, op: `in`, value: { values: [`Office`, `Classroom`] } }]).rows, [0, 1, 2, 4, 5]);
});

test(`a filter can go through a reference`, () => {
  assert.deepEqual(keep(everything, [{ path: `Usage.Counts`, op: `true` }]).rows, [0, 2, 5]);
  assert.deepEqual(keep(everything, [{ path: `Usage.Counts`, op: `false` }]).rows, [1, 3, 4]);
  assert.deepEqual(keep(everything, [{ path: `Building.Site.Name`, op: `eq`, value: { kind: `const`, value: `South campus` } }]).rows, [4]);
});

test(`empty and not empty`, () => {
  assert.deepEqual(keep(everything, [{ path: `Usage`, op: `empty` }]).rows, [3]);
  assert.deepEqual(keep(everything, [{ path: `Usage`, op: `notEmpty` }]).rows, [0, 1, 2, 4, 5]);
  assert.deepEqual(keep(everything, [{ path: `Tags`, op: `empty` }]).rows, [1, 3, 4, 5]);
});

test(`contains looks for a text, without regard to the case`, () => {
  assert.deepEqual(keep(everything, [{ path: `Number`, op: `contains`, value: { kind: `const`, value: `b-` } }]).rows, [2, 3]);
});

test(`filters are combined with AND`, () => {
  const filters = [
    { path: `Site`, op: `eq`, value: { kind: `field`, path: `Site` } },
    { path: `Usage.Counts`, op: `true` }
  ];
  assert.deepEqual(keep(everything, filters).rows, [0, 2]);
});

test(`a filter that cannot be read is reported and ignored`, () => {
  const result = keep(everything, [{ path: `Nope`, op: `eq`, value: { kind: `const`, value: 1 } }, { path: `Area`, op: `wrong` }]);
  assert.deepEqual(result.rows, everything);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /Nope/);
  assert.match(result.errors[1], /unknown operator/);
});

test(`a missing source gives no match for a comparison`, () => {
  assert.deepEqual(keep(everything, [{ path: `Area`, op: `gt`, value: { kind: `field`, path: `Nope` } }]).rows, []);
  assert.deepEqual(keep(everything, [{ path: `Area`, op: `gt` }]).rows, []);
});

test(`contextRowId follows single references from the selected row`, () => {
  assert.equal(contextRowId(dataset, [{ from: `Rooms`, column: `Building`, to: `Buildings` }], 1), 1);
  assert.equal(contextRowId(dataset, [{ from: `Rooms`, column: `Building`, to: `Buildings` }], 5), 3);
  const twoSteps = [{ from: `Rooms`, column: `Floor`, to: `Floors` }, { from: `Floors`, column: `Building`, to: `Buildings` }];
  assert.equal(contextRowId(dataset, twoSteps, 5), 3);
  assert.equal(contextRowId(dataset, [], 4), 4);
});

test(`contextRowId gives 0 when a reference is empty or the row is unknown`, () => {
  assert.equal(contextRowId(dataset, [{ from: `Rooms`, column: `Usage`, to: `Usages` }], 4), 0);
  assert.equal(contextRowId(dataset, [{ from: `Rooms`, column: `Building`, to: `Buildings` }], 99), 0);
  assert.equal(contextRowId(dataset, [{ from: `Missing`, column: `x`, to: `y` }], 1), 0);
});

test(`the rooms of the same building as a selected room`, () => {
  const buildingId = contextRowId(dataset, [{ from: `Rooms`, column: `Building`, to: `Buildings` }], 2);
  const chain = findDescendants(schema, `Buildings`).find((e) => e.table === `Rooms`).paths[0];
  assert.deepEqual(rowsInContext(dataset, chain, buildingId), [0, 1, 5]);
});
