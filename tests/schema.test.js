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

const { findAncestors, pathQuality, rankDescendants } = require(`../schema.js`);

test(`findAncestors lists the tables that a row points to, shortest chains first`, () => {
  const found = findAncestors(schema, `Rooms`);
  assert.deepEqual(found.slice(0, 4).map((e) => e.steps.length), [1, 1, 1, 1]);
  assert.ok(found[4].steps.length === 2);
  const building = found.find((e) => e.table === `Buildings` && e.steps.length === 1);
  assert.deepEqual(building.steps, [{ from: `Rooms`, column: `Building`, to: `Buildings` }]);
  const site = found.filter((e) => e.table === `Sites`).map((e) => e.steps.map((s) => s.column).join(`.`));
  assert.ok(site.includes(`Site`) && site.includes(`Building.Site`));
});

test(`findAncestors does not loop on a reference to the same table and ignores lists`, () => {
  const found = findAncestors(schema, `Buildings`);
  assert.ok(!found.some((e) => e.table === `Buildings`));
  assert.ok(!found.some((e) => e.table === `Contacts`));
  assert.deepEqual(findAncestors(schema, `Notes`), []);
  assert.deepEqual(findAncestors(schema, `Missing`), []);
});

test(`pathQuality tells direct, summary and list chains`, () => {
  const direct = findDescendants(schema, `Sites`).find((e) => e.table === `Rooms`).paths[0];
  assert.equal(pathQuality(schema, direct), `direct`);
  const list = findDescendants(schema, `Contacts`).find((e) => e.table === `Buildings`).paths[0];
  assert.equal(pathQuality(schema, list), `list`);
  const summary = findDescendants(schema, `Usages`).find((e) => e.table === `Rooms_summary_Usage`).paths[0];
  assert.equal(pathQuality(schema, summary), `summary`);
});

test(`rankDescendants puts the direct tables first, then summaries, then lists`, () => {
  const ranked = rankDescendants(schema, findDescendants(schema, `Usages`));
  assert.deepEqual(ranked.map((e) => [e.table, e.quality]), [[`Rooms`, `direct`], [`Rooms_summary_Usage`, `summary`]]);
  const fromContacts = rankDescendants(schema, findDescendants(schema, `Contacts`));
  assert.ok(fromContacts.every((e) => e.quality === `list`));
});
