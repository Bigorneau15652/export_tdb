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

const helpers = { palette: `classic`, fontSize: 11, format: (value, decimals) => String(decimals === undefined || decimals < 0 ? value : value.toFixed(decimals)), decimals: -1 };
const config = (changes) => ({ chart: `bar`, legend: `bottom`, labels: `none`, ...changes });
const data = { categories: [`A`, `B`], series: [{ name: `S1`, values: [1, 2] }, { name: `S2`, values: [3, null] }] };

test(`there are nine palettes of twenty different colours, each one made as announced`, () => {
  assert.deepEqual(C.PALETTE_KEYS, [`classic`, `acid`, `pastel`, `warm`, `cool`, `red`, `green`, `blue`, `grey`]);
  for (const key of C.PALETTE_KEYS) {
    const colors = C.PALETTES[key];
    assert.equal(colors.length, 20, key);
    assert.ok(colors.every((color) => /^#[0-9a-f]{6}$/.test(color)), key);
    assert.equal(new Set(colors).size, 20, key);
  }
  // The classic palette starts with the ten colours of the earlier default palette, kept at 3 to 1 against white.
  for (const color of C.PALETTES.classic.slice(0, 10)) assert.ok(contrastWithWhite(color) >= 3, color);
  // The colours that follow each other in the palettes of several hues are told apart (so are those of the first ten of the classic).
  for (const key of [`classic`, `acid`, `pastel`, `warm`, `cool`]) {
    const colors = C.PALETTES[key];
    for (let at = 1; at < 10; at += 1) assert.ok(distance(colors[at - 1], colors[at]) >= 12, `${key} ${colors[at - 1]} ${colors[at]}`);
  }
  // The ramps go from dark to light in even steps.
  for (const key of C.RAMPS) {
    const colors = C.PALETTES[key];
    for (let at = 1; at < 20; at += 1) assert.ok(luminance(colors[at]) > luminance(colors[at - 1]), `${key} ${at}`);
  }
  // Acid colours are very saturated, pastels are light.
  for (const color of C.PALETTES.pastel) assert.ok(luminance(color) > 0.4, color);
});

test(`the colours of a few series come in order from a palette of several hues and are spread over a ramp`, () => {
  assert.deepEqual(C.colorsFor(`classic`, 3).slice(0, 3), C.PALETTES.classic.slice(0, 3));
  assert.equal(C.colorsFor(`acid`, 25).length, 20);
  const ramp = C.colorsFor(`blue`, 3);
  assert.equal(ramp.length, 3);
  assert.ok(luminance(ramp[0]) < luminance(ramp[1]) && luminance(ramp[1]) < luminance(ramp[2]));
  assert.ok(distance(ramp[0], ramp[1]) > 20 && distance(ramp[1], ramp[2]) > 20);
  assert.equal(C.colorsFor(`grey`, 1).length, 1);
  assert.deepEqual(C.colorsFor(`unknown`, 2), C.PALETTES.classic);
  assert.equal(C.readableOn(`#ffffff`), `#1f2933`);
  assert.equal(C.readableOn(`#10294c`), `#ffffff`);
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
  assert.deepEqual(bar.color, C.PALETTES.classic);
  const stack = C.buildOption(config({ chart: `stack` }), data, { ...helpers, palette: `cool` });
  assert.deepEqual(stack.series.map((s) => s.stack), [`total`, `total`]);
  assert.deepEqual(stack.color, C.PALETTES.cool);
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
  assert.equal(typeof pie.series[0].radius, `number`);
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
  const option = C.buildOption(config({}), data, { ...helpers, palette: `unknown` });
  assert.deepEqual(option.color, C.PALETTES.classic);
  const text = JSON.stringify(option);
  assert.ok(!/<|javascript:/i.test(text));
});

test(`a long legend breaks its names and keeps the drawing clear of it`, () => {
  const long = { categories: [`A very long name of a category that goes on and on and on`, `Another quite long name of a category`, `Short`, `Fourth one`], series: [{ name: `S`, values: [1, 2, 3, 4] }] };
  const sized = { ...helpers, width: 400, height: 300 };
  const right = C.buildOption(config({ chart: `donut`, legend: `right` }), long, sized);
  assert.ok(right.legend.formatter(long.categories[0]).includes(`\n`));
  const pie = right.series[0];
  assert.ok(pie.center[0] + pie.radius[1] <= 400 - 40);
  const bottom = C.buildOption(config({ chart: `donut`, legend: `bottom` }), long, sized);
  assert.ok(bottom.series[0].center[1] + bottom.series[0].radius[1] < 300 - 30);
  const several = { categories: [`X`, `Y`], series: long.categories.map((name) => ({ name, values: [1, 2] })) };
  const bars = C.buildOption(config({ chart: `bar`, legend: `top` }), several, sized);
  assert.ok(bars.grid.top > 40);
  assert.equal(bars.legend.type, `plain`);
});

test(`an area chart stacks smooth layers without symbols`, () => {
  const option = C.buildOption(config({ chart: `area` }), data, helpers);
  assert.equal(option.series.length, 2);
  assert.equal(option.series[0].type, `line`);
  assert.equal(option.series[0].stack, `total`);
  assert.ok(option.series[0].areaStyle.opacity > 0.5);
  assert.equal(option.series[0].symbol, `none`);
  assert.equal(option.xAxis.boundaryGap, false);
  assert.equal(option.series[0].label.show, false);
});

test(`a treemap has one rectangle per item with a palette colour and no legend`, () => {
  const option = C.buildOption(config({ chart: `treemap`, labels: `percent` }), { categories: [`A`, `B`, `C`], series: [{ name: `S`, values: [1, 3, 0] }] }, { ...helpers, palette: `cool` });
  const one = option.series[0];
  assert.equal(one.type, `treemap`);
  assert.deepEqual(one.data.map((item) => item.name), [`A`, `B`]);
  assert.equal(one.data[1].itemStyle.color, C.PALETTES.cool[1]);
  assert.equal(one.data[1].label.color, C.readableOn(C.PALETTES.cool[1]));
  assert.equal(option.legend.show, false);
  assert.equal(one.label.formatter({ name: `B`, value: 3 }), `B\n75.0 %`);
  assert.equal(C.buildOption(config({ chart: `treemap`, labels: `values` }), data, helpers).series[0].label.formatter({ name: `A`, value: 1 }), `A\n1`);
  assert.equal(C.buildOption(config({ chart: `treemap` }), { categories: [`A`], series: [{ name: `S`, values: [0] }] }, helpers), null);
});

test(`a scatter chart has numeric axes with names, one series per colour and a legend only when there are several`, () => {
  const scatter = { xName: `Area`, yName: `Seats`, series: [{ name: `North`, points: [[1, 2], [3, 4]] }, { name: `South`, points: [[5, 6]] }] };
  const option = C.buildOption(config({ chart: `scatter` }), scatter, helpers);
  assert.equal(option.series.length, 2);
  assert.equal(option.series[0].type, `scatter`);
  assert.deepEqual(option.series[0].data, [[1, 2], [3, 4]]);
  assert.equal(option.xAxis.name, `Area`);
  assert.equal(option.yAxis.name, `Seats`);
  assert.equal(option.legend.show, true);
  const single = C.buildOption(config({ chart: `scatter` }), { ...scatter, series: [scatter.series[0]] }, helpers);
  assert.equal(single.legend.show, false);
  assert.equal(C.buildOption(config({ chart: `scatter` }), { ...scatter, series: [{ name: ``, points: [] }] }, helpers), null);
  assert.equal(C.buildOption(config({ chart: `scatter` }), null, helpers), null);
});
