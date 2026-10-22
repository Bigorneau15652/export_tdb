// Integration tests of the explorer page: it runs in a real browser (Chromium) with a fake Grist
// object built from an invented document. Run them with `npm run test:integration`.
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

const text = (page, selector) => page.locator(selector).innerText();
const reportOf = (page) => page.$eval(`#report`, (e) => e.value);
const finished = (page) => page.waitForFunction(() => document.getElementById(`status`).textContent === `Exploration finished.` || document.getElementById(`status`).textContent === `Exploration terminée.`);

test(`the explorer reads the structure and lists the descendant tables`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  const descendants = await text(w.page, `#descendants`);
  assert.match(descendants, /Buildings: Buildings\.Site -> Sites/);
  assert.match(descendants, /Rooms:/);
  assert.match(descendants, /Floors:/);
  assert.equal(await w.page.$$eval(`#tableList li`, (items) => items.length), 8);
  const report = await reportOf(w.page);
  assert.match(report, /Table: Sites/);
  assert.match(report, /selected table detected: OK/);
  assert.match(report, /metadata tables read: OK - 8 tables/);
  assert.match(report, /Rooms: 6 rows, \d+ columns, \d+ ms/);
  assert.deepEqual(w.errors, []);
});

test(`by default the report shows shapes and no value of the document`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  const report = await reportOf(w.page);
  assert.match(report, /Buildings\.Photo \[Attachments\] \["L", integer, integer\]/);
  assert.match(report, /Rooms\.Tags \[ChoiceList\] \["L", text\(6\)\]/);
  for (const secret of [`North campus`, `First contact`, `1 Example street`, `Building A`]) assert.ok(!report.includes(secret), secret);
});

test(`the report shows the values only when asked`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  await w.page.check(`#reveal`);
  await finished(w.page);
  assert.match(await reportOf(w.page), /Sites\.Name \[Text\] text "North campus"/);
});

test(`changing row increases the counter and the report`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  assert.match(await text(w.page, `#seen`), /: 1$/);
  await w.selectRow(2);
  await w.selectRow(1);
  assert.match(await text(w.page, `#seen`), /: 2$/);
  assert.match(await reportOf(w.page), /Rows seen while moving in the table: 2/);
});

test(`the attachment test loads a picture without showing the token`, async () => {
  const w = await openExplorer(browser, server.url, { linked: `Buildings` });
  await w.page.evaluate(() => { window.__linkedName = `Buildings`; });
  await w.selectRow(1);
  await finished(w.page);
  await w.page.click(`#attachmentTest`);
  await w.page.waitForFunction(() => /attachment token/.test(document.getElementById(`testResults`).textContent));
  const report = await reportOf(w.page);
  assert.match(report, /attachment token: OK - token ttl 60000 ms, host grist\.numerique\.gouv\.fr, loaded 1x1/);
  assert.ok(!report.includes(`SECRET-TOKEN`));
  assert.ok(!(await w.page.content()).includes(`SECRET-TOKEN`));
});

test(`the attachment test reports a missing attachment and a failed load`, async () => {
  const w = await openExplorer(browser, server.url, { linked: `Buildings` });
  await w.page.evaluate(() => { window.__linkedName = `Buildings`; });
  await w.selectRow(2);
  await finished(w.page);
  await w.page.click(`#attachmentTest`);
  await w.page.waitForFunction(() => /no attachment/.test(document.getElementById(`testResults`).textContent));
  await w.selectRow(1);
  await w.page.evaluate(() => { window.__onRecord({ id: 1, Photo: [`L`, 12] }, {}); });
  await w.page.click(`#attachmentTest`);
  await w.page.waitForFunction(() => /could not load/.test(document.getElementById(`testResults`).textContent));
});

test(`the write test asks for a confirmation, writes with two methods and restores the value`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  assert.equal(await w.page.isVisible(`#writeConfirmBox`), false);
  await w.page.selectOption(`#writeColumn`, `Address`);
  await w.page.click(`#writePrepare`);
  assert.equal(await w.page.isVisible(`#writeConfirmBox`), true);
  assert.deepEqual(await w.page.evaluate(() => window.__writes), []);
  await w.page.click(`#writeConfirm`);
  await w.page.waitForFunction(() => /restore of the original value/.test(document.getElementById(`testResults`).textContent));
  const report = await reportOf(w.page);
  assert.match(report, /write with applyUserActions: OK/);
  assert.match(report, /write with getTable\(\)\.update: OK/);
  assert.match(report, /restore of the original value: OK/);
  const writes = await w.page.evaluate(() => window.__writes.map((fields) => fields.Address));
  assert.deepEqual(writes, [`__export_tdb_test__`, `1 Example street`, `__export_tdb_test__`, `1 Example street`]);
});

test(`the write test can be cancelled and writes nothing`, async () => {
  const w = await openExplorer(browser, server.url);
  await w.selectRow(1);
  await finished(w.page);
  await w.page.click(`#writePrepare`);
  await w.page.click(`#writeCancel`);
  assert.equal(await w.page.isVisible(`#writeConfirmBox`), false);
  assert.deepEqual(await w.page.evaluate(() => window.__writes), []);
});

test(`a failed restore shows the original value to put back by hand`, async () => {
  const w = await openExplorer(browser, server.url, { failOnWrite: 2 });
  await w.selectRow(1);
  await finished(w.page);
  await w.page.selectOption(`#writeColumn`, `Address`);
  await w.page.click(`#writePrepare`);
  await w.page.click(`#writeConfirm`);
  await w.page.waitForFunction(() => !document.getElementById(`writeProblem`).hidden);
  assert.match(await text(w.page, `#writeProblem`), /"1 Example street"/);
  assert.match(await reportOf(w.page), /restore after applyUserActions: FAILED/);
});

test(`without full access the explorer says what to do`, async () => {
  const w = await openExplorer(browser, server.url, { denyAccess: true });
  await w.selectRow(1).catch(() => {});
  await w.page.evaluate(() => window.__onRecord({ id: 1 }, {}));
  await w.page.waitForFunction(() => !document.getElementById(`error`).hidden);
  assert.match(await text(w.page, `#error`), /Access denied/);
  assert.match(await text(w.page, `#error`), /Full document access/);
  assert.match(await reportOf(w.page), /metadata tables read: FAILED/);
});

test(`narrow panel in dark mode: nothing overflows`, async () => {
  const w = await openExplorer(browser, server.url, { viewport: { width: 340, height: 700 }, colorScheme: `dark` });
  await w.selectRow(1);
  await finished(w.page);
  const overflow = await w.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
});

test(`the page has a strict content policy and no inline script`, async () => {
  const w = await openExplorer(browser, server.url);
  const policy = await w.page.$eval(`meta[http-equiv="Content-Security-Policy"]`, (m) => m.content);
  assert.match(policy, /script-src 'self' https:\/\/grist\.numerique\.gouv\.fr/);
  assert.match(policy, /connect-src 'none'/);
  assert.equal(await w.page.$$eval(`script:not([src])`, (s) => s.length), 0);
});
