// Tests of the tables in memory: labels of references, paths through references, inverse indexes.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { createDataset } = require(`../dataset.js`);
const { schema, dataset } = require(`./helpers-dataset.js`);

test(`a table is available with its rows and its columns`, () => {
  const rooms = dataset.table(`Rooms`);
  assert.equal(rooms.count, 6);
  assert.deepEqual(rooms.column(`Number`).slice(0, 2), [`A-001`, `A-002`]);
  assert.equal(rooms.column(`Missing`), null);
  assert.equal(rooms.rowOfId(3), 2);
  assert.equal(rooms.rowOfId(99), -1);
  assert.equal(rooms.columnMeta(`Area`).type, `Numeric`);
  assert.equal(dataset.table(`Nope`), null);
});

test(`a table that was not loaded is reported as absent`, () => {
  const partial = createDataset(schema, new Map([[`Sites`, { id: [1], Name: [`x`] }]]));
  assert.equal(partial.table(`Sites`).count, 1);
  assert.equal(partial.table(`Rooms`), null);
});

test(`the label of a reference is the column that Grist shows`, () => {
  const column = dataset.table(`Rooms`).columnMeta(`Building`);
  assert.equal(dataset.refLabel(column, 3), `Building A`);
  assert.equal(dataset.refLabel(column, 4), `Annex`);
  assert.equal(dataset.refLabel(column, 0), ``);
  assert.equal(dataset.refLabel(column, 999), ``);
});

test(`paths go through references and report their errors`, () => {
  const direct = dataset.resolvePath(`Rooms`, `Area`);
  assert.equal(direct.column.id, `Area`);
  const through = dataset.resolvePath(`Rooms`, `Building.Site.Name`);
  assert.deepEqual(through.steps.map((s) => `${s.table}.${s.column.id}`), [`Rooms.Building`, `Buildings.Site`, `Sites.Name`]);
  assert.match(dataset.resolvePath(`Rooms`, `Area.Name`).error, /not a reference/);
  assert.match(dataset.resolvePath(`Rooms`, `Nope`).error, /not found/);
  assert.match(dataset.resolvePath(`Rooms`, ``).error, /empty/);
  assert.match(dataset.resolvePath(`Missing`, `Name`).error, /not loaded/);
});

test(`the value at the end of a path follows the references`, () => {
  const path = dataset.resolvePath(`Rooms`, `Building.Site.Name`);
  assert.equal(dataset.valueAt(path, 0), `North campus`);
  assert.equal(dataset.valueAt(path, 4), `South campus`);
  const floor = dataset.resolvePath(`Rooms`, `Floor.Label`);
  assert.equal(dataset.textAt(floor, 1), `Level 1`);
});

test(`a broken or empty reference gives no value`, () => {
  const path = dataset.resolvePath(`Rooms`, `Usage.Label`);
  assert.equal(dataset.valueAt(path, 3), null);
  assert.equal(dataset.textAt(path, 3), ``);
  assert.equal(dataset.textAt(path, 0), `Office`);
});

test(`the text of a reference column is the label and of a list the labels`, () => {
  const usage = dataset.resolvePath(`Rooms`, `Usage`);
  assert.equal(dataset.textAt(usage, 1), `Classroom`);
  const managers = dataset.resolvePath(`Buildings`, `Managers`);
  assert.equal(dataset.textAt(managers, 0), `First contact, Second contact`);
  assert.equal(dataset.textAt(managers, 1), ``);
  assert.equal(dataset.textAt(dataset.resolvePath(`Buildings`, `Photo`), 0), `11, 12`);
});

test(`the inverse index lists the rows that point to a row`, () => {
  const bySite = dataset.inverseIndex(`Buildings`, `Site`);
  assert.deepEqual(bySite.get(1), [0, 1, 3]);
  assert.deepEqual(bySite.get(2), [2]);
  assert.equal(bySite.get(3), undefined);
});

test(`the inverse index follows a list of references and ignores empty ones`, () => {
  const byManager = dataset.inverseIndex(`Buildings`, `Managers`);
  assert.deepEqual(byManager.get(1), [0]);
  assert.deepEqual(byManager.get(2), [0, 3]);
  const byParent = dataset.inverseIndex(`Buildings`, `Parent`);
  assert.deepEqual([...byParent.keys()], [1]);
  assert.equal(dataset.inverseIndex(`Rooms`, `Missing`).size, 0);
});

test(`a reference whose label column is itself a reference is followed`, () => {
  const column = dataset.table(`Buildings`).columnMeta(`Parent`);
  assert.equal(dataset.refLabel(column, 1), `Building A`);
});
