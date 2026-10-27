// Checks the rules of writing of the French texts: no comma before "et", no long dash in the middle of a sentence and no
// emoji. The texts checked are the French translations of the widget, the French part of the README and the specification.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);

const root = path.resolve(__dirname, `..`);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), `utf8`);

// The French translations: every `key: \`text\`` line of the French dictionary.
const dictionary = read(`shared`, `i18n.js`);
const french = dictionary.slice(dictionary.indexOf(`fr: {`), dictionary.indexOf(`en: {`));
const translations = [...french.matchAll(/^ {6}(\w+): `(.*)`,?$/gm)].map((match) => ({ where: match[1], text: match[2] }));

// The French part of the README, from its heading to the list of third-party code.
const readme = read(`README.md`);
const readmeFrench = readme.slice(readme.indexOf(`## Français`), readme.indexOf(`## Third-party`));

// The rules, each one with a way to find the lines that break it.
const RULES = [
  [`a comma before "et"`, /, et /],
  [`a long dash`, /[–—]/],
  [`an emoji`, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u]
];

// The places that break a rule, as `where: rule`.
function offences(items) {
  const found = [];
  for (const { where, text } of items) {
    for (const [name, pattern] of RULES) if (pattern.test(text)) found.push(`${where}: ${name}`);
  }
  return found;
}

// The lines of a document, each one as a place of its own.
const linesOf = (name, text) => text.split(`\n`).map((line, index) => ({ where: `${name}:${index + 1}`, text: line }));

test(`the French translations follow the rules of writing`, () => {
  assert.ok(translations.length > 400);
  assert.deepEqual(offences(translations), []);
});

test(`the French part of the README follows the rules of writing`, () => {
  assert.ok(readmeFrench.length > 1000);
  assert.deepEqual(offences(linesOf(`README.md`, readmeFrench)), []);
});

test(`the specification follows the rules of writing`, () => {
  assert.deepEqual(offences(linesOf(`docs/specification.md`, read(`docs`, `specification.md`))), []);
});
