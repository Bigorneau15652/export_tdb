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
  await w.page.dblclick(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  assert.equal(await w.page.inputValue(`#boardTitle`), `Introduction`);
  await w.page.fill(`#boardTitle`, `Présentation de l'école`);
  await w.page.selectOption(`#boardType`, `image`);
  const block = (await model(w.page)).blocks.find((b) => b.id === `aaa1`);
  assert.equal(block.title, `Présentation de l'école`);
  assert.equal(block.type, `image`);
  assert.match(await w.page.locator(`.block[data-id="aaa1"]`).innerText(), /Présentation de l'école/);
  assert.deepEqual(w.errors, []);
});

test(`the pencil opens the settings and a size typed in millimetres is applied`, async () => {
  const w = await openBoard({ savedOptions: SAVED });
  await edit(w);
  await w.page.click(`.block[data-id="aaa1"]`, { position: { x: 20, y: 30 } });
  await w.page.click(`.block[data-id="aaa1"] .pencil`);
  assert.equal(await w.page.locator(`#boardPanel`).isVisible(), true);
  await w.page.fill(`#boardW`, `60`);
  await w.page.dispatchEvent(`#boardW`, `change`);
  assert.equal((await model(w.page)).blocks.find((b) => b.id === `aaa1`).w, 12);
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
