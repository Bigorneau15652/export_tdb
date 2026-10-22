// Tests of the description of the shape of a value.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { describeValue, describeColumn } = require(`../shape.js`);

test(`simple values are described without their content by default`, () => {
  assert.equal(describeValue(null, false), `null`);
  assert.equal(describeValue(undefined, false), `undefined`);
  assert.equal(describeValue(true, false), `boolean`);
  assert.equal(describeValue(42, false), `integer`);
  assert.equal(describeValue(4.5, false), `decimal`);
  assert.equal(describeValue(`secret text`, false), `text(11)`);
});

test(`the content is shown only when asked`, () => {
  assert.equal(describeValue(42, true), `integer 42`);
  assert.equal(describeValue(`abc`, true), `text "abc"`);
  assert.equal(describeValue(false, true), `boolean false`);
  assert.equal(describeValue(`x`.repeat(100), true).length < 60, true);
});

test(`a list keeps its marker and hides the items`, () => {
  assert.equal(describeValue([`L`, 11, 12], false), `["L", integer, integer]`);
  assert.equal(describeValue([`L`], false), `["L"]`);
  assert.equal(describeValue([`d`, 1700000000], false), `["d", integer]`);
  assert.equal(describeValue([`L`, `private name`], false), `["L", text(12)]`);
});

test(`a long list is cut`, () => {
  assert.match(describeValue([`L`, 1, 2, 3, 4, 5, 6, 7, 8], false), /\.\.\.\+3\]$/);
});

test(`an object shows its keys only`, () => {
  assert.equal(describeValue({ error: `x`, other: 1 }, false), `{error, other}`);
});

test(`describeColumn takes the first filled value and counts the empty ones`, () => {
  assert.deepEqual(describeColumn([null, 0, `L`, [`L`], [`L`, 3], [`L`, 4]], false).filled, 3);
  const column = describeColumn([null, [`L`], [`L`, 3, 4], ``], false);
  assert.equal(column.shape, `["L", integer, integer]`);
  assert.equal(column.filled, 1);
  assert.equal(column.empty, 3);
});

test(`describeColumn handles an empty column and a column with no filled value`, () => {
  assert.deepEqual(describeColumn([], false), { shape: `no rows`, filled: 0, empty: 0 });
  assert.equal(describeColumn([null, null], false).shape, `null`);
  assert.deepEqual(describeColumn(undefined, false), { shape: `no rows`, filled: 0, empty: 0 });
});
