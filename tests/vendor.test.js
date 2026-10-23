const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const fs = require(`node:fs`);
const path = require(`node:path`);
const crypto = require(`node:crypto`);

const folder = path.join(__dirname, `..`, `vendor`, `echarts`);
const bundle = fs.readFileSync(path.join(folder, `echarts.custom.min.js`), `utf8`);

test(`the custom build of ECharts is a plain script that runs no text as code and uses no network`, () => {
  for (const forbidden of [`eval(`, `new Function`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `importScripts`, `sendBeacon`]) {
    assert.ok(!bundle.includes(forbidden), `the build contains ${forbidden}`);
  }
  assert.ok(bundle.includes(`exportTdbEcharts`));
  assert.match(bundle.split(`\n`)[0], /Apache ECharts 6\.1\.0/);
});

test(`the licences and the record of the custom build are in its folder, with the right checksum`, () => {
  for (const name of [`LICENSE`, `NOTICE`, `LICENSE-zrender`, `LICENSE-tslib`, `VENDOR.md`, `entry.js`]) {
    assert.ok(fs.existsSync(path.join(folder, name)), name);
  }
  assert.match(fs.readFileSync(path.join(folder, `LICENSE`), `utf8`), /Apache License/);
  const record = fs.readFileSync(path.join(folder, `VENDOR.md`), `utf8`);
  const sum = crypto.createHash(`sha256`).update(fs.readFileSync(path.join(folder, `echarts.custom.min.js`))).digest(`hex`);
  assert.ok(record.includes(sum), `the SHA-256 of VENDOR.md is not the one of the file`);
});

test(`the page loads the build from its own folder and from nowhere else`, () => {
  const page = fs.readFileSync(path.join(__dirname, `..`, `index.html`), `utf8`);
  assert.match(page, /src="vendor\/echarts\/echarts\.custom\.min\.js\?v=/);
  assert.ok(!/<script[^>]+src="https?:\/\/(?!grist\.numerique\.gouv\.fr)/.test(page));
});
