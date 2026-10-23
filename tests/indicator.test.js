const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const I = require(`../indicator.js`);
const M = require(`../model.js`);

const config = (changes) => M.cleanConfig(`indicator`, changes);

test(`the first rule that the number meets gives the colour, otherwise the default colour`, () => {
  const c = config({ base: `grey`, rules: [{ op: `ge`, limit: 80, color: `green` }, { op: `ge`, limit: 50, color: `orange` }, { op: `le`, limit: 10, color: `red` }] });
  assert.equal(I.pickColor(c, 95), `green`);
  assert.equal(I.pickColor(c, 80), `green`);
  assert.equal(I.pickColor(c, 60), `orange`);
  assert.equal(I.pickColor(c, 30), `grey`);
  assert.equal(I.pickColor(c, 10), `red`);
  assert.equal(I.pickColor(c, -5), `red`);
});

test(`a missing number or a rule without limit gives the default colour`, () => {
  const c = config({ base: `blue`, rules: [{ op: `ge`, color: `red` }] });
  assert.equal(I.pickColor(c, 3), `blue`);
  assert.equal(I.pickColor(c, null), `blue`);
  assert.equal(I.pickColor(c, NaN), `blue`);
  assert.equal(I.pickColor(config({}), 1), `none`);
});

test(`every colour is a known name and the symbols tell the state without colour`, () => {
  assert.deepEqual(I.COLORS, M.INDICATOR_COLORS);
  assert.equal(I.SYMBOLS.green.length, 1);
  assert.notEqual(I.SYMBOLS.green, I.SYMBOLS.red);
  assert.equal(I.SYMBOLS.none, ``);
  for (const color of I.COLORS) assert.ok(color in I.SYMBOLS);
});
