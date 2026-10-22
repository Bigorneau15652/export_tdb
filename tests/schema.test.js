// Tests of the picture of the document structure and of the search of descendant tables.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { parseType, buildSchema, findDescendants, describeStep } = require(`../schema.js`);
const { metadata } = require(`./fixtures/demo-data.js`);

const schema = buildSchema(metadata._grist_Tables, metadata._grist_Tables_column);

test(`parseType reads references, lists and attachments`, () => {
  assert.deepEqual(parseType(`Ref:Sites`), { kind: `ref`, target: `Sites`, base: `Ref` });
  assert.deepEqual(parseType(`RefList:Contacts`), { kind: `reflist`, target: `Contacts`, base: `RefList` });
  assert.equal(parseType(`Attachments`).kind, `attachments`);
  assert.equal(parseType(`DateTime:Europe/Paris`).base, `DateTime`);
  assert.equal(parseType(``).base, `Any`);
  assert.equal(parseType(undefined).kind, `plain`);
});

test(`buildSchema lists the tables and leaves out the internal ones`, () => {
  assert.deepEqual(schema.order, [`Sites`, `Buildings`, `Floors`, `Rooms`, `Usages`, `Contacts`, `Notes`, `Rooms_summary_Usage`]);
  assert.equal(schema.tables.get(`Rooms_summary_Usage`).summary, true);
  assert.equal(schema.tables.get(`Rooms`).summary, false);
});

test(`buildSchema leaves out manual sort and helper columns`, () => {
  const names = schema.tables.get(`Rooms`).columns.map((c) => c.id);
  assert.ok(!names.includes(`manualSort`));
  assert.ok(!names.includes(`gristHelper_Display`));
  assert.ok(names.includes(`Surface`));
});

test(`buildSchema gives the kind, the target and the displayed column of a reference`, () => {
  const column = schema.tables.get(`Rooms`).columns.find((c) => c.id === `Building`);
  assert.equal(column.kind, `ref`);
  assert.equal(column.target, `Buildings`);
  assert.equal(column.visibleCol, `Name`);
  assert.equal(schema.tables.get(`Rooms`).columns.find((c) => c.id === `Area`).visibleCol, ``);
  assert.equal(schema.tables.get(`Rooms`).columns.find((c) => c.id === `Surface`).isFormula, true);
});

test(`buildSchema accepts empty metadata`, () => {
  const empty = buildSchema({}, {});
  assert.deepEqual(empty.order, []);
  assert.deepEqual(buildSchema(undefined, undefined).order, []);
});

test(`findDescendants finds the tables below Sites, with their paths`, () => {
  const found = findDescendants(schema, `Sites`);
  const names = found.map((entry) => entry.table);
  assert.deepEqual(names, [`Buildings`, `Rooms`, `Floors`]);
  const rooms = found.find((entry) => entry.table === `Rooms`);
  assert.equal(rooms.paths[0].map(describeStep).join(` | `), `Rooms.Site -> Sites`);
  assert.ok(rooms.paths.length >= 2);
  assert.ok(rooms.paths.some((path) => path.map((s) => s.column).join(`.`) === `Building.Site`));
});

test(`findDescendants gives every path of a table that has several`, () => {
  const rooms = findDescendants(schema, `Sites`).find((entry) => entry.table === `Rooms`);
  const texts = rooms.paths.map((path) => path.map((s) => `${s.from}.${s.column}`).join(` > `));
  assert.ok(texts.includes(`Rooms.Site`));
  assert.ok(texts.includes(`Rooms.Building > Buildings.Site`));
  assert.ok(texts.includes(`Rooms.Floor > Floors.Building > Buildings.Site`));
});

test(`findDescendants handles a reference to the same table and does not loop`, () => {
  const found = findDescendants(schema, `Buildings`);
  assert.ok(!found.some((entry) => entry.table === `Buildings`));
  assert.deepEqual(found.map((e) => e.table).sort(), [`Floors`, `Rooms`]);
});

test(`findDescendants marks a list of references`, () => {
  const found = findDescendants(schema, `Contacts`);
  assert.deepEqual(found.map((e) => e.table), [`Buildings`, `Floors`, `Rooms`].filter((n) => found.some((e) => e.table === n)));
  assert.equal(found[0].paths[0][0].list, true);
});

test(`findDescendants of a table with no child is empty`, () => {
  assert.deepEqual(findDescendants(schema, `Rooms`), []);
  assert.deepEqual(findDescendants(schema, `Notes`), []);
  assert.deepEqual(findDescendants(schema, `Missing`), []);
});

test(`findDescendants stops at three references`, () => {
  const chain = buildSchema(
    { id: [1, 2, 3, 4, 5], tableId: [`A`, `B`, `C`, `D`, `E`] },
    { id: [1, 2, 3, 4], parentId: [2, 3, 4, 5], colId: [`a`, `b`, `c`, `d`], type: [`Ref:A`, `Ref:B`, `Ref:C`, `Ref:D`] }
  );
  assert.deepEqual(findDescendants(chain, `A`).map((e) => e.table), [`B`, `C`, `D`]);
});
