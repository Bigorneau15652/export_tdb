// Tests of the sums, groupings and cross tables, with a comparison against a naive calculation.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { summarize, compareLabels, groupRows, crossTable, sliceColumns } = require(`../aggregate.js`);
const { buildSchema } = require(`../schema.js`);
const { createDataset } = require(`../dataset.js`);
const { dataset } = require(`./helpers-dataset.js`);

const rooms = [0, 1, 2, 3, 4, 5];
const by = (path, extra = {}) => ({ groupBy: [{ path }], measures: [{ fn: `sum`, path: `Area` }], ...extra });

test(`summarize computes each function and never shows a missing value as 0`, () => {
  assert.equal(summarize([1, 2, 3.5], `sum`), 6.5);
  assert.equal(summarize([1, 2, 3], `avg`), 2);
  assert.equal(summarize([4, 1, 9], `min`), 1);
  assert.equal(summarize([4, 1, 9], `max`), 9);
  assert.equal(summarize([4, 1, 9], `count`), 3);
  assert.equal(summarize([4, 4, 9], `distinct`), 2);
  assert.equal(summarize([], `sum`), 0);
  assert.equal(summarize([], `avg`), null);
  assert.equal(summarize([], `min`), null);
  assert.equal(summarize([1, null, NaN, undefined], `count`), 1);
  assert.equal(summarize([1], `nope`), null);
});

test(`labels are compared as numbers or as French texts`, () => {
  assert.ok(compareLabels(`2`, `10`) < 0);
  assert.ok(compareLabels(`a`, `b`) < 0);
  assert.ok(compareLabels(`Été`, `Zèbre`) < 0);
  assert.ok(compareLabels(``, `a`) < 0);
  assert.equal(compareLabels(`x`, `x`), 0);
});

test(`rows are grouped by a column and the measure is summed`, () => {
  const result = groupRows(dataset, `Rooms`, rooms, by(`Usage`, { emptyLabel: `(none)` }));
  assert.deepEqual(result.rows.map((r) => [r.keys[0], r.values[0], r.count]), [[`(none)`, 8.25, 1], [`Classroom`, 75, 2], [`Office`, 37.5, 3]]);
  assert.deepEqual(result.totals, [120.75]);
  assert.equal(result.count, 6);
});

test(`the key can go through a reference`, () => {
  const result = groupRows(dataset, `Rooms`, rooms, by(`Building.Site.Name`));
  assert.deepEqual(result.rows.map((r) => [r.keys[0], r.values[0]]), [[`North campus`, 80.75], [`South campus`, 40]]);
});

test(`a measure can be an average, a minimum, a maximum, a count or a distinct count`, () => {
  const spec = { groupBy: [], measures: [{ fn: `avg`, path: `Area` }, { fn: `min`, path: `Area` }, { fn: `max`, path: `Area` }, { fn: `count`, path: `Seats` }, { fn: `distinct`, path: `Building` }, { fn: `count` }] };
  const result = groupRows(dataset, `Rooms`, rooms, spec);
  assert.deepEqual(result.rows[0].values, [20.125, 5, 40, 6, 3, 6]);
  assert.deepEqual(result.totals, result.rows[0].values);
});

test(`a count of a column ignores the empty values`, () => {
  const result = groupRows(dataset, `Rooms`, rooms, { groupBy: [], measures: [{ fn: `count`, path: `Usage` }, { fn: `count`, path: `Tags` }] });
  assert.deepEqual(result.rows[0].values, [5, 2]);
});

test(`groups are sorted by label, by value or in an imposed order`, () => {
  const labels = (sort) => groupRows(dataset, `Rooms`, rooms, by(`Usage`, { sort, emptyLabel: `(none)` })).rows.map((r) => r.keys[0]);
  assert.deepEqual(labels(undefined), [`(none)`, `Classroom`, `Office`]);
  assert.deepEqual(labels({ by: `key`, dir: `desc` }), [`Office`, `Classroom`, `(none)`]);
  assert.deepEqual(labels({ by: `value`, dir: `desc` }), [`Classroom`, `Office`, `(none)`]);
  assert.deepEqual(labels({ by: `value`, dir: `asc` }), [`(none)`, `Office`, `Classroom`]);
  assert.deepEqual(labels({ order: [`Office`, `Classroom`] }), [`Office`, `Classroom`, `(none)`]);
});

test(`the best groups are kept and the others are merged`, () => {
  const result = groupRows(dataset, `Rooms`, rooms, by(`Usage`, { sort: { by: `value`, dir: `desc` }, top: { count: 1, otherLabel: `Others` }, emptyLabel: `(none)` }));
  assert.deepEqual(result.rows.map((r) => [r.keys[0], r.values[0], r.count]), [[`Classroom`, 75, 2], [`Others`, 45.75, 4]]);
  const all = groupRows(dataset, `Rooms`, rooms, by(`Usage`, { top: { count: 5 } }));
  assert.equal(all.rows.length, 3);
});

test(`rows can be grouped by two keys and by the year or the month of a date`, () => {
  const two = groupRows(dataset, `Rooms`, rooms, { groupBy: [{ path: `Building.Site.Name` }, { path: `Usage` }], measures: [{ fn: `count` }] });
  assert.deepEqual(two.rows.map((r) => r.keys.join(`|`)), [`North campus|`, `North campus|Classroom`, `North campus|Office`, `South campus|Classroom`]);
  const years = groupRows(dataset, `Buildings`, [0, 1, 2, 3], { groupBy: [{ path: `Inspected`, bucket: `year` }], measures: [{ fn: `count` }], emptyLabel: `unknown` });
  assert.deepEqual(years.rows.map((r) => [r.keys[0], r.values[0]]), [[`2024`, 1], [`2025`, 2], [`unknown`, 1]]);
  const months = groupRows(dataset, `Buildings`, [0, 1], { groupBy: [{ path: `Inspected`, bucket: `month` }], measures: [{ fn: `count` }] });
  assert.deepEqual(months.rows.map((r) => r.keys[0]), [`2024-01`, `2025-01`]);
});

test(`two rows that have the same label stay two groups`, () => {
  const result = groupRows(dataset, `Rooms`, rooms, by(`Building`));
  assert.deepEqual(result.rows.map((r) => [r.keys[0], r.values[0]]), [[`Building A`, 60.5], [`Building A`, 40], [`Building B`, 20.25]]);
  const cross = crossTable(dataset, `Rooms`, rooms, { rowPath: `Building`, colPath: `Usage`, measure: { fn: `count` }, emptyLabel: `(none)` });
  assert.deepEqual(cross.rowKeys, [`Building A`, `Building A`, `Building B`]);
  assert.equal(cross.grandTotal, 6);
});

test(`equal labels can be merged into one group on request`, () => {
  const merged = groupRows(dataset, `Rooms`, rooms, { groupBy: [{ path: `Building`, merge: true }], measures: [{ fn: `sum`, path: `Area` }] });
  assert.deepEqual(merged.rows.map((r) => [r.keys[0], r.values[0]]), [[`Building A`, 100.5], [`Building B`, 20.25]]);
  const cross = crossTable(dataset, `Rooms`, rooms, { rowPath: `Building`, rowMerge: true, colPath: `Usage`, measure: { fn: `count` }, emptyLabel: `(none)` });
  assert.deepEqual(cross.rowKeys, [`Building A`, `Building B`]);
  assert.equal(cross.grandTotal, 6);
});

test(`an unreadable path is reported`, () => {
  assert.match(groupRows(dataset, `Rooms`, rooms, by(`Nope`)).error, /Nope/);
  assert.match(groupRows(dataset, `Rooms`, rooms, { groupBy: [], measures: [{ fn: `sum`, path: `Nope` }] }).error, /Nope/);
});

test(`no rows give no groups and zero totals`, () => {
  const result = groupRows(dataset, `Rooms`, [], by(`Usage`));
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.totals, [0]);
});

test(`a cross table has lines, columns, totals and empty cells`, () => {
  const cross = crossTable(dataset, `Rooms`, rooms, { rowPath: `Building.Site.Name`, colPath: `Usage`, measure: { fn: `sum`, path: `Area` }, emptyLabel: `(none)` });
  assert.deepEqual(cross.rowKeys, [`North campus`, `South campus`]);
  assert.deepEqual(cross.colKeys, [`(none)`, `Classroom`, `Office`]);
  assert.deepEqual(cross.cells, [[8.25, 35, 37.5], [null, 40, null]]);
  assert.deepEqual(cross.rowTotals, [80.75, 40]);
  assert.deepEqual(cross.colTotals, [8.25, 75, 37.5]);
  assert.equal(cross.grandTotal, 120.75);
});

test(`a cross table accepts an imposed order and an unreadable path is reported`, () => {
  const cross = crossTable(dataset, `Rooms`, rooms, { rowPath: `Usage`, colPath: `Building`, measure: { fn: `count` }, rowOrder: [`Office`], colOrder: [`Annex`] });
  assert.equal(cross.rowKeys[0], `Office`);
  assert.equal(crossTable(dataset, `Rooms`, rooms, { rowPath: `Nope`, colPath: `Usage`, measure: { fn: `count` } }).error.includes(`Nope`), true);
});

test(`columns of a cross table are cut into slices`, () => {
  const cross = { colKeys: [`a`, `b`, `c`, `d`, `e`], colTotals: [1, 2, 3, 4, 5], cells: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]] };
  const slices = sliceColumns(cross, 2);
  assert.deepEqual(slices.map((s) => s.colKeys), [[`a`, `b`], [`c`, `d`], [`e`]]);
  assert.deepEqual(slices[2].cells, [[5], [10]]);
  assert.deepEqual(slices[1].colTotals, [3, 4]);
  assert.equal(sliceColumns(cross, 99).length, 1);
  assert.equal(sliceColumns({ colKeys: [], colTotals: [], cells: [] }, 3).length, 1);
});

// A small random generator, so that the test is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test(`the grouping gives the same sums as a naive calculation on random tables`, () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const next = random(seed);
    const count = 1 + Math.floor(next() * 200);
    const categories = 1 + Math.floor(next() * 6);
    const data = { id: [], Cat: [], Value: [] };
    const naive = new Map();
    for (let i = 0; i < count; i += 1) {
      const cat = `c${Math.floor(next() * categories)}`;
      const value = next() < 0.15 ? null : Math.round(next() * 10000) / 100;
      data.id.push(i + 1);
      data.Cat.push(cat);
      data.Value.push(value);
      const entry = naive.get(cat) || { sum: 0, count: 0, max: null };
      if (value !== null) {
        entry.sum += value;
        entry.count += 1;
        entry.max = entry.max === null || value > entry.max ? value : entry.max;
      }
      naive.set(cat, entry);
    }
    const schema = buildSchema({ id: [1], tableId: [`T`] }, { id: [1, 2], parentId: [1, 1], colId: [`Cat`, `Value`], type: [`Text`, `Numeric`] });
    const ds = createDataset(schema, { T: data });
    const result = groupRows(ds, `T`, data.id.map((_, i) => i), { groupBy: [{ path: `Cat` }], measures: [{ fn: `sum`, path: `Value` }, { fn: `count`, path: `Value` }, { fn: `max`, path: `Value` }] });
    assert.equal(result.rows.length, naive.size);
    for (const row of result.rows) {
      const expected = naive.get(row.keys[0]);
      assert.ok(Math.abs(row.values[0] - expected.sum) < 1e-6, `seed ${seed}`);
      assert.equal(row.values[1], expected.count);
      assert.equal(row.values[2], expected.max);
    }
    const total = [...naive.values()].reduce((a, b) => a + b.sum, 0);
    assert.ok(Math.abs(result.totals[0] - total) < 1e-6);
  }
});
