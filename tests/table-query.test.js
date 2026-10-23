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

test(`every table can be chosen, the ordinary tables first`, () => {
  const tables = Q.listAllTables(schema);
  assert.equal(tables.length, schema.order.length);
  const names = tables.map((t) => t.table);
  assert.ok(names.indexOf(`Rooms_summary_Usage`) > names.indexOf(`Usages`));
  assert.deepEqual(names.slice(0, 3), [`Buildings`, `Contacts`, `Floors`]);
  assert.equal(tables.find((t) => t.table === `Rooms_summary_Usage`).summary, true);
});

test(`the choices of rows of a table name the starting item and the link, the best first, all rows last`, () => {
  const floors = Q.listChoices(schema, `Rooms`, `Floors`);
  const values = floors.map((c) => c.value);
  assert.ok(values.includes(`Building|Floors.Building`));
  assert.equal(values[values.length - 1], `|all`);
  assert.equal(floors[0].value, `Floor|self`);
  assert.deepEqual(floors.find((c) => c.value === `Building|Floors.Building`).steps.map((s) => s.column), [`Building`]);
  const rooms = Q.listChoices(schema, `Rooms`, `Rooms`);
  assert.equal(rooms[0].value, `|self`);
  assert.ok(rooms.some((c) => c.value === `Building|Rooms.Building`));
  const buildings = Q.listChoices(schema, `Rooms`, `Buildings`);
  assert.ok(buildings.some((c) => c.value === `Building|self`));
  assert.deepEqual(Q.listChoices(schema, `Sites`, `Notes`).map((c) => c.value), [`|all`]);
});

test(`the same link reached by a longer way is not offered twice and the complicated links are marked advanced`, () => {
  const floors = Q.listChoices(schema, `Rooms`, `Floors`);
  assert.equal(floors.filter((c) => c.link === `Floors.Building`).length, 1);
  assert.equal(floors.find((c) => c.link === `Floors.Building`).advanced, false);
  assert.equal(floors.find((c) => c.kind === `all`).advanced, false);
  const advanced = floors.filter((c) => c.advanced);
  assert.ok(advanced.every((c) => c.steps.length > 1 || c.quality !== `direct`));
  const rooms = Q.listChoices(schema, `Sites`, `Rooms`);
  assert.ok(rooms.some((c) => c.advanced));
  assert.ok(rooms.filter((c) => !c.advanced).map((c) => c.value).includes(`|Rooms.Site`));
});

test(`a choice gives the same rows as the starting item and the link it names`, () => {
  const choice = Q.listChoices(schema, `Rooms`, `Floors`).find((c) => c.value === `Building|Floors.Building`);
  const result = run(`Rooms`, 1, { table: `Floors`, start: choice.start, link: choice.link, columns: [{ path: `Label` }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows, [[`Ground`], [`Level 1`]]);
});

test(`nothing chosen gives a request to choose, and a missing table is reported`, () => {
  assert.deepEqual(run(`Sites`, 1, {}), { ok: false, reason: `choose` });
  assert.deepEqual(run(`Sites`, 1, { table: `Rooms` }), { ok: false, reason: `choose` });
  assert.equal(Q.runTable(schema, require(`../dataset.js`).createDataset(schema, {}), `Sites`, record(`Sites`, 1), config({ table: `Rooms`, link: `all`, columns: [{ path: `Area` }] }), WORDS).reason, `notloaded`);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site` }).reason, `columns`);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], columns: [{ path: `Number` }, { path: `` }] }).ok, true);
  assert.equal(run(`Sites`, 1, { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], columns: [{ path: `` }] }).reason, `groups`);
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

test(`a dynamic table can show the table of the selected row, the tables that point to it and the tables of its items`, () => {
  const rooms = Q.listDynamicTables(schema, `Rooms`);
  assert.deepEqual(rooms.map((t) => `${t.group}:${t.table}`), [`own:Rooms`, `related:Buildings`, `related:Floors`, `related:Sites`, `related:Usages`]);
  const sites = Q.listDynamicTables(schema, `Sites`);
  assert.deepEqual(sites.filter((t) => t.group === `own`).map((t) => t.table), [`Buildings`, `Floors`, `Rooms`, `Sites`]);
  assert.ok(!sites.some((t) => t.table === `Notes`));
  const summary = Q.listDynamicTables(schema, `Usages`);
  assert.ok(summary.some((t) => t.group === `summary` && t.table === `Rooms_summary_Usage`));
});

test(`the numeric columns are the numbers and the columns of type Any, also through references`, () => {
  const numeric = Q.numericPaths(schema, `Rooms`);
  assert.ok(numeric.has(`Area`) && numeric.has(`Seats`) && numeric.has(`Building.Year`));
  assert.ok(!numeric.has(`Number`) && !numeric.has(`Building`) && !numeric.has(`Building.Name`) && !numeric.has(`Tags`));
});

test(`every choice of rows says how many rows it keeps for the selected row`, () => {
  const lines = Q.explainChoices(schema, dataset, `Rooms`, record(`Rooms`, 1), `Floors`);
  const byValue = Object.fromEntries(lines.map((line) => [line.choice.value, line.kept]));
  assert.equal(byValue[`Floor|self`], 1);
  assert.equal(byValue[`Building|Floors.Building`], 2);
  assert.equal(byValue[`|all`], 4);
  assert.ok(lines.every((line) => line.total === 4));
  const unloaded = Q.explainChoices(schema, require(`../dataset.js`).createDataset(schema, {}), `Rooms`, record(`Rooms`, 1), `Floors`);
  assert.ok(unloaded.every((line) => line.kept === null));
  const needed = Q.tablesForChoices(schema, `Rooms`, `Floors`).sort();
  assert.deepEqual(needed, [`Buildings`, `Floors`, `Rooms`, `Sites`]);
});

test(`a column can impose its own decimals, otherwise the table decimals apply`, () => {
  const result = run(`Sites`, 1, { decimals: 1, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Area`, decimals: 2 }, { path: `Area` }, { path: `Area`, decimals: -1 }] });
  assert.deepEqual(result.rows[0], [`20,50`, `20,5`, `20,5`]);
});
