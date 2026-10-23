const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const C = require(`../chart-option.js`);

const lin = (c) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrastWithWhite = (hex) => 1.05 / (luminance(hex) + 0.05);
const lab = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  const xyz = [0.4124 * r + 0.3576 * g + 0.1805 * b, 0.2126 * r + 0.7152 * g + 0.0722 * b, 0.0193 * r + 0.1192 * g + 0.9505 * b];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(xyz[0] / 0.95047), f(xyz[1]), f(xyz[2] / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const distance = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

const helpers = { fontSize: 11, format: (value, decimals) => String(decimals === undefined || decimals < 0 ? value : value.toFixed(decimals)), decimals: -1 };
const config = (changes) => ({ chart: `bar`, palette: `franche`, legend: `bottom`, labels: `none`, ...changes });
const data = { categories: [`A`, `B`], series: [{ name: `S1`, values: [1, 2] }, { name: `S2`, values: [3, null] }] };

test(`each palette has ten colours that keep a 3 to 1 contrast against white and are told apart`, () => {
  assert.deepEqual(C.PALETTE_KEYS, [`franche`, `douce`, `contrastee`, `froide`]);
  for (const key of C.PALETTE_KEYS) {
    const colors = C.PALETTES[key];
    assert.equal(colors.length, 10, key);
    assert.ok(colors.every((color) => /^#[0-9a-f]{6}$/.test(color)), key);
    assert.equal(new Set(colors).size, 10, key);
    for (const color of colors) assert.ok(contrastWithWhite(color) >= 3, `${key} ${color} contrast ${contrastWithWhite(color)}`);
    for (let a = 0; a < 10; a += 1) {
      for (let b = a + 1; b < 10; b += 1) assert.ok(distance(colors[a], colors[b]) >= 15, `${key} ${colors[a]} ${colors[b]} ${distance(colors[a], colors[b])}`);
    }
  }
});

test(`nothing to draw gives no option`, () => {
  assert.equal(C.buildOption(config({}), null, helpers), null);
  assert.equal(C.buildOption(config({}), { categories: [], series: [] }, helpers), null);
  assert.equal(C.buildOption(config({}), { categories: [`A`], series: [] }, helpers), null);
});

test(`bar and line charts have a category axis, a value axis and one series per column`, () => {
  const bar = C.buildOption(config({}), data, helpers);
  assert.equal(bar.xAxis.type, `category`);
  assert.equal(bar.yAxis.type, `value`);
  assert.deepEqual(bar.series.map((s) => [s.type, s.name, s.stack]), [[`bar`, `S1`, undefined], [`bar`, `S2`, undefined]]);
  assert.deepEqual(bar.series[1].data, [3, null]);
  assert.equal(bar.animation, false);
  assert.deepEqual(bar.color, C.PALETTES.franche);
  const stack = C.buildOption(config({ chart: `stack`, palette: `froide` }), data, helpers);
  assert.deepEqual(stack.series.map((s) => s.stack), [`total`, `total`]);
  assert.deepEqual(stack.color, C.PALETTES.froide);
  const horizontal = C.buildOption(config({ chart: `barhStack` }), data, helpers);
  assert.equal(horizontal.yAxis.type, `category`);
  assert.equal(horizontal.yAxis.inverse, true);
  assert.equal(horizontal.series[0].stack, `total`);
  const line = C.buildOption(config({ chart: `line` }), data, helpers);
  assert.deepEqual(line.series.map((s) => s.type), [`line`, `line`]);
});

test(`a pie or a donut uses the first series, with a hole for the donut`, () => {
  const pie = C.buildOption(config({ chart: `pie`, labels: `percent` }), data, helpers);
  assert.equal(pie.series.length, 1);
  assert.deepEqual(pie.series[0].data, [{ name: `A`, value: 1 }, { name: `B`, value: 2 }]);
  assert.equal(pie.series[0].radius, `68%`);
  assert.equal(pie.series[0].label.formatter({ name: `A`, percent: 33.3333, value: 1 }), `A\n33.3 %`);
  const donut = C.buildOption(config({ chart: `donut` }), data, helpers);
  assert.equal(Array.isArray(donut.series[0].radius), true);
  assert.equal(donut.series[0].label.show, false);
  const missing = C.buildOption(config({ chart: `pie` }), { categories: [`A`], series: [{ name: `S`, values: [null] }] }, helpers);
  assert.equal(missing.series[0].data[0].value, 0);
});

test(`the legend and the labels follow the settings`, () => {
  assert.equal(C.buildOption(config({ legend: `none` }), data, helpers).legend.show, false);
  const right = C.buildOption(config({ legend: `right` }), data, helpers);
  assert.equal(right.legend.orient, `vertical`);
  const top = C.buildOption(config({ legend: `top` }), data, helpers);
  assert.equal(top.legend.top, 0);
  assert.ok(top.grid.top > C.buildOption(config({ legend: `bottom` }), data, helpers).grid.top);
  const labelled = C.buildOption(config({ labels: `values` }), data, helpers);
  assert.equal(labelled.series[0].label.show, true);
  assert.equal(labelled.series[0].label.formatter({ value: 7 }), `7`);
  assert.equal(C.buildOption(config({ labels: `percent` }), data, helpers).series[0].label.show, true);
  assert.equal(C.buildOption(config({}), data, helpers).series[0].label.show, false);
});

test(`the option is plain data: no script and no unknown palette`, () => {
  const option = C.buildOption(config({ palette: `unknown` }), data, helpers);
  assert.deepEqual(option.color, C.PALETTES.franche);
  const text = JSON.stringify(option);
  assert.ok(!/<|javascript:/i.test(text));
});
