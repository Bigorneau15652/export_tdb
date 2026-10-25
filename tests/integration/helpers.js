// Shared tools of the integration tests: a small web server for the widget files, the launch of
// the browser (Playwright, Chromium) and a fake Grist object built from the invented document.
const http = require(`node:http`);
const fs = require(`node:fs`);
const path = require(`node:path`);
const { chromium } = require(`playwright`);
const demo = require(`../fixtures/demo-data.js`);

const ROOT = path.resolve(__dirname, `..`, `..`);
const TYPES = new Map([[`.html`, `text/html`], [`.js`, `text/javascript`], [`.css`, `text/css`]]);
const GRIST_HOST = `https://grist.numerique.gouv.fr`;

// Serves the files of the repository on a free port. Resolves to { url, close }.
function startServer() {
  const server = http.createServer((request, response) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(request.url, `http://x`).pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { [`content-type`]: TYPES.get(path.extname(file)) || `application/octet-stream` });
    response.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, `127.0.0.1`, () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

// Launches Chromium. CHROMIUM_PATH points to an existing browser; without it Playwright uses its own.
function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
}

// A 1x1 transparent GIF, returned for the picture of an attachment.
const PIXEL = Buffer.from(`R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`, `base64`);

// The fake `grist` object, written as the text of a script. `options` can change the linked table,
// make a call fail or make the restoring of a value fail.
function fakeGristScript(options) {
  return `
const metadata = ${JSON.stringify(demo.metadata)};
const data = ${JSON.stringify(demo.data)};
const options = ${JSON.stringify(options)};
const tables = Object.assign({}, data, metadata);
window.__writes = [];
window.__linkedName = options.linked || \`Sites\`;
let writeCount = 0;
function apply(tableId, rowId, fields) {
  writeCount += 1;
  if (options.failAllWrites) throw new Error(\`write refused\`);
  if (options.failOnWrite && writeCount === options.failOnWrite) throw new Error(\`write refused\`);
  const table = tables[tableId];
  const index = table.id.indexOf(rowId);
  for (const key of Object.keys(fields)) table[key][index] = fields[key];
  window.__writes.push(fields);
}
window.grist = {
  ready(settings) { window.__ready = settings; },
  onRecord(callback, recordOptions) { window.__onRecord = callback; window.__recordOptions = recordOptions; },
  onOptions(callback) {
    window.__onOptions = callback;
    setTimeout(() => callback(options.savedOptions || null, {}), 0);
  },
  setOption: async (key, value) => {
    if (options.failOnSave) throw new Error(\`save refused\`);
    window.__saved = window.__saved || [];
    window.__saved.push({ [key]: JSON.parse(JSON.stringify(value)) });
    window.__options = { [key]: value };
    setTimeout(() => window.__onOptions && window.__onOptions(window.__options, {}), 0);
  },
  selectedTable: { getTableId: async () => options.linked || \`Sites\` },
  docApi: {
    fetchTable: async (name) => {
      if (options.denyAccess) throw new Error(\`Access denied\`);
      if (!tables[name]) throw new Error(\`No such table \` + name);
      return JSON.parse(JSON.stringify(tables[name]));
    },
    applyUserActions: async (actions) => { for (const a of actions) apply(a[1], a[2], a[3]); },
    getAccessToken: async () => ({ baseUrl: \`${GRIST_HOST}/api/docs/D\`, token: \`SECRET-TOKEN\`, ttlMsecs: 60000 })
  },
  getTable: (id) => ({ update: async (change) => apply(id, change.id, change.fields) })
};`;
}

// Opens the explorer page in a new page. Returns { page, errors, selectRow(id) }.
async function openExplorer(browser, baseUrl, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 700, height: 800 }, colorScheme: options.colorScheme || `light` });
  const page = await context.newPage();
  const errors = [];
  page.on(`pageerror`, (error) => errors.push(String(error)));
  page.on(`console`, (message) => {
    if ([`error`, `warning`].includes(message.type()) && !message.text().includes(`Failed to load resource`)) errors.push(message.text());
  });
  await page.route(`**/grist-plugin-api.js`, (route) => route.fulfill({ body: fakeGristScript(options), contentType: `text/javascript` }));
  await context.route(`${GRIST_HOST}/api/**`, (route) => {
    if (route.request().url().includes(`/attachments/12/`)) return route.fulfill({ status: 404, body: `missing` });
    return route.fulfill({ body: PIXEL, contentType: `image/gif` });
  });
  await context.route(`https://cloud.example.org/**`, (route) => route.fulfill({ body: PIXEL, contentType: `image/gif` }));
  await page.goto(`${baseUrl}/index.html`);
  await page.waitForFunction(() => typeof window.__onRecord === `function`);
  // Gives the explorer the row `id` of the linked table, as Grist does when the selection changes.
  // With `bare` true the record holds only the row number, as when Grist sends no column.
  const selectRow = (id, bare = false) => page.evaluate(([rowId, onlyId]) => {
    const name = window.__linkedName;
    return window.grist.docApi.fetchTable(name).then((table) => {
      const index = table.id.indexOf(rowId);
      const record = { id: rowId };
      if (!onlyId) for (const key of Object.keys(table)) if (key !== `id`) record[key] = table[key][index];
      window.__onRecord(record, {});
    });
  }, [id, bare]);
  return { page, context, errors, selectRow };
}

module.exports = { startServer, launch, openExplorer, GRIST_HOST };
