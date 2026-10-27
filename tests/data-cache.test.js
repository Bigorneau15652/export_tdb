// Tests of the cache of the tables (data-cache.js): the tables are requested once and at the same time, a table that
// cannot be loaded does not stop the others, and the cache keeps at most 18 tables. The file is a script of the
// page, so it is loaded here with a fake `window` that holds a fake access module.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const path = require(`node:path`);

// Loads a fresh copy of data-cache.js whose tables come from `fetchTable`, and gives its public object.
function load(fetchTable) {
  globalThis.window = { exportTdbAccess: { fetchTable } };
  const file = path.resolve(__dirname, `..`, `data-cache.js`);
  delete require.cache[file];
  require(file);
  const data = globalThis.window.exportTdbData;
  delete globalThis.window;
  return data;
}

// Waits until the promises that are ready have run.
const settle = () => new Promise((resolve) => setImmediate(resolve));

test(`the tables are requested at the same time, each one once`, async () => {
  const started = [];
  const finish = {};
  const data = load((name) => {
    started.push(name);
    return new Promise((resolve) => {
      finish[name] = () => resolve({ id: [1], name });
    });
  });
  const pending = data.ensure([`A`, `B`, `A`]);
  await settle();
  assert.deepEqual(started, [`A`, `B`]);
  finish.A();
  finish.B();
  assert.equal(await pending, 2);
  assert.deepEqual([...data.tables().keys()], [`A`, `B`]);
  assert.equal(await data.ensure([`A`, `B`]), 0);
  assert.deepEqual(started, [`A`, `B`]);
});

test(`a table that cannot be loaded does not stop the others`, async () => {
  const data = load(async (name) => {
    if (name === `B`) throw new Error(`refused`);
    return { id: [1] };
  });
  await assert.rejects(data.ensure([`A`, `B`, `C`]), /refused/);
  assert.deepEqual([...data.tables().keys()].sort(), [`A`, `C`]);
  assert.ok(data.version() > 0);
});

test(`the cache keeps at most 18 tables`, async () => {
  const data = load(async () => ({ id: [1] }));
  const names = Array.from({ length: 25 }, (_, index) => `T${index}`);
  assert.equal(await data.ensure(names), 18);
  assert.equal(data.tables().size, 18);
  assert.equal(await data.ensure(names), 0);
  assert.equal(data.tables().size, 18);
});

test(`clearing or dropping tables changes the version`, async () => {
  const data = load(async () => ({ id: [1] }));
  await data.ensure([`A`, `B`]);
  const before = data.version();
  data.drop(`A`);
  assert.ok(data.version() > before);
  assert.deepEqual([...data.tables().keys()], [`B`]);
  const dropped = data.version();
  data.clear();
  assert.ok(data.version() > dropped);
  assert.equal(data.tables().size, 0);
});
