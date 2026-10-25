// Checks the translations: French and English have the same keys, no key is written twice, and every
// text that the page or the scripts ask for by name exists.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);

const root = path.resolve(__dirname, `..`);
const source = fs.readFileSync(path.join(root, `shared`, `i18n.js`), `utf8`);
const keysOf = (text) => [...text.matchAll(/^      (\w+): /gm)].map((match) => match[1]);
const french = keysOf(source.slice(source.indexOf(`fr: {`), source.indexOf(`en: {`)));
const english = keysOf(source.slice(source.indexOf(`en: {`)));

test(`French and English hold the same keys`, () => {
  assert.deepEqual(french.filter((key) => !english.includes(key)), []);
  assert.deepEqual(english.filter((key) => !french.includes(key)), []);
});

test(`no key is written twice in a language`, () => {
  assert.equal(french.length, new Set(french).size);
  assert.equal(english.length, new Set(english).size);
});

test(`every text asked by name in the page and the scripts exists`, () => {
  const files = fs.readdirSync(root).filter((name) => /\.(js|html)$/.test(name));
  const asked = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), `utf8`);
    for (const match of text.matchAll(/\b(?:tr|t)\(`(\w+)`/g)) asked.add(match[1]);
    for (const match of text.matchAll(/data-i18n(?:-tip|-label|-hover)?="(\w+)"/g)) asked.add(match[1]);
  }
  assert.ok(asked.size > 100);
  assert.deepEqual([...asked].filter((key) => !french.includes(key)), []);
});
