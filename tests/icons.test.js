// Tests of the icons: every icon has drawing commands made only of the characters of a path.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);
const Icons = require(`../icons.js`);
const Model = require(`../model.js`);

test(`every icon is a list of simple path commands`, () => {
  for (const [name, commands] of Object.entries(Icons.PATHS)) {
    assert.ok(commands.length > 0, name);
    for (const command of commands) assert.match(command, /^[MmLlHhVvAaCcZz0-9.\s,-]+$/, `${name}: ${command}`);
  }
});

test(`every icon asked for in the page exists`, () => {
  const names = new Set();
  for (const file of [`index.html`, `board.js`]) {
    const text = fs.readFileSync(path.join(__dirname, `..`, file), `utf8`);
    for (const match of text.matchAll(/data-icon="([a-z]+)"/g)) names.add(match[1]);
    for (const match of text.matchAll(/Icons?\.(?:make|setIcon)\([^,)]*,?\s*`([a-z]+)`\)/g)) names.add(match[1]);
  }
  assert.ok(names.size >= 8);
  for (const name of names) assert.ok(Icons.PATHS[name], `no icon ${name}`);
});

test(`every type of block and both orientations have an icon`, () => {
  for (const type of Model.TYPES) assert.ok(Icons.PATHS[type], type);
  assert.ok(Icons.PATHS.landscape && Icons.PATHS.portrait);
});
