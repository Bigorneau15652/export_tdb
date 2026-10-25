// Tests of the courses: every text they ask for exists in French and in English, every menu they name is a real
// menu of the settings panel, and the sections come out in the right order with the names of the menus in place.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);
const Guide = require(`../guide-content.js`);
const Model = require(`../model.js`);

const root = path.resolve(__dirname, `..`);
const source = fs.readFileSync(path.join(root, `shared`, `i18n.js`), `utf8`);
const dictionary = (from, to) => {
  const part = source.slice(from, to < 0 ? undefined : to);
  return new Map([...part.matchAll(/^      (\w+): `((?:[^`\\]|\\.)*)`,$/gm)].map((match) => [match[1], match[2]]));
};
const french = dictionary(source.indexOf(`fr: {`), source.indexOf(`en: {`));
const english = dictionary(source.indexOf(`en: {`), -1);
const panel = fs.readFileSync(path.join(root, `index.html`), `utf8`);

test(`every type of block that has a course exists, and the courses of this version are the text, the table and the sheet`, () => {
  assert.deepEqual(Guide.TYPES, [`text`, `table`, `record`]);
  for (const type of Guide.TYPES) assert.ok(Model.TYPES.includes(type), type);
});

test(`every text of every course exists in French and in English`, () => {
  for (const type of Guide.TYPES) {
    const { texts, menus } = Guide.keysOf(type);
    for (const key of [...texts, ...menus]) {
      assert.ok(french.has(key), `${type}: no French text ${key}`);
      assert.ok(english.has(key), `${type}: no English text ${key}`);
    }
  }
});

test(`every menu named between double brackets is a real menu of the panel, and the names of the menus are never written by hand`, () => {
  const real = new Set([...panel.matchAll(/data-i18n="(\w+)"/g)].map((match) => match[1]));
  // The names that the panel builds by script (the title of the columns of a cross table, the add buttons).
  for (const key of [`boardCellCalc`, `boardColumnLabel`, `boardRecordAdd`, `boardValuesButton`]) real.add(key);
  for (const type of Guide.TYPES) {
    const { texts, menus } = Guide.keysOf(type);
    for (const menu of menus) assert.ok(real.has(menu), `${type}: ${menu} is not a menu of the panel`);
    for (const key of texts) {
      for (const dictionaryOf of [french, english]) {
        for (const match of String(dictionaryOf.get(key)).matchAll(/\[\[(\w+)\]\]/g)) {
          assert.ok(real.has(match[1]), `${type}: ${key} names ${match[1]}, which is not a menu of the panel`);
          assert.ok(french.has(match[1]) && english.has(match[1]), match[1]);
        }
      }
    }
  }
});

test(`the names of the menus are written in place and the sections come in order`, () => {
  const t = (key) => english.get(key) || key;
  for (const type of Guide.TYPES) {
    const sections = Guide.sectionsOf(type, t);
    const kinds = sections.map((section) => section.kind);
    assert.equal(kinds[0], `intro`);
    assert.equal(kinds[1], `steps`);
    assert.equal(kinds[kinds.length - 3], `menus`);
    assert.equal(kinds[kinds.length - 2], `examples`);
    assert.equal(kinds[kinds.length - 1], `notes`);
    const text = JSON.stringify(sections);
    assert.ok(!/\[\[\w+\]\]/.test(text), `${type}: a name of menu is left between brackets`);
    assert.ok(text.includes(`« `), type);
  }
  assert.match(Guide.expand(`In [[boardItem]] choose`, t), /^In « Item » choose$/);
});

test(`the samples of the examples are made of invented values and of translated words`, () => {
  const t = (key) => `<${key}>`;
  for (const type of Guide.TYPES) {
    const { examples } = Guide.sectionsOf(type, t).find((section) => section.kind === `examples`) ? { examples: Guide.sectionsOf(type, t).find((section) => section.kind === `examples`).items } : {};
    assert.ok(examples.length >= 1, type);
    for (const example of examples) {
      assert.ok(example.settings.length >= 1);
      const sample = example.sample;
      assert.ok([`text`, `table`, `record`].includes(sample.kind));
      if (sample.kind === `table`) {
        assert.ok(sample.headers.length >= 2 && sample.rows.length >= 1);
        for (const row of sample.rows) assert.equal(row.length, sample.headers.length);
      }
    }
  }
});

test(`the course window is a page of the site with no script and the button of the courses exists`, () => {
  const page = fs.readFileSync(path.join(root, `guide.html`), `utf8`);
  assert.match(page, /script-src 'none'/);
  assert.ok(!/<script/.test(page));
  assert.ok(panel.includes(`id="boardGuide"`));
  assert.match(panel, /src="guide-content\.js\?v=/);
  assert.match(panel, /src="guide\.js\?v=/);
});
