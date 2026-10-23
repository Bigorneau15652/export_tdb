const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const N = require(`../named.js`);
const M = require(`../model.js`);
const { schema, dataset, demo } = require(`./helpers-dataset.js`);

const WORDS = { yes: `Yes`, no: `No` };
const record = (table, id) => {
  const index = demo.data[table].id.indexOf(id);
  const out = { id };
  for (const key of Object.keys(demo.data[table])) if (key !== `id`) out[key] = demo.data[table][key][index];
  return out;
};
const values = (list) => M.cleanValues(list);
const run = (list, linked = `Sites`, id = 1) => N.evaluateValues(schema, dataset, linked, record(linked, id), values(list), WORDS);

test(`the named values are cleaned: names, kinds, units, decimals and limits`, () => {
  const list = values([
    { name: `area`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `sum`, path: `Area`, unit: `m²`, decimals: 1, filters: [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 5 } }] },
    { name: `1bad`, kind: `unknown`, unit: `x`.repeat(40), decimals: 9, expr: `y`.repeat(900) },
    null,
    { name: `ratio`, kind: `expr`, expr: `{area} / 2` }
  ]);
  assert.equal(list.length, 3);
  assert.deepEqual([list[0].name, list[0].kind, list[0].unit, list[0].decimals, list[0].fn, list[0].path], [`area`, `calc`, `m²`, 1, `sum`, `Area`]);
  assert.equal(list[0].filters.length, 1);
  assert.deepEqual([list[1].name, list[1].kind, list[1].unit.length, list[1].decimals, list[1].expr.length], [``, `calc`, 12, -1, 500]);
  assert.equal(list[2].expr, `{area} / 2`);
  assert.equal(values(Array.from({ length: 90 }, () => ({ name: `a` }))).length, M.MAX_VALUES);
  assert.deepEqual(values(`x`), []);
  assert.deepEqual(M.validateModel(null).model.values, []);
  const model = M.setValues(M.emptyModel(), [{ name: `a`, kind: `field`, path: `Name` }]);
  assert.equal(M.validateModel(JSON.parse(JSON.stringify(model))).model.values[0].name, `a`);
});

test(`a calculation gives a number with its unit and decimals`, () => {
  const result = run([{ name: `area`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `sum`, path: `Area`, unit: `m²`, decimals: 1 }]);
  assert.equal(result.byName.get(`area`).number, 75.75);
  assert.equal(result.byName.get(`area`).text, `75,8 m²`);
  assert.equal(result.list[0].error, ``);
});

test(`filters and counts work like in a table`, () => {
  const filter = [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } }];
  const result = run([
    { name: `big`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `count`, path: `Area`, filters: filter },
    { name: `rows`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `count` },
    { name: `all`, kind: `calc`, table: `Rooms`, link: `all`, fn: `sum`, path: `Area` }
  ]);
  assert.equal(result.byName.get(`big`).number, 3);
  assert.equal(result.byName.get(`rows`).number, 4);
  assert.equal(result.byName.get(`all`).number, 120.75);
});

test(`a column of the selected row gives a number or a text`, () => {
  const result = run([{ name: `n`, kind: `field`, path: `Number` }, { name: `a`, kind: `field`, path: `Area`, unit: `m²` }], `Rooms`, 1);
  assert.equal(result.byName.get(`n`).text, `A-001`);
  assert.equal(result.byName.get(`n`).number, null);
  assert.equal(result.byName.get(`a`).number, 20.5);
  assert.equal(result.byName.get(`a`).text, `20,5 m²`);
});

test(`an expression combines other values, in any order, and a division by zero gives a dash`, () => {
  const result = run([
    { name: `ratio`, kind: `expr`, expr: `{part} / {total} * 100`, decimals: 1, unit: `%` },
    { name: `part`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `sum`, path: `Area` },
    { name: `total`, kind: `calc`, table: `Rooms`, link: `all`, fn: `sum`, path: `Area` },
    { name: `zero`, kind: `expr`, expr: `{part} / ({total} - {total})` }
  ]);
  assert.equal(result.byName.get(`ratio`).text, `62,7 %`);
  assert.equal(result.byName.get(`zero`).text, N.DASH);
  assert.equal(result.byName.get(`zero`).error, ``);
});

test(`errors are reported with a dash: loops, unknown names, duplicates, empty names, bad expressions, nothing chosen`, () => {
  const result = run([
    { name: `a`, kind: `expr`, expr: `{b} + 1` },
    { name: `b`, kind: `expr`, expr: `{a} + 1` },
    { name: `c`, kind: `expr`, expr: `{nothing}` },
    { name: `d`, kind: `expr`, expr: `1 +` },
    { name: `d`, kind: `expr`, expr: `2` },
    { name: ``, kind: `expr`, expr: `2` },
    { name: `e`, kind: `calc` },
    { name: `f`, kind: `calc`, table: `Rooms`, link: `Rooms.Nothing`, fn: `sum`, path: `Area` }
  ]);
  const errors = result.list.map((item) => item.error);
  assert.equal(errors[0], `loop`);
  assert.equal(errors[1], `loop`);
  assert.equal(errors[2], `unknownName`);
  assert.equal(errors[3], `expression`);
  assert.equal(errors[4], `duplicate`);
  assert.equal(errors[5], `name`);
  assert.equal(errors[6], `choose`);
  assert.equal(errors[7], `link`);
  assert.ok(result.list.every((item, index) => index === 4 || item.text === N.DASH || item.error === ``));
});

test(`the tables that the named values need are listed`, () => {
  const list = values([
    { name: `a`, kind: `calc`, table: `Rooms`, link: `Rooms.Site`, fn: `sum`, path: `Area` },
    { name: `b`, kind: `field`, path: `Parent.Name` },
    { name: `c`, kind: `expr`, expr: `1` }
  ]);
  const tables = N.tablesForValues(schema, `Sites`, list);
  assert.ok(tables.includes(`Rooms`) && tables.includes(`Sites`));
});
