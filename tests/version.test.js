// Checks that the version written in the page (the label under the title and the numbers after the
// file names) is the version of the package, so that a stale page is easy to recognise.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);

const root = path.resolve(__dirname, `..`);
const version = JSON.parse(fs.readFileSync(path.join(root, `package.json`), `utf8`)).version;
const page = fs.readFileSync(path.join(root, `index.html`), `utf8`);

test(`the label of the page shows the version of the package`, () => {
  const label = /<small class="version" id="version">([^<]+)<\/small>/.exec(page);
  assert.ok(label, `no version label`);
  assert.equal(label[1], version);
});

test(`every script and style of the page carries the version of the package`, () => {
  const found = [...page.matchAll(/(?:src|href)="[^"]+\?v=([0-9.]+)"/g)].map((match) => match[1]);
  assert.ok(found.length > 10);
  assert.deepEqual([...new Set(found)], [version]);
});

test(`the changelog has a section for the version of the package`, () => {
  const changelog = fs.readFileSync(path.join(root, `CHANGELOG.md`), `utf8`);
  assert.ok(changelog.includes(`## ${version}\n`));
});
