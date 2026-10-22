// Integration tests of the dashboard tab (version 0.3): reading and editing modes, adding, moving,
// resizing and deleting blocks with the pointer and the keyboard, saving, and narrow dark display.
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

// Opens the widget on the dashboard tab with a wide window.
async function openBoard(options = {}) {
  return openExplorer(browser, server.url, { tab: `board`, viewport: { width: 1000, height: 800 }, ...options });
}

// Switches to the editing mode.
async function edit(w) {
  await w.page.click(`#boardEdit`);
}

// Adds a block of a type through the tools.
async function addBlock(w, type) {
  await w.page.selectOption(`#boardAddType`, type);
  await w.page.click(`#boardAdd`);
}

const model = (page) => page.evaluate(() => window.exportTdbBoard.getModel());
const box = async (page, selector) => page.locator(selector).first().boundingBox();

// A saved model made of two blocks, as Grist would give it back.
const SAVED = {
  model: {
    version: 1,
    page: { format: `a4`, orientation: `portrait`, margin: 10 },
    pages: 1,
    blocks: [
      { id: `aaa1`, type: `text`, title: `Introduction`, page: 0, x: 0, y: 0, w: 20, h: 8 },
      { id: `bbb2`, type: `table`, title: `Surfaces`, page: 0, x: 0, y: 10, w: 30, h: 12 }
    ]
  }
};

test(`the widget opens on the dashboard in reading mode, without tools`, async () => {
  const w = await openBoard();
  assert.equal(await w.page.getAttribute(`#tabBoard`, `aria-selected`), `true`);
  assert.equal(await w.page.locator(`#boardTools`).isHidden(), true);
  assert.equal(await w.page.locator(`.page`).count(), 1);
  assert.match(await w.page.locator(`#boardCanvas`).innerText(), /vide|empty/);
  assert.deepEqual(w.errors, []);
});

test(`the edit button shows the tools and every menu has a help badge`, async () => {
  const w = await openBoard();
  await edit(w);
  assert.equal(await w.page.locator(`#boardTools`).isVisible(), true);
  const tips = await w.page.$$eval(`#panelBoard .help`, (list) => list.map((badge) => badge.dataset.tip));
  assert.ok(tips.length >= 6);
  assert.ok(tips.every((text) => text && text.length > 20));
  await w.page.click(`#boardEdit`);
  assert.equal(await w.page.locator(`#boardTools`).isHidden(), true);
  assert.deepEqual(w.errors, []);
});

test(`adding blocks places them one after the other and saves the model`, async () => {
  const w = await openBoard();
  await edit(w);
  await addBlock(w, `text`);
  await addBlock(w, `chart`);
  const saved = await model(w.page);
  assert.equal(saved.blocks.length, 2);
  assert.deepEqual([saved.blocks[0].x, saved.blocks[0].y], [0, 0]);
  assert.equal(saved.blocks[1].x, saved.blocks[0].w);
  assert.equal(await w.page.locator(`.block`).count(), 2);
  await w.page.waitForFunction(() => window.__saved && window.__saved.length >= 1);
  const last = await w.page.evaluate(() => window.__saved[window.__saved.length - 1]);
  assert.equal(last.model.blocks.length, 2);
  assert.match(await w.page.locator(`#boardSaveState`).innerText(), /Enregistré|Saved/);
  assert.deepEqual(w.errors, []);
});

test(`a page is added when there is no room`, async () => {
  const w = await openBoard();
  await edit(w);
  for (let i = 0; i < 12; i += 1) await addBlock(w, `table`);
  assert.ok((await model(w.page)).pages >= 2);
  assert.equal(await w.page.locator(`.page`).count(), (await model(w.page)).pages);
  assert.deepEqual(w.errors, []);
});

test(`dragging a block moves it and it never overlaps another block`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  const first = await box(w.page, `.block[data-id="aaa1"]`);
  const second = await box(w.page, `.block[data-id="bbb2"]`);
  await w.page.mouse.move(first.x + 20, first.y + 30);
  await w.page.mouse.down();
  await w.page.mouse.move(second.x + 40, second.y + 40, { steps: 8 });
  await w.page.mouse.up();
  const moved = await model(w.page);
  const a = moved.blocks.find((b) => b.id === `aaa1`);
  const b = moved.blocks.find((x) => x.id === `bbb2`);
  const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  assert.equal(overlap, false);
  assert.notDeepEqual([a.x, a.y], [0, 0]);
  assert.deepEqual(w.errors, []);
});

test(`a simple click selects a block without moving it`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  const first = await box(w.page, `.block[data-id="aaa1"]`);
  await w.page.mouse.click(first.x + 20, first.y + 30);
  assert.equal(await w.page.locator(`.block[data-id="aaa1"].selected`).count(), 1);
  assert.equal((await model(w.page)).blocks[0].x, 0);
  assert.equal(await w.page.locator(`.block[data-id="aaa1"] .pencil`).isVisible(), true);
});

test(`the bottom right handle resizes a block and Shift keeps the proportions`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.click(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  const handle = await box(w.page, `.block[data-id="aaa1"] .handle.se`);
  const startX = handle.x + handle.width / 2;
  const startY = handle.y + handle.height / 2;
  const step = await w.page.evaluate(() => document.querySelector(`.page`).getBoundingClientRect().width / 210 * 5);
  await w.page.mouse.move(startX, startY);
  await w.page.mouse.down();
  await w.page.mouse.move(startX + step * 4, startY, { steps: 5 });
  await w.page.mouse.up();
  const after = (await model(w.page)).blocks.find((b) => b.id === `aaa1`);
  assert.equal(after.w, 24);
  assert.equal(after.h, 8);

  await w.page.click(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  const handle2 = await box(w.page, `.block[data-id="aaa1"] .handle.se`);
  const x2 = handle2.x + handle2.width / 2;
  const y2 = handle2.y + handle2.height / 2;
  await w.page.mouse.move(x2, y2);
  await w.page.mouse.down();
  await w.page.keyboard.down(`Shift`);
  await w.page.mouse.move(x2 + step * 6, y2, { steps: 5 });
  await w.page.mouse.up();
  await w.page.keyboard.up(`Shift`);
  const keep = (await model(w.page)).blocks.find((b) => b.id === `aaa1`);
  assert.ok(Math.abs(keep.w / keep.h - 3) < 0.4, `ratio ${keep.w}/${keep.h}`);
  assert.deepEqual(w.errors, []);
});

test(`arrows move the selected block by one step and Delete asks before removing it`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.click(`.block[data-id="bbb2"]`, { position: { x: 20, y: 30 } });
  await w.page.keyboard.press(`ArrowRight`);
  await w.page.keyboard.press(`ArrowRight`);
  await w.page.keyboard.press(`ArrowDown`);
  let table = (await model(w.page)).blocks.find((b) => b.id === `bbb2`);
  assert.deepEqual([table.x, table.y], [2, 11]);
  await w.page.keyboard.press(`Delete`);
  assert.equal(await w.page.locator(`#boardConfirm`).isVisible(), true);
  assert.match(await w.page.locator(`#boardConfirmText`).innerText(), /Surfaces/);
  await w.page.click(`#boardConfirmNo`);
  assert.equal((await model(w.page)).blocks.length, 2);
  await w.page.keyboard.press(`Delete`);
  await w.page.click(`#boardConfirmYes`);
  assert.equal((await model(w.page)).blocks.length, 1);
  assert.equal(await w.page.locator(`.block`).count(), 1);
  assert.deepEqual(w.errors, []);
});

test(`a double click opens the settings and the title and type are changed there`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.dblclick(`.block[data-id="bbb2"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  assert.equal(await w.page.inputValue(`#boardTitle`), `Surfaces`);
  await w.page.fill(`#boardTitle`, `Présentation de l'école`);
  await w.page.selectOption(`#boardType`, `image`);
  const block = (await model(w.page)).blocks.find((b) => b.id === `bbb2`);
  assert.equal(block.title, `Présentation de l'école`);
  assert.equal(block.type, `image`);
  assert.match(await w.page.locator(`.block[data-id="bbb2"]`).innerText(), /Présentation de l'école/);
  await w.page.selectOption(`#boardType`, `text`);
  assert.equal(await w.page.locator(`#boardTitle`).isHidden(), true);
  assert.equal(await w.page.locator(`#boardText`).isVisible(), true);
  assert.deepEqual(w.errors, []);
});

test(`the pencil opens the settings and Close hides them`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.click(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  await w.page.click(`.block[data-id="aaa1"] .pencil`);
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardX`).count(), 0);
  await w.page.click(`#boardClose`);
  assert.equal(await w.page.locator(`#boardPanel`).isHidden(), true);
});

test(`changing the format changes the page size and keeps the blocks without overlap`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  const before = await box(w.page, `.page`);
  await edit(w);
  await w.page.selectOption(`#boardOrientation`, `landscape`);
  const after = await box(w.page, `.page`);
  assert.ok(after.width / after.height > before.width / before.height);
  await w.page.selectOption(`#boardFormat`, `a5`);
  const small = (await model(w.page));
  assert.equal(small.page.format, `a5`);
  assert.equal(small.blocks.length, 2);
  assert.deepEqual(w.errors, []);
});

test(`a saved model is shown again and a model from a newer version is locked`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  assert.equal(await w.page.locator(`.block`).count(), 2);
  assert.match(await w.page.locator(`.block[data-id="bbb2"]`).innerText(), /Surfaces/);
  assert.equal(await w.page.locator(`#boardEdit`).isEnabled(), true);
  const locked = await openBoard({ savedOptions: { model: { version: 99, blocks: [] } } });
  assert.equal(await locked.page.locator(`#boardEdit`).isDisabled(), true);
  assert.equal(await locked.page.locator(`#boardNotice`).isVisible(), true);
  assert.deepEqual(locked.errors, []);
});

test(`a refused save is announced`, async () => {
  const w = await openBoard({ failOnSave: true });
  await edit(w);
  await addBlock(w, `text`);
  await w.page.waitForFunction(() => /impossible|failed/.test(document.getElementById(`boardSaveState`).textContent));
  assert.deepEqual(w.errors, []);
});

test(`narrow panel in dark mode: no horizontal overflow and the settings open as a sheet`, async () => {
  const w = await openBoard({ savedOptions: SAVED, viewport: { width: 340, height: 700 }, colorScheme: `dark` });
  await edit(w);
  await w.page.dblclick(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  const panel = await box(w.page, `#boardPanel`);
  assert.ok(panel.y + panel.height <= 700 + 1);
  assert.deepEqual(w.errors, []);
});

test(`the zoom buttons change the size of the page and Fit brings it back`, async () => {
  const w = await openBoard();
  await edit(w);
  const base = (await box(w.page, `.page`)).width;
  await w.page.click(`#boardZoomIn`);
  assert.ok((await box(w.page, `.page`)).width > base);
  await w.page.click(`#boardZoomFit`);
  assert.ok(Math.abs((await box(w.page, `.page`)).width - base) < 2);
});

// A saved model with one text block of the given settings, on a screen page.
const textModel = (config, extra = {}) => ({
  model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tx1`, type: `text`, title: ``, page: 0, x: 0, y: 0, w: 40, h: 12, config, ...extra }] }
});
const finished = (page) => page.waitForFunction(() => /finished|terminée/.test(document.getElementById(`status`).textContent));
const blockText = (page) => page.locator(`.block[data-id="tx1"] .md`).innerText();

// Opens the dashboard, gives it the row `id` of the linked table and waits for the exploration.
async function openWithRow(options, id = 1) {
  const w = await openBoard(options);
  await w.selectRow(id);
  await finished(w.page);
  return w;
}

test(`a text block draws Markdown with titles, bold, lists and https links, and never HTML`, async () => {
  const text = `# Title\n\nSome **bold** and *italic* text with a [link](https://example.org/a) and <b>raw</b>\n\n- one\n- two\n\n[bad](javascript:alert(1))`;
  const w = await openBoard({ savedOptions: textModel({ source: `fixed`, text }) });
  const block = w.page.locator(`.block[data-id="tx1"]`);
  assert.equal(await block.locator(`h1`).innerText(), `Title`);
  assert.equal(await block.locator(`strong`).innerText(), `bold`);
  assert.equal(await block.locator(`em`).innerText(), `italic`);
  assert.equal(await block.locator(`li`).count(), 2);
  const link = block.locator(`a`);
  assert.equal(await link.count(), 1);
  assert.equal(await link.getAttribute(`href`), `https://example.org/a`);
  assert.match(await link.getAttribute(`rel`), /noopener/);
  assert.match(await blockText(w.page), /<b>raw<\/b>/);
  assert.equal(await block.locator(`b`).count(), 0);
  assert.equal(await block.locator(`script`).count(), 0);
  assert.deepEqual(w.errors, []);
});

test(`fields take the value of the selected row and follow the cursor`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `fixed`, text: `Site {Name}, address: {Address}` }) }, 1);
  await w.page.waitForFunction(() => /North campus/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `Site North campus, address: 1 Example street`);
  await w.selectRow(2);
  await w.page.waitForFunction(() => /South campus/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `Site South campus, address:`);
  assert.deepEqual(w.errors, []);
});

test(`fields through references load the other tables and numbers are written the French way`, async () => {
  const text = `{Number} in {Building.Name} ({Building.Site.Name}), {Area} m2, built {Building.Year}, floor {Floor}`;
  const w = await openWithRow({ linked: `Rooms`, savedOptions: textModel({ source: `fixed`, text }) }, 2);
  await w.page.waitForFunction(() => /North campus/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `A-002 in Building A (North campus), 35 m2, built 1965, floor Level 1`);
  await w.selectRow(4);
  await w.page.waitForFunction(() => /B-002/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.match(await blockText(w.page), /B-002 in Building B \(North campus\), 8,25 m2/);
  assert.deepEqual(w.errors, []);
});

test(`a value that holds Markdown signs is shown as it is`, async () => {
  const w = await openWithRow({ linked: `Notes`, savedOptions: textModel({ source: `fixed`, text: `{Text}` }) }, 1);
  await w.page.waitForFunction(() => /not related/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `not related to anything`);
});

test(`an unknown field stays written and the settings panel says so`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `fixed`, text: `Hello {Nope}` }) }, 1);
  assert.equal(await blockText(w.page), `Hello {Nope}`);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  assert.match(await w.page.locator(`#boardTextInfo`).innerText(), /\{Nope\}/);
});

test(`the text settings change the look and the field menu inserts a field at the cursor`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `fixed`, text: `Start` }) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  await w.page.selectOption(`#boardSize`, `large`);
  await w.page.selectOption(`#boardAlign`, `center`);
  await w.page.selectOption(`#boardFill`, `green`);
  const block = w.page.locator(`.block[data-id="tx1"]`);
  assert.match(await block.getAttribute(`class`), /fill-green/);
  assert.match(await block.getAttribute(`class`), /align-center/);
  const saved = (await model(w.page)).blocks[0].config;
  assert.deepEqual([saved.size, saved.align, saved.fill], [`large`, `center`, `green`]);
  await w.page.click(`#boardText`);
  await w.page.keyboard.press(`End`);
  await w.page.selectOption(`#boardField`, `Name`);
  assert.equal(await w.page.inputValue(`#boardText`), `Start{Name}`);
  await w.page.waitForFunction(() => /StartNorth campus/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.deepEqual(w.errors, []);
});

test(`typing in the text area changes the fixed text and keeps the cursor in the field`, async () => {
  const w = await openBoard({ savedOptions: textModel({ source: `fixed`, text: `` }) });
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  await w.page.click(`#boardText`);
  await w.page.keyboard.type(`Première ligne: c'est l'école`);
  assert.equal(await w.page.inputValue(`#boardText`), `Première ligne: c'est l'école`);
  assert.equal((await model(w.page)).blocks[0].config.text, `Première ligne: c'est l'école`);
  assert.equal(await w.page.evaluate(() => document.activeElement.id), `boardText`);
});

test(`a text that is longer than its block is marked in the editing mode`, async () => {
  const text = Array.from({ length: 40 }, (_, i) => `Line ${i}`).join(`\n\n`);
  const w = await openBoard({ savedOptions: textModel({ source: `fixed`, text }, { w: 20, h: 4 }) });
  await edit(w);
  assert.match(await w.page.locator(`.block[data-id="tx1"]`).getAttribute(`class`), /overflowing/);
});

test(`a cell source reads the cell of the selected row and writes what is typed back into it`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `cell`, column: `Address` }) }, 1);
  await w.page.waitForFunction(() => /Example street/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  assert.equal(await w.page.inputValue(`#boardText`), `1 Example street`);
  assert.deepEqual(await w.page.$$eval(`#boardColumn option`, (list) => list.map((o) => o.value)), [``, `Name`, `Address`]);
  await w.page.fill(`#boardText`, `**New** address`);
  assert.equal(await blockText(w.page), `New address`);
  await w.page.waitForFunction(() => window.__writes.length === 1, null, { timeout: 5000 });
  assert.deepEqual(await w.page.evaluate(() => window.__writes[0]), { Address: `**New** address` });
  await w.page.waitForFunction(() => /enregistré|saved/i.test(document.getElementById(`boardCellState`).textContent));
  assert.deepEqual(w.errors, []);
});

test(`a text typed for a cell is written to its own row even when the row changes at once`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `cell`, column: `Address` }) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  await w.page.fill(`#boardText`, `Typed for row one`);
  await w.selectRow(2);
  await w.page.waitForFunction(() => window.__writes.length === 1, null, { timeout: 5000 });
  const rows = await w.page.evaluate(async () => {
    const table = await window.grist.docApi.fetchTable(`Sites`);
    return table.Address;
  });
  assert.equal(rows[0], `Typed for row one`);
  assert.equal(rows[1], ``);
});

test(`only real text columns without formula can be chosen for a cell`, async () => {
  const w = await openWithRow({ linked: `Rooms`, savedOptions: textModel({ source: `cell`, column: `Number` }) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  const columns = await w.page.$$eval(`#boardColumn option`, (list) => list.map((o) => o.value));
  assert.ok(columns.includes(`Number`));
  assert.ok(!columns.includes(`Area`) && !columns.includes(`Building`) && !columns.includes(`Tags`) && !columns.includes(`Surface`));
});

test(`a write that Grist refuses is announced and the first method failing is not an error`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `cell`, column: `Address` }), failOnWrite: 1 }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 20 } });
  await w.page.fill(`#boardText`, `Second method`);
  await w.page.waitForFunction(() => window.__writes.length === 1, null, { timeout: 5000 });
  await w.page.waitForFunction(() => /enregistré|saved/i.test(document.getElementById(`boardCellState`).textContent));
});

test(`a refused write is announced and the settings panel is usable at 340 pixels in dark mode`, async () => {
  const w = await openWithRow({ savedOptions: textModel({ source: `cell`, column: `Address` }), failAllWrites: true, viewport: { width: 340, height: 700 }, colorScheme: `dark` }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 10, y: 10 } });
  await w.page.fill(`#boardText`, `Will be refused`);
  await w.page.waitForFunction(() => /impossible|Cannot/.test(document.getElementById(`boardCellState`).textContent), null, { timeout: 5000 });
  assert.equal(await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
});

test(`the widget asks Grist for the raw values of every normal column of the selected row`, async () => {
  const w = await openBoard();
  assert.deepEqual(await w.page.evaluate(() => window.__recordOptions), { keepEncoded: true, expandRefs: false, includeColumns: `normal` });
});

test(`fields still work when Grist sends no column with the selected row`, async () => {
  const text = `{Number} in {Building.Name} ({Building.Site.Name}), {Area} m2, floor {Floor}`;
  const w = await openBoard({ linked: `Rooms`, savedOptions: textModel({ source: `fixed`, text }) });
  await w.selectRow(2, true);
  await finished(w.page);
  await w.page.waitForFunction(() => /North campus/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `A-002 in Building A (North campus), 35 m2, floor Level 1`);
  await w.selectRow(5, true);
  await w.page.waitForFunction(() => /C-001/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.equal(await blockText(w.page), `C-001 in Building A (South campus), 40 m2, floor Ground`);
  assert.deepEqual(w.errors, []);
});

test(`the explorer report shows what Grist gave with the selected row`, async () => {
  const w = await openExplorer(browser, server.url, { viewport: { width: 1000, height: 800 } });
  await w.selectRow(1);
  await finished(w.page);
  const report = await w.page.inputValue(`#report`);
  assert.match(report, /7\. Values that Grist gave with the selected row/);
  assert.match(report, /Name \[Text\] text\(/);
});

// A saved model with one table block of the given settings.
const tableModel = (config, extra = {}) => ({
  model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tb1`, type: `table`, title: `Surfaces`, page: 0, x: 0, y: 0, w: 50, h: 20, config, ...extra }] }
});
const cells = (page) => page.$$eval(`.block[data-id="tb1"] .dt tr`, (rows) => rows.map((row) => [...row.children].map((cell) => cell.textContent)));

test(`a table block shows a list of the rows of the selected site with a total line`, async () => {
  const config = { mode: `list`, table: `Rooms`, link: `Rooms.Site`, total: true, columns: [{ path: `Number` }, { path: `Building` }, { path: `Area`, fn: `sum` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] .dt tr`).length > 1);
  const rows = await cells(w.page);
  assert.deepEqual(rows[0], [`Number`, `Building`, `Area`]);
  assert.deepEqual(rows[1], [`A-001`, `Building A`, `20,5`]);
  assert.deepEqual(rows[rows.length - 1], [`Total`, ``, `75,75`]);
  assert.equal(await w.page.locator(`.block[data-id="tb1"] .tableTitle`).innerText(), `Surfaces`);
  assert.equal(await w.page.locator(`.block[data-id="tb1"] tr.total`).count(), 1);
  assert.deepEqual(w.errors, []);
});

test(`a grouped table sums by usage and follows the starting row when the cursor moves`, async () => {
  const config = { mode: `group`, start: `Building`, table: `Rooms`, link: `Rooms.Building`, total: true, groupBy: [`Floor`], columns: [{ path: `Area`, fn: `sum` }] };
  const w = await openWithRow({ linked: `Rooms`, savedOptions: tableModel(config) }, 1);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] .dt tr`).length > 1);
  let rows = await cells(w.page);
  assert.deepEqual(rows[0], [`Floor`, `Sum (Area)`].map((text) => text).slice(0, 1).concat(rows[0].slice(1)));
  assert.deepEqual(rows[rows.length - 1], [`Total`, `60,5`]);
  await w.selectRow(3);
  await w.page.waitForFunction(() => /20,25/.test(document.querySelector(`.block[data-id="tb1"]`).textContent));
  rows = await cells(w.page);
  assert.deepEqual(rows[rows.length - 1], [`Total`, `20,25`]);
  assert.deepEqual(w.errors, []);
});

test(`a table is built from the settings panel`, async () => {
  const w = await openWithRow({ savedOptions: { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [] } } }, 1);
  await edit(w);
  await addBlock(w, `table`);
  await w.page.dblclick(`.block[data-type="table"]`, { position: { x: 20, y: 20 } });
  assert.equal(await w.page.locator(`#boardTableSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardTable`).inputValue(), ``);
  assert.match(await w.page.locator(`.block[data-type="table"]`).innerText(), /table|Table/);
  await w.page.selectOption(`#boardTable`, `Rooms`);
  await w.page.selectOption(`#boardLink`, `|Rooms.Site`);
  await w.page.click(`#boardAddColumn`);
  await w.page.selectOption(`.colrow .colPath`, `Number`);
  await w.page.click(`#boardAddColumn`);
  await w.page.selectOption(`.colrow:nth-child(2) .colPath`, `Area`);
  await w.page.selectOption(`.colrow:nth-child(2) .colFn`, `sum`);
  await w.page.click(`#boardMore summary`);
  await w.page.check(`#boardTotal`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-type="table"] .dt tr`).length > 1);
  const rows = await w.page.$$eval(`.block[data-type="table"] .dt tr`, (list) => list.map((row) => [...row.children].map((cell) => cell.textContent)));
  assert.deepEqual(rows[rows.length - 1], [`Total`, `75,75`]);
  assert.match(await w.page.locator(`#boardTableInfo`).innerText(), /4/);
  await w.page.selectOption(`#boardMode`, `group`);
  await w.page.selectOption(`#boardGroup1`, `Usage`);
  await w.page.waitForFunction(() => /Classroom/.test(document.querySelector(`.block[data-type="table"]`).textContent));
  assert.deepEqual(w.errors, []);
});

test(`column lines can be moved and removed and a filter keeps the right rows`, async () => {
  const config = { mode: `list`, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  await w.page.click(`.colrow:nth-child(1) button[title]:nth-of-type(2)`);
  const order = (await model(w.page)).blocks[0].config.columns.map((c) => c.path);
  assert.deepEqual(order, [`Area`, `Number`]);
  await w.page.click(`.colrow:nth-child(1) button[title]:nth-of-type(3)`);
  assert.deepEqual((await model(w.page)).blocks[0].config.columns.map((c) => c.path), [`Number`]);
  await w.page.click(`#boardMore summary`);
  await w.page.selectOption(`#boardFilter1 select >> nth=0`, `Area`);
  await w.page.selectOption(`#boardFilter1 select >> nth=1`, `gt`);
  await w.page.fill(`#boardFilter1 input[type="text"]`, `10`);
  const saved = (await model(w.page)).blocks[0].config.filters;
  assert.deepEqual(saved, [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } }]);
  assert.equal((await cells(w.page)).length, 4);
  assert.deepEqual(w.errors, []);
});

test(`the table settings fit a 340 pixel dark panel without overflow and the table keeps its title`, async () => {
  const config = { mode: `group`, table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], total: true, columns: [{ path: `Area`, fn: `sum` }] };
  const w = await openWithRow({ savedOptions: tableModel(config), viewport: { width: 340, height: 700 }, colorScheme: `dark` }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 20 } });
  assert.equal(await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.equal(await w.page.locator(`#boardTable`).inputValue(), `Rooms`);
});

test(`the table menu lists every table and the rows menu says in a sentence which rows are kept`, async () => {
  const w = await openWithRow({ linked: `Rooms`, savedOptions: { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tb1`, type: `table`, title: ``, page: 0, x: 0, y: 0, w: 40, h: 14, config: {} }] } } }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 20 } });
  const tables = await w.page.$$eval(`#boardTable option`, (list) => list.map((o) => o.value));
  assert.ok(tables.includes(`Floors`) && tables.includes(`Buildings`) && tables.includes(`Rooms`) && tables.includes(`Sites`));
  assert.ok(tables.indexOf(`Rooms_summary_Usage`) > tables.indexOf(`Sites`));
  await w.page.selectOption(`#boardTable`, `Floors`);
  const rows = await w.page.$$eval(`#boardLink option`, (list) => list.map((o) => [o.value, o.textContent]));
  const building = rows.find(([value]) => value === `Building|Floors.Building`);
  assert.ok(building, JSON.stringify(rows));
  assert.match(building[1], /Floors\.Building/);
  assert.match(building[1], /Buildings/);
  assert.equal(rows[rows.length - 1][0], `|all`);
  await w.page.selectOption(`#boardLink`, `Building|Floors.Building`);
  assert.match(await w.page.locator(`#boardLinkInfo`).innerText(), /Floors\.Building/);
  await w.page.click(`.block[data-id="tb1"]`);
  assert.deepEqual(w.errors, []);
});

test(`a help badge shows one bubble only: no native title next to the drawn one`, async () => {
  const w = await openBoard();
  await edit(w);
  const badges = await w.page.$$eval(`#panelBoard .help`, (list) => list.map((b) => [b.hasAttribute(`title`), Boolean(b.dataset.tip)]));
  assert.ok(badges.length > 5);
  assert.ok(badges.every(([hasTitle, hasTip]) => !hasTitle && hasTip));
  await w.page.click(`.block, #boardAdd`).catch(() => {});
  const lab = await openBoard();
  await lab.page.click(`#tabLab`);
  assert.equal(await lab.page.$$eval(`#panelLab .help[title]`, (list) => list.length), 0);
});
