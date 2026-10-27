// Checks the rule of the comments: every script of the widget starts with a comment that says what it does, and every
// function has a comment block just above it.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);

const root = path.resolve(__dirname, `..`);
const scripts = [root, path.join(root, `shared`)].flatMap((folder) => fs.readdirSync(folder)
  .filter((name) => name.endsWith(`.js`))
  .map((name) => path.join(folder, name)));

test(`every script starts with a comment`, () => {
  assert.ok(scripts.length > 30);
  const without = scripts.filter((file) => !fs.readFileSync(file, `utf8`).startsWith(`//`));
  assert.deepEqual(without.map((file) => path.relative(root, file)), []);
});

test(`every function has a comment block above it`, () => {
  const missing = [];
  for (const file of scripts) {
    const lines = fs.readFileSync(file, `utf8`).split(`\n`);
    lines.forEach((line, index) => {
      if (!/^\s*(?:async\s+)?function\s+\w+/.test(line)) return;
      if (index === 0 || !lines[index - 1].trim().startsWith(`//`)) missing.push(`${path.relative(root, file)}:${index + 1}`);
    });
  }
  assert.deepEqual(missing, []);
});
