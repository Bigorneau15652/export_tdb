const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const R = require(`../record.js`);
const M = require(`../model.js`);
const { schema, dataset, demo } = require(`./helpers-dataset.js`);

const WORDS = { yes: `Yes`, no: `No` };
const record = (table, id) => {
  const index = demo.data[table].id.indexOf(id);
  const out = { id };
  for (const key of Object.keys(demo.data[table])) if (key !== `id`) out[key] = demo.data[table][key][index];
  return out;
};
const config = (changes) => M.cleanConfig(`record`, changes);

test(`the settings of a record block are cleaned`, () => {
  const clean = config({ items: [{ path: `Number`, label: `N°` }, { path: `bad path`, label: 5 }, null, { path: `Site.Name` }], columns: 3, size: `large`, extra: 1 });
  assert.deepEqual(clean, { items: [{ path: `Number`, label: `N°` }, { path: ``, label: `` }, { path: `Site.Name`, label: `` }], size: `large` });
  assert.deepEqual(config({}), { items: [], size: `normal` });
  assert.equal(config({ items: Array.from({ length: 80 }, () => ({ path: `A` })) }).items.length, M.MAX_RECORD_ITEMS);
  assert.ok(M.TYPES.includes(`record`));
  assert.ok(M.DEFAULT_SIZES.record.w > 0);
});

test(`the cells give a label and the text of the value, through references too`, () => {
  const result = R.recordCells(schema, dataset, `Rooms`, record(`Rooms`, 1), config({ items: [{ path: `Number` }, { path: `Site.Name`, label: `Site de la salle` }, { path: `Area` }, { path: `` }] }), WORDS);
  assert.deepEqual(result.cells.map((cell) => cell.label), [`Number`, `Site de la salle`, `Area`]);
  assert.equal(result.cells[0].text, `A-001`);
  assert.equal(result.cells[1].text.length > 0, true);
  assert.equal(result.cells[2].text, `20,5`);
  assert.deepEqual(result.problems, []);
});

test(`an unknown column gives an empty cell and is reported`, () => {
  const result = R.recordCells(schema, dataset, `Rooms`, record(`Rooms`, 1), config({ items: [{ path: `Nothing`, label: `?` }, { path: `Number` }] }), WORDS);
  assert.deepEqual(result.problems, [`Nothing`]);
  assert.equal(result.cells[0].text, ``);
  assert.equal(result.cells[1].text, `A-001`);
});

test(`the paths of a record block are the paths of its information`, () => {
  assert.deepEqual(R.recordPaths(config({ items: [{ path: `A` }, { path: `` }, { path: `B.C` }] })), [`A`, `B.C`]);
});

test(`the number of cells that fit on the line depends on the width of the block and on the size of the text`, () => {
  assert.equal(R.maxCells(190, `normal`), 6);
  assert.equal(R.maxCells(277, `normal`), 9);
  assert.ok(R.maxCells(400, `normal`) > R.maxCells(277, `normal`));
  assert.ok(R.maxCells(190, `small`) > R.maxCells(190, `large`));
  assert.equal(R.maxCells(5, `normal`), 1);
  assert.equal(R.maxCells(NaN, `normal`), 1);
  assert.equal(R.maxCells(100, `unknown`), R.maxCells(100, `normal`));
});
