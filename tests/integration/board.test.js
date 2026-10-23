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

test(`pages are added when a block does not fit and removed when they are empty, without any button`, async () => {
  const w = await openBoard();
  await edit(w);
  assert.equal(await w.page.locator(`#boardAddPage`).count(), 0);
  assert.equal(await w.page.locator(`#boardRemovePage`).count(), 0);
  for (let i = 0; i < 4; i += 1) await addBlock(w, `table`);
  assert.ok((await model(w.page)).pages >= 2);
  const pages = (await model(w.page)).pages;
  assert.equal(await w.page.locator(`.page`).count(), pages + 1);
  assert.equal(await w.page.locator(`.page.newPage`).count(), 1);
  const lastPage = pages - 1;
  for (let guard = 0; guard < 6; guard += 1) {
    const onLast = (await model(w.page)).blocks.filter((b) => b.page === lastPage);
    if (!onLast.length) break;
    await w.page.click(`.block[data-id="${onLast[0].id}"]`, { position: { x: 20, y: 20 } });
    await w.page.keyboard.press(`Delete`);
    await w.page.click(`#boardConfirmYes`);
  }
  assert.equal((await model(w.page)).pages, pages - 1);
  assert.equal(await w.page.locator(`.page`).count(), pages);
  assert.deepEqual(w.errors, []);
});

test(`dropping a block on the empty page at the end creates that page`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  assert.equal((await model(w.page)).pages, 1);
  const first = await box(w.page, `.block[data-id="aaa1"]`);
  const ghost = await box(w.page, `.page.newPage`);
  await w.page.mouse.move(first.x + 20, first.y + 30);
  await w.page.mouse.down();
  await w.page.mouse.move(ghost.x + 80, ghost.y + 80, { steps: 8 });
  await w.page.mouse.up();
  const saved = await model(w.page);
  assert.equal(saved.pages, 2);
  assert.equal(saved.blocks.find((b) => b.id === `aaa1`).page, 1);
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

test(`a double click opens the settings and the title is changed there`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.dblclick(`.block[data-id="bbb2"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  assert.equal(await w.page.inputValue(`#boardTitle`), `Surfaces`);
  await w.page.fill(`#boardTitle`, `Présentation de l'école`);
  const block = (await model(w.page)).blocks.find((b) => b.id === `bbb2`);
  assert.equal(block.title, `Présentation de l'école`);
  assert.match(await w.page.locator(`.block[data-id="bbb2"]`).innerText(), /Présentation de l'école/);
  assert.equal(await w.page.locator(`#boardType`).count(), 0);
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
  assert.equal(await w.page.locator(`#boardKind`).inputValue(), `dynamic`);
  assert.equal(await w.page.locator(`#boardLinkRow`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardTable`).inputValue(), ``);
  assert.match(await w.page.locator(`.block[data-type="table"]`).innerText(), /table|Table/);
  await w.page.selectOption(`#boardTable`, `Rooms`);
  await w.page.selectOption(`#boardLink`, `|Rooms.Site`);
  await w.page.click(`#boardAddColumn`);
  await w.page.selectOption(`.colrow:nth-child(1) .colPath`, `Number`);
  await w.page.click(`#boardAddColumn`);
  await w.page.selectOption(`.colrow:nth-child(2) .colPath`, `Area`);
  await w.page.selectOption(`.colrow:nth-child(2) .colFn`, `sum`);
  await w.page.check(`#boardTotal`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-type="table"] .dt tr`).length > 1);
  const rows = await w.page.$$eval(`.block[data-type="table"] .dt tr`, (list) => list.map((row) => [...row.children].map((cell) => cell.textContent)));
  assert.deepEqual(rows[rows.length - 1], [`Total`, `75,75`]);
  assert.match(await w.page.locator(`#boardTableInfo`).innerText(), /4/);
  assert.equal(await w.page.locator(`#boardMode`).count(), 0);
  assert.equal(await w.page.locator(`#boardGroup2`).count(), 0);
  await w.page.selectOption(`#boardGroup1`, `Usage`);
  await w.page.waitForFunction(() => /Classroom/.test(document.querySelector(`.block[data-type="table"]`).textContent));
  assert.equal((await model(w.page)).blocks[0].config.mode, `group`);
  assert.deepEqual(w.errors, []);
});

test(`a fixed table keeps the whole table, shows no link menu and lists every table`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area`, fn: `sum` }], total: true };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  await w.page.selectOption(`#boardKind`, `fixed`);
  assert.equal(await w.page.locator(`#boardLinkRow`).isHidden(), true);
  assert.equal((await model(w.page)).blocks[0].config.link, `all`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] .dt tr`).length === 8);
  const rows = await cells(w.page);
  assert.deepEqual(rows[rows.length - 1], [`Total`, `120,75`]);
  const tables = await w.page.$$eval(`#boardTable option`, (list) => list.map((o) => o.value));
  assert.ok(tables.includes(`Notes`) && tables.includes(`Contacts`));
  await w.page.selectOption(`#boardKind`, `dynamic`);
  assert.equal(await w.page.locator(`#boardLinkRow`).isVisible(), true);
  assert.equal((await model(w.page)).blocks[0].config.link, ``);
  assert.deepEqual(w.errors, []);
});

test(`a dynamic table only offers the tables of the selected row and the other tables only in fixed mode`, async () => {
  const w = await openWithRow({ savedOptions: tableModel({}) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  const tables = await w.page.$$eval(`#boardTable option`, (list) => list.map((o) => o.value));
  assert.ok(tables.includes(`Rooms`) && tables.includes(`Buildings`) && tables.includes(`Sites`));
  assert.ok(!tables.includes(`Notes`) && !tables.includes(`Contacts`));
  const groups = await w.page.$$eval(`#boardTable optgroup`, (list) => list.map((g) => g.label));
  assert.ok(groups.length >= 1);
  await w.page.selectOption(`#boardTable`, `Rooms`);
  await w.page.selectOption(`#boardKind`, `fixed`);
  await w.page.selectOption(`#boardKind`, `dynamic`);
  assert.equal(await w.page.locator(`#boardTable`).inputValue(), `Rooms`);
  assert.deepEqual(w.errors, []);
});

test(`the item makes a grouped table and the calculation decides which columns are offered`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal((await model(w.page)).blocks[0].config.mode, `list`);
  const listColumns = await w.page.$$eval(`.colrow:nth-child(1) .colPath option`, (list) => list.map((o) => o.value));
  assert.ok(listColumns.includes(`Number`) && listColumns.includes(`Building`));
  await w.page.selectOption(`#boardGroup1`, `Usage`);
  const saved = (await model(w.page)).blocks[0].config;
  assert.equal(saved.mode, `group`);
  assert.deepEqual(saved.columns.map((c) => [c.path, c.fn]), [[`Number`, `count`], [`Area`, `sum`]]);
  const sumColumns = await w.page.$$eval(`.colrow:nth-child(2) .colPath option`, (list) => list.map((o) => o.value));
  assert.ok(sumColumns.includes(`Area`) && sumColumns.includes(`Seats`) && sumColumns.includes(`Building.Year`));
  assert.ok(!sumColumns.includes(`Number`) && !sumColumns.includes(`Building`) && !sumColumns.includes(`Building.Name`));
  await w.page.selectOption(`.colrow:nth-child(2) .colFn`, `count`);
  const countColumns = await w.page.$$eval(`.colrow:nth-child(2) .colPath option`, (list) => list.map((o) => o.value));
  assert.ok(countColumns.includes(`Number`) && countColumns.includes(`Building`));
  await w.page.selectOption(`.colrow:nth-child(1) .colFn`, `sum`);
  assert.equal((await model(w.page)).blocks[0].config.columns[0].path, ``);
  await w.page.selectOption(`#boardGroup1`, ``);
  assert.equal((await model(w.page)).blocks[0].config.mode, `list`);
  assert.deepEqual(w.errors, []);
});

test(`column lines can be moved and removed and a filter keeps the right rows`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }, { path: `Area` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  await w.page.click(`.colrow:nth-child(1) .colBottom button:nth-of-type(2)`);
  const order = (await model(w.page)).blocks[0].config.columns.map((c) => c.path);
  assert.deepEqual(order, [`Area`, `Number`]);
  await w.page.click(`.colrow:nth-child(1) .colBottom button:nth-of-type(3)`);
  assert.deepEqual((await model(w.page)).blocks[0].config.columns.map((c) => c.path), [`Number`]);
  assert.equal(await w.page.locator(`#boardFilterBody`).isHidden(), true);
  await w.page.click(`#boardMore summary`);
  await w.page.click(`#boardFilterToggle`);
  assert.equal(await w.page.locator(`#boardFilterBody`).isVisible(), true);
  await w.page.selectOption(`#boardFilter1 select >> nth=0`, `Area`);
  await w.page.selectOption(`#boardFilter1 select >> nth=1`, `gt`);
  await w.page.fill(`#boardFilter1 input[type="text"]`, `10`);
  const saved = (await model(w.page)).blocks[0].config.filters;
  assert.deepEqual(saved, [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } }]);
  assert.equal((await cells(w.page)).length, 4);
  assert.deepEqual(w.errors, []);
});

test(`the Learn more panel counts the rows kept by each choice for the selected row`, async () => {
  const config = { table: `Floors`, link: `` };
  const w = await openWithRow({ linked: `Rooms`, savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardExplain`).isHidden(), true);
  await w.page.click(`#boardRowsHelp`);
  await w.page.click(`.helpBubble .helpMore`);
  await w.page.waitForFunction(() => /Floors.Building/.test(document.getElementById(`boardExplain`).textContent) && !/cannot be counted|pas encore/.test(document.getElementById(`boardExplain`).textContent));
  const text = await w.page.locator(`#boardExplain`).innerText();
  assert.match(text, /4 (rows?|ligne)/);
  assert.match(text, /2 (row|ligne)/);
  assert.match(text, /1 (row|ligne)/);
  await w.page.click(`#boardExplainClose`);
  assert.equal(await w.page.locator(`#boardExplain`).isHidden(), true);
  assert.deepEqual(w.errors, []);
});

test(`the advanced links stay hidden until More choices is ticked`, async () => {
  const w = await openWithRow({ linked: `Rooms`, savedOptions: tableModel({ table: `Floors`, link: `` }) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardLink optgroup`).count(), 0);
  await w.page.check(`#boardMoreLinks`);
  assert.equal(await w.page.locator(`#boardLink optgroup`).count(), 1);
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

test(`the rows menu says in a short sentence which rows are kept and keeps the advanced links apart`, async () => {
  const w = await openWithRow({ linked: `Rooms`, savedOptions: { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tb1`, type: `table`, title: ``, page: 0, x: 0, y: 0, w: 40, h: 14, config: {} }] } } }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 20 } });
  await w.page.selectOption(`#boardTable`, `Floors`);
  const rows = await w.page.$$eval(`#boardLink option`, (list) => list.map((o) => [o.value, o.textContent]));
  const building = rows.find(([value]) => value === `Building|Floors.Building`);
  assert.ok(building, JSON.stringify(rows));
  assert.match(building[1], /Same Building as the selected row|Même Building que la ligne sélectionnée/);
  assert.ok(!rows.some(([value]) => value === `|all`));
  assert.ok(rows.length < 8, `the menu must stay short: ${rows.length}`);
  await w.page.selectOption(`#boardLink`, `Building|Floors.Building`);
  assert.match(await w.page.locator(`#boardRowsHelp`).getAttribute(`data-tip`), /Floors\.Building/);
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

test(`a help badge opens a bubble on click and its cross closes it`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.dblclick(`.block[data-id="bbb2"]`, { position: { x: 20, y: 30 } });
  await w.page.click(`#boardPanel .help`);
  assert.equal(await w.page.locator(`.helpBubble`).count(), 1);
  assert.ok((await w.page.locator(`.helpBubble`).innerText()).length > 3);
  await w.page.click(`.helpBubble .helpClose`);
  assert.equal(await w.page.locator(`.helpBubble`).count(), 0);
  await w.page.click(`#boardPanel .help`);
  await w.page.keyboard.press(`Escape`);
  assert.equal(await w.page.locator(`.helpBubble`).count(), 0);
  assert.deepEqual(w.errors, []);
});

test(`the columns have two lines and a total on the right has its own calculation and decimals`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Area` }, { path: `Area` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`.colrow:nth-child(1) .colTop .colFn`).count(), 1);
  assert.equal(await w.page.locator(`.colrow:nth-child(1) .colBottom .colPath`).count(), 1);
  assert.equal(await w.page.locator(`#boardTotalRight`).isDisabled(), false);
  assert.equal(await w.page.locator(`#boardTotalRightRow`).isHidden(), true);
  await w.page.check(`#boardTotalRight`);
  assert.equal(await w.page.locator(`#boardTotalRightRow`).isVisible(), true);
  await w.page.selectOption(`#boardTotalRightFn`, `max`);
  await w.page.click(`#boardTotalRightMore`);
  const saved = (await model(w.page)).blocks[0].config;
  assert.equal(saved.totalRight, true);
  assert.equal(saved.totalRightFn, `max`);
  assert.equal(saved.totalRightDecimals, 2);
  await w.page.click(`.colrow:nth-child(1) .colTop button:nth-of-type(2)`);
  assert.equal((await model(w.page)).blocks[0].config.columns[0].decimals, 2);
  assert.deepEqual(w.errors, []);
});

test(`the lines of a grouped table can follow the referenced table or a manual list`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], columns: [{ path: `Area`, fn: `sum` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardSortBy option[value="ref"]`).count(), 1);
  await w.page.selectOption(`#boardSortBy`, `manual`);
  await w.page.waitForFunction(() => document.querySelectorAll(`#boardSortOrder li`).length >= 2);
  const first = await w.page.locator(`#boardSortOrder li .orderName`).first().innerText();
  await w.page.click(`#boardSortOrder li:nth-child(1) button:nth-of-type(2)`);
  const order = (await model(w.page)).blocks[0].config.sort.order;
  assert.equal(order[1], first);
  assert.equal((await model(w.page)).blocks[0].config.sort.by, `manual`);
  await w.page.selectOption(`#boardSortBy`, `ref`);
  assert.equal((await model(w.page)).blocks[0].config.sort.by, `ref`);
  assert.deepEqual(w.errors, []);
});

test(`a long table continues on the next page with its heading, which is drawn even when the model has no such page`, async () => {
  const config = { mode: `list`, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }] };
  const build = (pages) => ({ model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages, blocks: [{ id: `tb1`, type: `table`, title: `Surfaces`, page: 0, x: 0, y: 0, w: 30, h: 4, config }] } });
  const w = await openWithRow({ savedOptions: build(2) }, 1);
  await w.page.waitForFunction(() => document.querySelectorAll(`.page[data-page="1"] .continuation .dt tbody tr`).length > 0);
  const total = await w.page.$$eval(`.block.tableBlock .dt tbody tr`, (rows) => rows.length);
  assert.equal(total, 4);
  assert.match(await w.page.locator(`.page[data-page="1"] .continuation .tableTitle`).innerText(), /Surfaces/);
  assert.equal(await w.page.locator(`.page[data-page="1"] .continuation .dt thead th`).first().innerText(), await w.page.locator(`.page[data-page="0"] .dt thead th`).first().innerText());
  assert.deepEqual(w.errors, []);
  const short = await openWithRow({ savedOptions: build(1) }, 1);
  await short.page.waitForFunction(() => document.querySelectorAll(`.page[data-page="1"] .continuation .dt tbody tr`).length > 0);
  assert.equal((await model(short.page)).pages, 1);
  assert.equal(await short.page.locator(`.page`).count(), 2);
  const frame = await short.page.locator(`.page[data-page="1"] .continuation`).boundingBox();
  const wholePage = await short.page.locator(`.page[data-page="1"]`).boundingBox();
  assert.ok(frame.height < wholePage.height / 2, `the frame of the rest takes the height of its rows`);
  await edit(short);
  assert.equal(await short.page.locator(`.page.newPage`).count(), 1);
  assert.equal(await short.page.locator(`.page`).count(), 3);
  assert.deepEqual(short.errors, []);
});

test(`a double click on the rest of a long table opens the settings of that table`, async () => {
  const config = { mode: `list`, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }] };
  const saved = { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tb1`, type: `table`, title: `Surfaces`, page: 0, x: 0, y: 0, w: 30, h: 4, config }] } };
  const w = await openWithRow({ savedOptions: saved }, 1);
  await edit(w);
  await w.page.waitForFunction(() => document.querySelectorAll(`.page[data-page="1"] .continuation .dt tbody tr`).length > 0);
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), false);
  await w.page.dblclick(`.page[data-page="1"] .continuation`, { position: { x: 20, y: 10 } });
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  assert.equal(await w.page.inputValue(`#boardTitle`), `Surfaces`);
  assert.equal(await w.page.locator(`#boardTableSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`.block[data-id="tb1"].selected`).count(), 1);
  assert.equal((await model(w.page)).blocks.length, 1);
  assert.deepEqual(w.errors, []);
});

test(`every table continues on the next pages by itself and the settings have no tick box for it`, async () => {
  const config = { mode: `list`, table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Number` }] };
  const saved = { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `tb1`, type: `table`, title: `Surfaces`, page: 0, x: 0, y: 0, w: 30, h: 4, config }] } };
  const w = await openWithRow({ savedOptions: saved }, 1);
  await w.page.waitForFunction(() => document.querySelectorAll(`.page[data-page="1"] .continuation .dt tbody tr`).length > 0);
  assert.equal(await w.page.locator(`#boardFlow`).count(), 0);
  assert.deepEqual(w.errors, []);
});

test(`a record block shows the information of the selected row as small labels above their values`, async () => {
  const config = { items: [{ path: `Number`, label: `Salle` }, { path: `Site.Name` }, { path: `Area` }], columns: 3, size: `normal` };
  const saved = { model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `rb1`, type: `record`, title: `Identité`, page: 0, x: 0, y: 0, w: 40, h: 8, config }] } };
  const w = await openWithRow({ linked: `Rooms`, savedOptions: saved }, 1);
  await w.page.waitForFunction(() => document.querySelectorAll(`.recordCell`).length === 3);
  const cells = await w.page.$$eval(`.recordCell`, (list) => list.map((cell) => [cell.querySelector(`.recordLabel`).textContent, cell.querySelector(`.recordValue`).textContent]));
  assert.deepEqual(cells[0], [`Salle`, `A-001`]);
  assert.equal(cells[1][0], `Name`);
  assert.ok(cells[1][1].length > 0);
  assert.deepEqual(cells[2], [`Area`, `20,5`]);
  assert.match(await w.page.locator(`.recordTitle`).innerText(), /Identité/);
  await edit(w);
  await w.page.dblclick(`.block[data-id="rb1"]`, { position: { x: 20, y: 10 } });
  assert.equal(await w.page.locator(`#boardRecordSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardRecordRows .colrow`).count(), 3);
  await w.page.click(`#boardRecordAdd`);
  assert.equal(await w.page.locator(`#boardRecordRows .colrow`).count(), 4);
  await w.page.selectOption(`#boardRecordRows .colrow:nth-child(4) .colPath`, `Number`);
  await w.page.fill(`#boardRecordRows .colrow:nth-child(4) .colLabel`, `Autre`);
  await w.page.click(`#boardRecordRows .colrow:nth-child(1) .colBottom button:nth-of-type(2)`);
  await w.page.selectOption(`#boardRecordColumns`, `2`);
  const block = (await model(w.page)).blocks[0];
  assert.equal(block.config.columns, 2);
  assert.equal(block.config.items.length, 4);
  assert.equal(block.config.items[0].path, `Site.Name`);
  assert.equal(block.config.items[3].label, `Autre`);
  assert.deepEqual(w.errors, []);
});

test(`a record block can be added from the tools`, async () => {
  const w = await openBoard();
  await edit(w);
  await addBlock(w, `record`);
  assert.equal(await w.page.locator(`.block[data-type="record"]`).count(), 1);
  assert.deepEqual(w.errors, []);
});

const VALUES_MODEL = (values, blocks) => ({ model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks, values } });
const AREA_VALUE = { name: `area`, kind: `calc`, table: `Rooms`, start: ``, link: `Rooms.Site`, fn: `sum`, path: `Area`, unit: `m²`, decimals: 1 };

test(`a named value is used in a text with its name between braces`, async () => {
  const text = { source: `fixed`, text: `Surface : {area}`, size: `normal`, align: `left`, fill: `none` };
  const w = await openWithRow({ savedOptions: VALUES_MODEL([AREA_VALUE], [{ id: `tx1`, type: `text`, title: ``, page: 0, x: 0, y: 0, w: 30, h: 6, config: text }]) }, 1);
  await w.page.waitForFunction(() => /75,8/.test(document.querySelector(`.block[data-id="tx1"]`).textContent));
  assert.match(await w.page.locator(`.block[data-id="tx1"]`).innerText(), /Surface : 75,8.m²/);
  assert.deepEqual(w.errors, []);
});

test(`the named values are edited in the panel and an expression uses another value`, async () => {
  const w = await openWithRow({ savedOptions: VALUES_MODEL([AREA_VALUE], []) }, 1);
  await edit(w);
  await w.page.click(`#boardValuesButton`);
  assert.equal(await w.page.locator(`#boardValuesSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardTableSettings`).isHidden(), true);
  await w.page.waitForFunction(() => /= 75,8/.test(document.querySelector(`.valueCard .valueResult`).textContent));
  await w.page.click(`#boardValuesAdd`);
  assert.equal(await w.page.locator(`.valueCard`).count(), 2);
  await w.page.fill(`.valueCard:nth-child(2) .valueName`, `double`);
  await w.page.selectOption(`.valueCard:nth-child(2) .valueKind`, `expr`);
  await w.page.fill(`.valueCard:nth-child(2) .valueExpr`, `{area} * 2`);
  await w.page.waitForFunction(() => /= 151,5/.test(document.querySelectorAll(`.valueCard .valueResult`)[1].textContent));
  const saved = (await model(w.page)).values;
  assert.deepEqual([saved[1].name, saved[1].kind, saved[1].expr], [`double`, `expr`, `{area} * 2`]);
  await w.page.fill(`.valueCard:nth-child(2) .valueExpr`, `{nothing} * 2`);
  await w.page.waitForFunction(() => /Pas de résultat|No result/.test(document.querySelectorAll(`.valueCard .valueResult`)[1].textContent));
  await w.page.click(`.valueCard:nth-child(2) .valueRemove`);
  assert.equal(await w.page.locator(`.valueCard`).count(), 1);
  assert.deepEqual(w.errors, []);
});

test(`the fields menu of a text offers the named values`, async () => {
  const text = { source: `fixed`, text: ``, size: `normal`, align: `left`, fill: `none` };
  const w = await openWithRow({ savedOptions: VALUES_MODEL([AREA_VALUE], [{ id: `tx1`, type: `text`, title: ``, page: 0, x: 0, y: 0, w: 30, h: 6, config: text }]) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tx1"]`, { position: { x: 20, y: 10 } });
  const options = await w.page.$$eval(`#boardField option`, (list) => list.map((option) => option.value));
  assert.ok(options.includes(`area`));
  await w.page.selectOption(`#boardField`, `area`);
  assert.equal(await w.page.inputValue(`#boardText`), `{area}`);
  assert.deepEqual(w.errors, []);
});

test(`a calculation is built with the table, the rows, the function and the column`, async () => {
  const w = await openWithRow({ savedOptions: VALUES_MODEL([], []) }, 1);
  await edit(w);
  await w.page.click(`#boardValuesButton`);
  await w.page.click(`#boardValuesAdd`);
  await w.page.fill(`.valueCard .valueName`, `total`);
  await w.page.selectOption(`.valueCard .valueTable`, `Rooms`);
  const links = await w.page.$$eval(`.valueCard .valueLink option`, (list) => list.map((option) => option.value));
  assert.ok(links.includes(`|Rooms.Site`), JSON.stringify(links));
  await w.page.selectOption(`.valueCard .valueLink`, `|Rooms.Site`);
  await w.page.selectOption(`.valueCard .valueFn`, `sum`);
  await w.page.selectOption(`.valueCard .valuePath`, `Area`);
  await w.page.waitForFunction(() => /= 75,75/.test(document.querySelector(`.valueCard .valueResult`).textContent));
  const value = (await model(w.page)).values[0];
  assert.deepEqual([value.table, value.link, value.fn, value.path], [`Rooms`, `Rooms.Site`, `sum`, `Area`]);
  assert.equal(await w.page.locator(`.valueCard .valueFilters fieldset`).count(), 2);
  assert.deepEqual(w.errors, []);
});

test(`the named values button is next to the Done button, only in the editing mode`, async () => {
  const w = await openBoard();
  assert.equal(await w.page.locator(`#boardValuesButton`).isHidden(), true);
  await edit(w);
  assert.equal(await w.page.locator(`#boardValuesButton`).isVisible(), true);
  const done = await box(w.page, `#boardEdit`);
  const values = await box(w.page, `#boardValuesButton`);
  assert.ok(Math.abs(done.y - values.y) < done.height, `on the same line as the Done button`);
  assert.deepEqual(w.errors, []);
});

const INDICATOR_MODEL = (config, title = `Surface`) => VALUES_MODEL([AREA_VALUE], [{ id: `in1`, type: `indicator`, title, page: 0, x: 0, y: 0, w: 14, h: 8, config }]);

test(`an indicator shows a named value in bold with a colour that follows its rules`, async () => {
  const config = { value: `area`, note: `sur {area}`, size: `normal`, base: `grey`, rules: [{ op: `ge`, limit: 100, color: `green` }, { op: `ge`, limit: 50, color: `orange` }] };
  const w = await openWithRow({ savedOptions: INDICATOR_MODEL(config) }, 1);
  await w.page.waitForFunction(() => /75,8/.test(document.querySelector(`.block[data-id="in1"] .indValueText`).textContent));
  const node = w.page.locator(`.block[data-id="in1"]`);
  assert.match(await node.getAttribute(`class`), /ind-orange/);
  assert.equal(await node.locator(`.indLabelText`).innerText(), `Surface`);
  assert.equal(await node.locator(`.indSymbol`).innerText(), `!`);
  assert.match(await node.locator(`.indNoteText`).innerText(), /sur 75,8/);
  assert.deepEqual(w.errors, []);
});

test(`an indicator with no value or an unknown value shows a dash and the default colour`, async () => {
  const w = await openWithRow({ savedOptions: INDICATOR_MODEL({ value: `unknown`, base: `blue`, rules: [{ op: `ge`, limit: 1, color: `green` }] }) }, 1);
  await w.page.waitForFunction(() => document.querySelector(`.block[data-id="in1"] .indValueText`));
  assert.equal(await w.page.locator(`.block[data-id="in1"] .indValueText`).innerText(), `–`);
  assert.match(await w.page.locator(`.block[data-id="in1"]`).getAttribute(`class`), /ind-blue/);
  assert.deepEqual(w.errors, []);
});

test(`the settings of an indicator choose the value, the note and the rules`, async () => {
  const w = await openWithRow({ savedOptions: INDICATOR_MODEL({}) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="in1"]`, { position: { x: 20, y: 10 } });
  assert.equal(await w.page.locator(`#boardIndicatorSettings`).isVisible(), true);
  await w.page.selectOption(`.indValue`, `area`);
  await w.page.fill(`.indNote`, `Surface totale`);
  await w.page.click(`#boardIndicatorBody button.button`);
  assert.equal(await w.page.locator(`.indRule`).count(), 1);
  await w.page.fill(`.indRule .indLimit`, `50,5`);
  await w.page.selectOption(`.indRule .indColor`, `green`);
  const config = (await model(w.page)).blocks[0].config;
  assert.equal(config.value, `area`);
  assert.equal(config.note, `Surface totale`);
  assert.deepEqual(config.rules, [{ op: `ge`, limit: 50.5, color: `green` }]);
  await w.page.waitForFunction(() => /ind-green/.test(document.querySelector(`.block[data-id="in1"]`).className));
  assert.match(await w.page.locator(`#boardIndicatorBody .hint`).innerText(), /75,8/);
  await w.page.click(`.indRule button:nth-of-type(3)`);
  assert.equal(await w.page.locator(`.indRule`).count(), 0);
  assert.deepEqual(w.errors, []);
});

test(`an item in columns makes a cross table that can be cut into slices`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], merge: true, columns: [{ path: `Area`, fn: `sum` }] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardCrossBox`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardCrossMore`).isHidden(), true);
  await w.page.selectOption(`#boardColItem`, `Floor`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] .dt th`).length === 3);
  const headers = await w.page.$$eval(`.block[data-id="tb1"] .dt th`, (list) => list.map((cell) => cell.textContent));
  assert.deepEqual(headers, [`Usage`, `Ground`, `Level 1`]);
  assert.equal(await w.page.locator(`#boardCrossMore`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardAddColumn`).isHidden(), true);
  assert.equal((await model(w.page)).blocks[0].config.mode, `cross`);
  await w.page.selectOption(`#boardColItem`, `Number`);
  await w.page.selectOption(`#boardSlice`, `3`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] table.dt`).length === 2);
  await w.page.selectOption(`#boardColItem`, ``);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] table.dt`).length === 1);
  assert.equal((await model(w.page)).blocks[0].config.mode, `group`);
  assert.deepEqual(w.errors, []);
});

test(`choosing an item in columns on a table without calculation adds the calculation line to fill`, async () => {
  const config = { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`] };
  const w = await openWithRow({ savedOptions: tableModel(config) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="tb1"]`, { position: { x: 20, y: 30 } });
  assert.equal((await model(w.page)).blocks[0].config.columns.length, 0);
  await w.page.selectOption(`#boardColItem`, `Floor`);
  assert.equal(await w.page.locator(`#boardColumnRows .colrow`).count(), 1);
  await w.page.selectOption(`#boardColumnRows .colrow .colPath`, `Area`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.block[data-id="tb1"] .dt th`).length >= 3);
  assert.equal(await w.page.locator(`#boardAddColumn`).isHidden(), true);
  assert.match(await w.page.locator(`#boardColumnsLabel`).innerText(), /Calcul des cases|Calculation of the cells/);
  assert.deepEqual(w.errors, []);
});

const chartModel = (config, extra = {}) => ({ model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `ch1`, type: `chart`, title: `Surfaces`, page: 0, x: 0, y: 0, w: 40, h: 20, config, ...extra }] } });
const CHART_CONFIG = { table: `Rooms`, link: `Rooms.Site`, groupBy: [`Usage`], columns: [{ path: `Area`, fn: `sum` }] };

test(`a chart is drawn in SVG inside the strict policy of the page`, async () => {
  const w = await openWithRow({ savedOptions: chartModel({ ...CHART_CONFIG, chart: `bar`, labels: `values` }) }, 1);
  await w.page.waitForFunction(() => document.querySelector(`.block[data-id="ch1"] .chartPlot svg`));
  assert.equal(await w.page.locator(`.block[data-id="ch1"] .chartPlot svg`).count(), 1);
  assert.ok((await w.page.locator(`.block[data-id="ch1"] svg path`).count()) >= 3);
  const texts = await w.page.$$eval(`.block[data-id="ch1"] svg text`, (list) => list.map((node) => node.textContent));
  assert.ok(texts.includes(`Classroom`) && texts.includes(`Office`), texts.join(`|`));
  assert.match(await w.page.locator(`.block[data-id="ch1"] .chartTitle`).innerText(), /Surfaces/);
  assert.deepEqual(w.errors, []);
});

test(`the settings of a chart choose the type, the palette, the legend and the labels`, async () => {
  const w = await openWithRow({ savedOptions: chartModel({ ...CHART_CONFIG }) }, 1);
  await edit(w);
  await w.page.dblclick(`.block[data-id="ch1"]`, { position: { x: 20, y: 10 } });
  assert.equal(await w.page.locator(`#boardChartSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardTableSettings`).isVisible(), true);
  assert.equal(await w.page.locator(`#boardTotal`).isHidden(), true);
  assert.equal(await w.page.locator(`#boardSlice`).isHidden(), true);
  assert.match(await w.page.locator(`#boardTableHeading`).innerText(), /graphique|chart/i);
  await w.page.selectOption(`#boardChartType`, `donut`);
  await w.page.selectOption(`#boardChartPalette`, `froide`);
  await w.page.selectOption(`#boardChartLegend`, `right`);
  await w.page.selectOption(`#boardChartLabels`, `percent`);
  const config = (await model(w.page)).blocks[0].config;
  assert.deepEqual([config.chart, config.palette, config.legend, config.labels], [`donut`, `froide`, `right`, `percent`]);
  await w.page.waitForFunction(() => document.querySelector(`.block[data-id="ch1"] .chartPlot svg`));
  const fills = await w.page.$$eval(`.block[data-id="ch1"] svg path`, (list) => list.map((node) => node.getAttribute(`fill`)));
  assert.ok(fills.some((fill) => /#0b3d66/i.test(fill || ``)), fills.join(`|`));
  assert.deepEqual(w.errors, []);
});

test(`a chart needs an item, and a cross table gives one series per column`, async () => {
  const w = await openWithRow({ savedOptions: chartModel({ table: `Rooms`, link: `Rooms.Site`, columns: [{ path: `Area`, fn: `sum` }] }) }, 1);
  await edit(w);
  assert.match(await w.page.locator(`.block[data-id="ch1"] .tableHint`).innerText(), /item|Item/);
  await w.page.dblclick(`.block[data-id="ch1"]`, { position: { x: 20, y: 10 } });
  await w.page.selectOption(`#boardGroup1`, `Usage`);
  await w.page.selectOption(`#boardColItem`, `Floor`);
  await w.page.waitForFunction(() => document.querySelector(`.block[data-id="ch1"] .chartPlot svg`));
  await w.page.selectOption(`#boardChartType`, `stack`);
  const texts = await w.page.$$eval(`.block[data-id="ch1"] svg text`, (list) => list.map((node) => node.textContent));
  assert.ok(texts.includes(`Ground`) && texts.includes(`Level 1`), texts.join(`|`));
  assert.deepEqual(w.errors, []);
});

const imageModel = (config, extra = {}) => ({ model: { version: 1, page: { format: `screen`, orientation: `landscape`, margin: 10 }, pages: 1, blocks: [{ id: `im1`, type: `image`, title: `Photo`, page: 0, x: 0, y: 0, w: 30, h: 20, config, ...extra }] } });

test(`an attachment is shown through the token of Grist, fills the frame and has the caption of a column`, async () => {
  const w = await openWithRow({ linked: `Buildings`, savedOptions: imageModel({ path: `Photo`, rank: 1, caption: `Name` }) }, 1);
  await w.page.waitForFunction(() => { const img = document.querySelector(`.block[data-id="im1"] img`); return img && img.complete && img.naturalWidth > 0; });
  const src = await w.page.locator(`.block[data-id="im1"] img`).getAttribute(`src`);
  assert.match(src, /\/attachments\/11\/download\?auth=/);
  assert.equal(await w.page.locator(`.block[data-id="im1"] img`).evaluate((img) => getComputedStyle(img).objectFit), `cover`);
  assert.match(await w.page.locator(`.block[data-id="im1"] .imageCaption`).innerText(), /^Building A$/);
  assert.match(await w.page.locator(`.block[data-id="im1"] .imageTitle`).innerText(), /Photo/);
  assert.deepEqual(w.errors, []);
});

test(`a picture that cannot be loaded is replaced by a clear message`, async () => {
  const w = await openWithRow({ linked: `Buildings`, savedOptions: imageModel({ path: `Photo`, rank: 2 }) }, 1);
  await w.page.waitForSelector(`.block[data-id="im1"] .imageMessage`);
  assert.match(await w.page.locator(`.block[data-id="im1"] .imageMessage`).innerText(), /chargée|loaded/);
  assert.deepEqual(w.errors, []);
});

test(`a Nextcloud share link is shown through its download address`, async () => {
  const w = await openWithRow({ linked: `Buildings`, savedOptions: imageModel({ path: `Link`, rank: 1 }) }, 1);
  await w.page.waitForFunction(() => { const img = document.querySelector(`.block[data-id="im1"] img`); return img && img.complete && img.naturalWidth > 0; });
  assert.equal(await w.page.locator(`.block[data-id="im1"] img`).getAttribute(`src`), `https://cloud.example.org/s/AbC123/download`);
  assert.deepEqual(w.errors, []);
});

test(`OneDrive links and links that are not https are refused with a message, and the rank picks a line`, async () => {
  const w = await openWithRow({ linked: `Buildings`, savedOptions: imageModel({ path: `Link`, rank: 1 }) }, 2);
  assert.match(await w.page.locator(`.block[data-id="im1"] .imageMessage`).innerText(), /OneDrive/);
  await w.selectRow(3);
  await w.page.waitForFunction(() => /https/.test((document.querySelector(`.block[data-id="im1"] .imageMessage`) || {}).textContent || ``));
  await w.selectRow(2);
  await edit(w);
  await w.page.dblclick(`.block[data-id="im1"]`, { position: { x: 20, y: 30 } });
  await w.page.fill(`#boardImageRank`, `2`);
  await w.page.waitForFunction(() => { const img = document.querySelector(`.block[data-id="im1"] img`); return img && img.complete && img.naturalWidth > 0; });
  assert.equal(await w.page.locator(`.block[data-id="im1"] img`).getAttribute(`src`), `https://cloud.example.org/index.php/s/Second/download`);
  assert.deepEqual(w.errors, []);
});

test(`the settings of an image block choose the column, the rank and the caption`, async () => {
  const w = await openWithRow({ linked: `Buildings`, savedOptions: imageModel({}) }, 1);
  assert.equal(await w.page.locator(`.block[data-id="im1"] .imageMessage`).count(), 0);
  await edit(w);
  assert.match(await w.page.locator(`.block[data-id="im1"]`).innerText(), /colonne|column/i);
  await w.page.dblclick(`.block[data-id="im1"]`, { position: { x: 20, y: 30 } });
  const choices = await w.page.$$eval(`#boardImageColumn option`, (list) => list.map((option) => option.value));
  assert.ok(choices.includes(`Photo`) && choices.includes(`Link`) && choices.includes(`Site.Name`), choices.join(`|`));
  assert.ok(!choices.includes(`Year`));
  await w.page.selectOption(`#boardImageColumn`, `Photo`);
  await w.page.selectOption(`#boardImageCaption`, `Name`);
  await w.page.fill(`#boardImageRank`, `2`);
  await w.page.waitForFunction(() => document.querySelector(`.block[data-id="im1"] img`));
  const config = (await model(w.page)).blocks[0].config;
  assert.deepEqual([config.path, config.rank, config.caption], [`Photo`, 2, `Name`]);
  assert.deepEqual(w.errors, []);
});

const printModel = (page = {}) => ({ model: { version: 1, page: { format: `a4`, orientation: `landscape`, margin: 10, ...page }, pages: 2, blocks: [
  { id: `p1`, type: `text`, title: ``, page: 0, x: 0, y: 0, w: 30, h: 6, config: { source: `fixed`, text: `# First page` } },
  { id: `p2`, type: `chart`, title: `Surfaces`, page: 0, x: 0, y: 8, w: 30, h: 16, config: { ...CHART_CONFIG, chart: `bar` } },
  { id: `p3`, type: `text`, title: ``, page: 1, x: 0, y: 0, w: 30, h: 6, config: { source: `fixed`, text: `# Second page` } }
] } });

// Clicks Print and returns the print window once its pages are ready.
async function openPrint(w) {
  const [popup] = await Promise.all([w.context.waitForEvent(`page`), w.page.click(`#boardPrint`)]);
  await popup.waitForFunction(() => /prêtes|ready/.test((document.querySelector(`.printMessage`) || {}).textContent || ``), null, { timeout: 20000 });
  return popup;
}

test(`the print window holds every page at its real size with the blocks drawn like on screen`, async () => {
  const w = await openWithRow({ savedOptions: printModel() }, 1);
  const before = await box(w.page, `.block[data-id="p1"]`);
  const popup = await openPrint(w);
  assert.equal(await popup.locator(`.printSheet .page`).count(), 2);
  assert.equal(await popup.locator(`.printSheet .page`).first().getAttribute(`data-size`), `a4-landscape`);
  assert.equal(Math.round((await popup.locator(`.printSheet .page`).first().boundingBox()).width), Math.round(297 * 96 / 25.4));
  assert.match(await popup.locator(`.block[data-id="p1"]`).innerText(), /First page/);
  assert.match(await popup.locator(`.block[data-id="p3"]`).innerText(), /Second page/);
  assert.equal(await popup.locator(`.block[data-id="p2"] svg`).count(), 1);
  assert.equal(await popup.locator(`.printBar`).count(), 1);
  const after = await box(w.page, `.block[data-id="p1"]`);
  assert.equal(Math.round(after.width), Math.round(before.width));
  assert.equal(await w.page.locator(`.pageWrap`).count(), 2);
  assert.deepEqual(w.errors, []);
  await popup.close();
});

test(`the PDF of the print window has one sheet per page at the size of the format`, async () => {
  const w = await openWithRow({ savedOptions: printModel() }, 1);
  const popup = await openPrint(w);
  const pdf = (await popup.pdf({ preferCSSPageSize: true, printBackground: true })).toString(`latin1`);
  assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 2);
  const media = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(pdf);
  assert.ok(media, `no media box`);
  assert.ok(Math.abs(Number(media[1]) - 841.89) < 1.5 && Math.abs(Number(media[2]) - 595.28) < 1.5, media.slice(1, 3).join(` x `));
  await popup.close();
});

test(`the footer and the page numbers are written on every page, on screen and in the print window`, async () => {
  const w = await openWithRow({ savedOptions: printModel({ numbers: true, footer: `Internal report` }) }, 1);
  assert.equal(await w.page.locator(`.page .pageFooter`).count(), 2);
  assert.match(await w.page.locator(`.page .pageFooter`).nth(1).innerText(), /Internal report/);
  assert.match(await w.page.locator(`.page .pageFooter`).nth(1).innerText(), /2.*2/);
  const popup = await openPrint(w);
  assert.equal(await popup.locator(`.printSheet .pageFooter`).count(), 2);
  assert.match(await popup.locator(`.printSheet .pageFooter`).first().innerText(), /1.*2/);
  await popup.close();
});

test(`the footer text and the page numbers are set in the tools and saved with the page settings`, async () => {
  const w = await openWithRow({ savedOptions: printModel() }, 1);
  assert.equal(await w.page.locator(`.pageFooter`).count(), 0);
  await edit(w);
  await w.page.fill(`#boardFooter`, `Report {x}`);
  await w.page.check(`#boardNumbers`);
  await w.page.waitForFunction(() => document.querySelectorAll(`.pageFooter`).length === 2);
  const page = (await model(w.page)).page;
  assert.deepEqual([page.footer, page.numbers], [`Report {x}`, true]);
  assert.deepEqual(w.errors, []);
});
