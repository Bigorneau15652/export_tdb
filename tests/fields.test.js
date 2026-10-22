// Tests of the fields of a text: which are written, which columns can be chosen, which tables are
// needed and how a value becomes a text.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const F = require(`../fields.js`);
const { parseMarkdown } = require(`../markdown.js`);
const { schema, dataset, demo } = require(`./helpers-dataset.js`);

const WORDS = { yes: `Oui`, no: `Non` };
const record = (table, id) => {
  const index = demo.data[table].id.indexOf(id);
  const out = { id };
  for (const key of Object.keys(demo.data[table])) if (key !== `id`) out[key] = demo.data[table][key][index];
  return out;
};
const field = (table, id, path) => F.resolveField(dataset, schema, table, record(table, id), path, WORDS);

test(`fields are the names between braces, without duplicates`, () => {
  assert.deepEqual(F.extractFields(`{Name} and {Building.Site.Name} and {Name}`), [`Name`, `Building.Site.Name`]);
  assert.deepEqual(F.extractFields(`{} { a} {1a} {a-b} {a.b.c.d.e}`), []);
  assert.deepEqual(F.extractFields(`no field`), []);
});

test(`the choices hold the columns and one level of references`, () => {
  const paths = F.fieldChoices(schema, `Rooms`).map((c) => c.path);
  assert.ok(paths.includes(`Number`) && paths.includes(`Building`) && paths.includes(`Building.Name`) && paths.includes(`Building.Site`));
  assert.ok(!paths.includes(`Building.Photo`) && !paths.includes(`Building.Managers`));
  assert.deepEqual(F.fieldChoices(schema, `Missing`), []);
});

test(`the tables needed follow the references and their labels`, () => {
  assert.deepEqual(F.tablesForPaths(schema, `Rooms`, [`Number`]), []);
  assert.deepEqual(F.tablesForPaths(schema, `Rooms`, [`Building`]).sort(), [`Buildings`]);
  assert.deepEqual(F.tablesForPaths(schema, `Rooms`, [`Building.Site.Name`]).sort(), [`Buildings`, `Sites`]);
  assert.deepEqual(F.tablesForPaths(schema, `Rooms`, [`Nope.x`]), []);
});

test(`own columns come from the record and are written the French way`, () => {
  assert.deepEqual(field(`Rooms`, 1, `Number`), { ok: true, text: `A-001` });
  assert.deepEqual(field(`Rooms`, 2, `Area`), { ok: true, text: `35` });
  assert.deepEqual(field(`Rooms`, 4, `Area`), { ok: true, text: `8,25` });
  assert.deepEqual(field(`Buildings`, 1, `Year`), { ok: true, text: `1965` });
  assert.deepEqual(field(`Buildings`, 1, `Inspected`), { ok: true, text: `08/01/2025` });
  assert.deepEqual(field(`Buildings`, 3, `Inspected`), { ok: true, text: `` });
  assert.deepEqual(field(`Usages`, 1, `Counts`), { ok: true, text: `Oui` });
  assert.deepEqual(field(`Usages`, 2, `Counts`), { ok: true, text: `Non` });
});

test(`references show their label and lists their items`, () => {
  assert.deepEqual(field(`Rooms`, 1, `Building`), { ok: true, text: `Building A` });
  assert.deepEqual(field(`Buildings`, 1, `Managers`), { ok: true, text: `First contact, Second contact` });
  assert.deepEqual(field(`Rooms`, 4, `Usage`), { ok: true, text: `` });
});

test(`a path through references reads the other table`, () => {
  assert.deepEqual(field(`Rooms`, 1, `Building.Name`), { ok: true, text: `Building A` });
  assert.deepEqual(field(`Rooms`, 5, `Building.Site.Name`), { ok: true, text: `South campus` });
  assert.deepEqual(field(`Rooms`, 1, `Building.Year`), { ok: true, text: `1965` });
  assert.deepEqual(field(`Rooms`, 4, `Usage.Label`), { ok: true, text: `` });
});

test(`an unknown column is reported, and a table that is not loaded too`, () => {
  assert.deepEqual(field(`Rooms`, 1, `Nope`), { ok: false, reason: `unknown` });
  assert.deepEqual(field(`Rooms`, 1, `Number.x`), { ok: false, reason: `unknown` });
  assert.deepEqual(field(`Rooms`, 1, `Building.Nope`), { ok: false, reason: `unknown` });
  const empty = require(`../dataset.js`).createDataset(schema, { Rooms: demo.data.Rooms });
  assert.deepEqual(F.resolveField(empty, schema, `Rooms`, record(`Rooms`, 1), `Building.Name`, WORDS), { ok: false, reason: `notloaded` });
});

test(`fields are replaced only in plain text and a value cannot change the layout`, () => {
  const resolve = (path) => (path === `evil` ? { ok: true, text: `**bold** [x](https://example.org) # title` } : path === `ok` ? { ok: true, text: `fine` } : { ok: false, reason: `unknown` });
  const tree = parseMarkdown(`# Hello {ok}\n\nValue: {evil} and *{ok}* and {missing}\n\n- item {ok}`);
  const { nodes, problems } = F.expandFields(tree, resolve);
  assert.deepEqual(problems, [`missing`]);
  assert.equal(nodes[0].children[0].value, `Hello fine`);
  const paragraph = nodes[1].children;
  assert.equal(paragraph[0].value, `Value: **bold** [x](https://example.org) # title and `);
  assert.deepEqual(paragraph.map((n) => n.type), [`text`, `em`, `text`]);
  assert.equal(paragraph[2].value, ` and {missing}`);
  assert.equal(nodes[2].items[0][0].value, `item fine`);
  assert.equal(JSON.stringify(tree).includes(`fine`), false);
});
