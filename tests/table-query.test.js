// Tests of the table block engine: the starting rows, the links, the lists, the groupings, the totals
// and the messages, on the invented document.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const Q = require(`../table-query.js`);
const M = require(`../model.js`);
const { schema, dataset, demo } = require(`./helpers-dataset.js`);

const WORDS = { sum: `Sum`, avg: `Average`, min: `Min`, max: `Max`, count: `Count`, distinct: `Distinct`, total: `Total`, empty: `(empty)`, yes: `Yes`, no: `No` };
const record = (table, id) => {
  const index = demo.data[table].id.indexOf(id);
  const out = { id };
  for (const key of Object.keys(demo.data[table])) if (key !== `id`) out[key] = demo.data[table][key][index];
  return out;
};
const config = (changes) => M.cleanConfig(`table`, changes);
const run = (linked, id, changes) => Q.runTable(schema, dataset, linked, record(linked, id), config(changes), WORDS);

test(`the starting rows are the selected row and the items it points to`, () => {
  const starts = Q.listStarts(schema, `Rooms`);
  assert.deepEqual(starts.map((s) => [s.key, s.table]).slice(0, 3), [[``, `Rooms`], [`Building`, `Buildings`], [`Floor`, `Floors`]]);
  assert.ok(starts.some((s) => s.key === `Building.Site` && s.table === `Sites`));
});

test(`the tables and the links come with the best link first and all rows last`, () => {
  const tables = Q.listTables(schema, `Sites`).map((t) => t.table);
  assert.equal(tables[0], `Sites`);
  assert.ok(tables.includes(`Rooms`) && tables.includes(`Buildings`));
  const links = Q.listLinks(schema, `Sites`, `Rooms`);
  assert.equal(links[links.length - 1].key, `all`);
  assert.ok(links.some((l) => l.key === `Rooms.Site`));
  assert.deepEqual(Q.listLinks(schema, `Sites`, `Sites`).map((l) => l.key), [`self`, `all`]);
});

test(`nothing chosen gives a request to choose, and a missing table is reported`, () => {
  assert.deepEqual(run(`Sites`, 1, {}), { ok: false, reason: `choose` });
  assert.deepEqual(run(`Sites`, 1, { table: `Rooms` }), { ok: false, reason: `choose` });
  assert.equal(Q.runTable(schema, require(`../dataset.js`).createDataset(schema, {}), `Sites`, record(`Sites`, 1), config({ table: `Rooms`, link: `all`, columns: [{ path: `Area` }] }), WORDS).reason, `notloaded`);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site` }).reason, `columns`);
  assert.equal(run(`Sites`, 1, { mode: `group`, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Area` }] }).reason, `groups`);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Nope`, columns: [{ path: `Area` }] }).reason, `link`);
});

test(`a list shows the rooms of the selected site with texts written the French way`, () => {
  const result = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Building` }, { path: `Area`, fn: `sum` }, { path: `Seats` }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.headers.map((h) => h.text), [`Number`, `Building`, `Area`, `Seats`]);
  assert.deepEqual(result.headers.map((h) => h.numeric), [false, false, true, true]);
  assert.deepEqual(result.rows, [[`A-001`, `Building A`, `20,5`, `4`], [`A-002`, `Building A`, `35`, `10`], [`B-001`, `Building B`, `12`, `0`], [`B-002`, `Building B`, `8,25`, `1`]]);
  assert.equal(result.total, null);
  assert.equal(result.kept, 4);
});

test(`a list can have a total line with a function per column`, () => {
  const result = run(`Sites`, 1, { total: true, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area`, fn: `sum` }, { path: `Seats`, fn: `max` }, { path: `Building`, fn: `distinct` }] });
  assert.deepEqual(result.total, [`Total`, `75,75`, `10`, `2`]);
  const none = run(`Sites`, 1, { total: true, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }] });
  assert.equal(none.total, null);
});

test(`a list can be sorted by a column in both directions`, () => {
  const asc = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area` }], sort: { by: `column`, column: `Area`, dir: `asc` } });
  assert.deepEqual(asc.rows.map((r) => r[0]), [`B-002`, `B-001`, `A-001`, `A-002`]);
  const desc = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }], sort: { by: `column`, column: `Number`, dir: `desc` } });
  assert.deepEqual(desc.rows.map((r) => r[0]), [`B-002`, `B-001`, `A-002`, `A-001`]);
});

test(`decimals can be imposed`, () => {
  const result = run(`Sites`, 1, { decimals: 2, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Area` }] });
  assert.deepEqual(result.rows.map((r) => r[0]), [`20,50`, `35,00`, `12,00`, `8,25`]);
});

test(`a grouping gives one line per group with a total, sorted by label or by value`, () => {
  const base = { mode: `group`, table: `Rooms`, link: `Rooms.Site`, total: true, groupBy: [`Usage`], columns: [{ path: `Area`, fn: `sum` }, { fn: `count` }] };
  const byKey = run(`Sites`, 1, base);
  assert.deepEqual(byKey.headers.map((h) => h.text), [`Usage`, `Sum (Area)`, `Count`]);
  assert.deepEqual(byKey.rows, [[`(empty)`, `8,25`, `1`], [`Classroom`, `35`, `1`], [`Office`, `32,5`, `2`]]);
  assert.deepEqual(byKey.total, [`Total`, `75,75`, `4`]);
  const byValue = run(`Sites`, 1, { ...base, sort: { by: `value`, dir: `desc` } });
  assert.deepEqual(byValue.rows.map((r) => r[0]), [`Classroom`, `Office`, `(empty)`]);
  const labelled = run(`Sites`, 1, { ...base, columns: [{ path: `Area`, fn: `sum`, label: `Surface` }] });
  assert.equal(labelled.headers[1].text, `Surface`);
});

test(`a grouping by two columns has two key columns`, () => {
  const result = run(`Sites`, 1, { mode: `group`, table: `Rooms`, link: `Rooms.Site`, total: true, groupBy: [`Building`, `Usage`], columns: [{ path: `Area`, fn: `sum` }] });
  assert.equal(result.headers.length, 3);
  assert.deepEqual(result.total, [`Total`, ``, `75,75`]);
});

test(`filters keep the right rows, and an unreadable filter is reported`, () => {
  const filtered = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }], filters: [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } }] });
  assert.deepEqual(filtered.rows.map((r) => r[0]), [`A-001`, `A-002`, `B-001`]);
  assert.equal(filtered.kept, 3);
  assert.equal(filtered.scanned, 4);
  const empty = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }], filters: [{ path: `Usage`, op: `empty` }] });
  assert.deepEqual(empty.rows, [[`B-002`]]);
  const nonsense = M.cleanConfig(`table`, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }] });
  nonsense.filters = [{ path: `Nope`, op: `eq`, value: { kind: `const`, value: 1 } }];
  const bad = Q.runTable(schema, dataset, `Sites`, record(`Sites`, 1), nonsense, WORDS);
  assert.equal(bad.ok, true);
  assert.equal(bad.warnings.length, 1);
});

test(`the starting row can be a parent of the selected row and the rows follow the cursor`, () => {
  const changes = { start: `Building`, table: `Rooms`, link: `Rooms.Building`, columns: [{ path: `Number` }] };
  assert.deepEqual(run(`Rooms`, 1, changes).rows, [[`A-001`], [`A-002`], [`X-001`]]);
  assert.deepEqual(run(`Rooms`, 3, changes).rows, [[`B-001`], [`B-002`]]);
  assert.equal(run(`Rooms`, 1, { ...changes, start: `Nope` }).reason, `start`);
});

test(`the starting row alone and all the rows are links too`, () => {
  assert.deepEqual(run(`Rooms`, 2, { table: `Rooms`, link: `self`, columns: [{ path: `Number` }] }).rows, [[`A-002`]]);
  assert.equal(run(`Rooms`, 2, { table: `Rooms`, link: `all`, columns: [{ path: `Number` }] }).rows.length, 6);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `self`, columns: [{ path: `Number` }] }).reason, `link`);
});

test(`columns reached through references are written with their own labels`, () => {
  const result = run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Building.Site.Name` }, { path: `Floor.Label` }] });
  assert.deepEqual(result.rows[0], [`North campus`, `Ground`]);
});

test(`the tables needed include the starting row, the link and the paths`, () => {
  const needed = Q.tablesFor(schema, `Rooms`, config({ start: `Building`, table: `Rooms`, link: `Rooms.Building`, columns: [{ path: `Floor.Label` }], groupBy: [`Usage`] })).sort();
  assert.deepEqual(needed, [`Buildings`, `Floors`, `Rooms`, `Usages`]);
  assert.deepEqual(Q.tablesFor(schema, `Rooms`, config({})), []);
});

test(`random configurations never throw`, () => {
  let state = 7;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const paths = [``, `Number`, `Area`, `Seats`, `Building`, `Building.Name`, `Floor.Label`, `Usage`, `Tags`, `Nope`, `Surface`];
  const pick = (list) => list[Math.floor(next() * list.length)];
  for (let i = 0; i < 300; i += 1) {
    const changes = {
      mode: pick([`list`, `group`]), start: pick([``, `Building`, `Floor`, `Nope`]), table: pick([`Rooms`, `Buildings`, `Sites`, `Nope`]),
      link: pick([`all`, `self`, `Rooms.Site`, `Rooms.Building`, `Rooms.Nope`, ``]), groupBy: [pick(paths), pick(paths)], merge: next() < 0.5,
      columns: [{ path: pick(paths), fn: pick([``, `sum`, `avg`, `count`, `distinct`]) }, { path: pick(paths), fn: pick([``, `sum`, `max`]) }],
      filters: [{ path: pick(paths), op: pick(M.OPERATORS), value: { kind: `const`, value: pick([1, `a`, 10]) } }],
      sort: { by: pick(M.SORT_BYS), column: pick(paths), dir: pick([`asc`, `desc`]) }, total: next() < 0.5, decimals: pick([-1, 0, 2])
    };
    for (const linked of [`Rooms`, `Sites`]) {
      const result = Q.runTable(schema, dataset, linked, record(linked, 1), config(changes), WORDS);
      assert.equal(typeof result.ok, `boolean`);
      if (result.ok) assert.ok(result.rows.every((row) => row.length === result.headers.length));
    }
  }
});
