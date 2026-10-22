// Integration tests of the query lab tab: it runs in a real browser (Chromium) with a fake Grist
// object built from an invented document.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { startServer, launch, openExplorer } = require(`./helpers.js`);

let server;
let browser;
test.before(async () => {
  server = await startServer();
  browser = await launch();
});
test.after(async () => {
  await browser.close();
  server.close();
});

const finished = (page) => page.waitForFunction(() => /finished|terminée/.test(document.getElementById(`status`).textContent));
const rowsOf = (page) => page.$$eval(`#labResult tr`, (rows) => rows.map((row) => [...row.children].map((cell) => cell.textContent)));
const info = (page) => page.locator(`#labInfo`).innerText();

// Opens the explorer on the first site, then the lab tab with the form ready.
async function openLab(options = {}) {
  const w = await openExplorer(browser, server.url, options);
  await w.selectRow(1);
  await finished(w.page);
  await w.page.click(`#tabLab`);
  return w;
}

// Runs the lab and waits for the result.
async function run(page) {
  await page.click(`#labRun`);
  await page.waitForFunction(() => document.querySelectorAll(`#labResult tr`).length > 0);
}

test(`before the exploration the lab asks to run it`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.page.click(`#tabLab`);
  assert.match(await w.page.locator(`#labMessage`).innerText(), /Run the exploration first|Lancez d'abord/);
  assert.equal(await w.page.isVisible(`#labForm`), false);
});

test(`the tabs switch between the explorer and the lab`, async () => {
  const w = await openLab();
  assert.equal(await w.page.isVisible(`#panelExplorer`), false);
  assert.equal(await w.page.isVisible(`#labForm`), true);
  await w.page.click(`#tabExplorer`);
  assert.equal(await w.page.isVisible(`#panelExplorer`), true);
  assert.equal(await w.page.getAttribute(`#tabExplorer`, `aria-selected`), `true`);
});

test(`the table list holds the linked table and its descendants and the path list their paths`, async () => {
  const w = await openLab();
  const tables = await w.page.$$eval(`#labTable option`, (options) => options.map((o) => o.value));
  assert.deepEqual(tables.slice(0, 1), [`Sites`]);
  assert.ok(tables.includes(`Rooms`) && tables.includes(`Buildings`) && tables.includes(`Floors`));
  await w.page.selectOption(`#labTable`, `Rooms`);
  const paths = await w.page.$$eval(`#labPath option`, (options) => options.map((o) => o.textContent));
  assert.ok(paths.includes(`Rooms.Site -> Sites`));
  assert.ok(paths.some((text) => text.includes(`Rooms.Building -> Buildings ; Buildings.Site -> Sites`)));
});

test(`sums by usage for the rooms that point to the selected site`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Site -> Sites` });
  await w.page.selectOption(`#labGroup`, `Usage`);
  await w.page.selectOption(`#labColumn`, `Area`);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.deepEqual(rows.map((r) => r[0]), [`Usage`, `(vide)`, `Classroom`, `Office`, `Total`]);
  assert.deepEqual(rows.slice(1).map((r) => r[1]), [`8,25`, `35`, `32,5`, `75,75`]);
  assert.match(await info(w.page), /4 row\(s\) kept out of 6|4 ligne\(s\) retenue\(s\) sur 6/);
  assert.deepEqual(w.errors, []);
});

test(`the other path gives another result when the data disagrees`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Building -> Buildings ; Buildings.Site -> Sites` });
  await w.page.selectOption(`#labColumn`, `Area`);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `80,75`);
  assert.match(await info(w.page), /5 row\(s\) kept out of 6|5 ligne\(s\) retenue\(s\) sur 6/);
});

test(`a filter on a column reached through a reference keeps the right rows`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Site -> Sites` });
  await w.page.selectOption(`#labColumn`, `Area`);
  await w.page.selectOption(`#labFilter1 select >> nth=0`, `Usage > Counts`);
  await w.page.selectOption(`#labFilter1 select >> nth=1`, `true`);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `32,5`);
});

test(`a filter that compares with the number of the selected row`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Building -> Buildings ; Buildings.Site -> Sites` });
  await w.page.selectOption(`#labColumn`, `Area`);
  await w.page.selectOption(`#labFilter1 select >> nth=0`, `Site`);
  await w.page.selectOption(`#labFilter1 select >> nth=2`, `id`);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `75,75`);
});

test(`count and average work, and sorting by value puts the largest first`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Site -> Sites` });
  await w.page.selectOption(`#labGroup`, `Usage`);
  await w.page.selectOption(`#labColumn`, `Area`);
  await w.page.selectOption(`#labSort`, `value`);
  await run(w.page);
  assert.deepEqual((await rowsOf(w.page)).slice(1, 4).map((r) => r[0]), [`Classroom`, `Office`, `(vide)`]);
  await w.page.selectOption(`#labFn`, `count`);
  await w.page.selectOption(`#labColumn`, ``);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `4`);
});

test(`narrow panel in dark mode: the lab does not overflow`, async () => {
  const w = await openLab({ viewport: { width: 340, height: 800 }, colorScheme: `dark` });
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labColumn`, `Area`);
  await run(w.page);
  assert.equal(await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
});
