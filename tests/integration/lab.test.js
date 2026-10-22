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

// Ticks exactly the given columns in the list of columns to calculate.
async function pick(page, names) {
  await page.$$eval(`#labColumns input`, (boxes, wanted) => boxes.forEach((box) => { box.checked = wanted.includes(box.value); }), names);
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
  assert.deepEqual(tables.slice(0, 2), [``, `Sites`]);
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
  await pick(w.page, [`Area`]);
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
  await pick(w.page, [`Area`]);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `80,75`);
  assert.match(await info(w.page), /5 row\(s\) kept out of 6|5 ligne\(s\) retenue\(s\) sur 6/);
});

test(`a filter on a column reached through a reference keeps the right rows`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Site -> Sites` });
  await pick(w.page, [`Area`]);
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
  await pick(w.page, [`Area`]);
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
  await pick(w.page, [`Area`]);
  await w.page.selectOption(`#labSort`, `value`);
  await run(w.page);
  assert.deepEqual((await rowsOf(w.page)).slice(1, 4).map((r) => r[0]), [`Classroom`, `Office`, `(vide)`]);
  await w.page.selectOption(`#labFn`, `count`);
  await pick(w.page, []);
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[rows.length - 1][1], `4`);
});

test(`narrow panel in dark mode: the lab does not overflow`, async () => {
  const w = await openLab({ viewport: { width: 340, height: 800 }, colorScheme: `dark` });
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, `0`);
  await pick(w.page, [`Area`]);
  await run(w.page);
  assert.equal(await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
});

// Opens the explorer linked to the rooms table, on room 1, and the lab tab.
async function openLabOnRooms() {
  const w = await openExplorer(browser, server.url, { linked: `Rooms` });
  await w.selectRow(1);
  await finished(w.page);
  await w.page.click(`#tabLab`);
  return w;
}

const lastValue = async (page) => (await rowsOf(page)).slice(-1)[0][1];

test(`the starting row can be the parent of the selected row and the result follows the cursor`, async () => {
  const w = await openLabOnRooms();
  const starts = await w.page.$$eval(`#labStart option`, (options) => options.map((o) => o.textContent));
  assert.match(starts[0], /selected row \(Rooms\)|ligne sélectionnée \(Rooms\)/);
  assert.ok(starts.some((text) => text.includes(`Buildings`) && text.includes(`Rooms.Building`)));
  await w.page.selectOption(`#labStart`, { label: starts.find((text) => text.includes(`Buildings`) && text.includes(`via Rooms.Building)`)) });
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, `0`);
  await pick(w.page, [`Area`]);
  await run(w.page);
  assert.equal(await lastValue(w.page), `60,5`);
  assert.match(await w.page.locator(`#labStartInfo`).innerText(), /Buildings, (ligne n°|row no\.) 1 \(Building A\)/);
  await w.selectRow(3);
  await w.page.waitForFunction(() => /20,25/.test(document.getElementById(`labResult`).textContent));
  assert.match(await w.page.locator(`#labStartInfo`).innerText(), /Buildings, (ligne n°|row no\.) 2 \(Building B\)/);
  assert.equal(await lastValue(w.page), `20,25`);
});

test(`the result does not follow the cursor when the option is turned off`, async () => {
  const w = await openLabOnRooms();
  const start = (await w.page.$$eval(`#labStart option`, (options) => options.map((o) => o.textContent))).find((text) => text.includes(`via Rooms.Building)`));
  await w.page.selectOption(`#labStart`, { label: start });
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, `0`);
  await pick(w.page, [`Area`]);
  await w.page.uncheck(`#labAuto`);
  await run(w.page);
  await w.selectRow(3);
  await w.page.waitForTimeout(500);
  assert.equal(await lastValue(w.page), `60,5`);
});

test(`the link list starts with the best link and keeps all rows for the end`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  const paths = await w.page.$$eval(`#labPath option`, (options) => options.map((o) => o.value));
  assert.equal(paths[paths.length - 1], `all`);
  assert.equal(paths[0], ``);
  assert.notEqual(paths[1], `all`);
});

test(`the starting row alone is a choice for the table of the starting row`, async () => {
  const w = await openLabOnRooms();
  await w.page.selectOption(`#labTable`, `Rooms`);
  assert.deepEqual(await w.page.$$eval(`#labPath option`, (options) => options.map((o) => o.value)), [``, `self`, `all`]);
  await w.page.selectOption(`#labPath`, `self`);
  await pick(w.page, [`Area`]);
  await run(w.page);
  assert.equal(await lastValue(w.page), `20,5`);
});

test(`rows of the same label are merged only on request`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, `all`);
  await w.page.selectOption(`#labGroup`, `Building`);
  await pick(w.page, [`Area`]);
  await run(w.page);
  assert.deepEqual((await rowsOf(w.page)).slice(1, -1).map((r) => r[0]), [`Building A`, `Building A`, `Building B`]);
  await w.page.check(`#labMerge`);
  await run(w.page);
  assert.deepEqual((await rowsOf(w.page)).slice(1, -1).map((r) => [r[0], r[1]]), [[`Building A`, `100,5`], [`Building B`, `20,25`]]);
});

test(`several ticked columns give one result column each, with a total`, async () => {
  const w = await openLab();
  await w.page.selectOption(`#labTable`, `Rooms`);
  await w.page.selectOption(`#labPath`, { label: `Rooms.Site -> Sites` });
  await w.page.selectOption(`#labGroup`, `Usage`);
  const boxes = await w.page.$$eval(`#labColumns input`, (list) => list.map((box) => box.value));
  assert.ok(boxes.includes(`Area`));
  await pick(w.page, [`Area`, `Seats`].filter((name) => boxes.includes(name)));
  await run(w.page);
  const rows = await rowsOf(w.page);
  assert.equal(rows[0].length, 1 + boxes.filter((name) => [`Area`, `Seats`].includes(name)).length);
  assert.equal(rows[rows.length - 1][0], `Total`);
  assert.deepEqual(w.errors, []);
});

test(`table and link start empty and the lab asks to choose them`, async () => {
  const w = await openLab();
  assert.equal(await w.page.locator(`#labTable`).inputValue(), ``);
  assert.equal(await w.page.locator(`#labPath`).inputValue(), ``);
  await w.page.click(`#labRun`);
  await w.page.waitForFunction(() => /Choose|Choisissez/.test(document.getElementById(`labInfo`).textContent));
  assert.deepEqual(w.errors, []);
});

test(`every menu of the lab has a help badge with a text`, async () => {
  const w = await openLab();
  const tips = await w.page.$$eval(`#labForm .help`, (list) => list.map((badge) => badge.dataset.tip));
  assert.ok(tips.length >= 10);
  assert.ok(tips.every((text) => text && text.length > 20));
  assert.deepEqual(w.errors, []);
});
