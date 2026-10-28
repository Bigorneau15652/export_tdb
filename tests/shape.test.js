// Tests of the description of the shape of a value.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { describeValue, describeColumn } = require(`../shape.js`);

test(`simple values are described without their content by default`, () => {
  assert.equal(describeValue(null), `null`);
  assert.equal(describeValue(undefined), `undefined`);
  assert.equal(describeValue(true), `boolean`);
  assert.equal(describeValue(42), `integer`);
  assert.equal(describeValue(4.5), `decimal`);
  assert.equal(describeValue(`secret text`), `text(11)`);
});

test(`a list keeps its marker and hides the items`, () => {
  assert.equal(describeValue([`L`, 11, 12]), `["L", integer, integer]`);
  assert.equal(describeValue([`L`]), `["L"]`);
  assert.equal(describeValue([`d`, 1700000000]), `["d", integer]`);
  assert.equal(describeValue([`L`, `private name`]), `["L", text(12)]`);
});

test(`a long list is cut`, () => {
  assert.match(describeValue([`L`, 1, 2, 3, 4, 5, 6, 7, 8]), /\.\.\.\+3\]$/);
});

test(`an object shows its keys only`, () => {
  assert.equal(describeValue({ error: `x`, other: 1 }), `{error, other}`);
});

test(`describeColumn takes the first filled value and counts the empty ones`, () => {
  assert.deepEqual(describeColumn([null, 0, `L`, [`L`], [`L`, 3], [`L`, 4]]).filled, 3);
  const column = describeColumn([null, [`L`], [`L`, 3, 4], ``]);
  assert.equal(column.shape, `["L", integer, integer]`);
  assert.equal(column.filled, 1);
  assert.equal(column.empty, 3);
});

test(`describeColumn handles an empty column and a column with no filled value`, () => {
  assert.deepEqual(describeColumn([]), { shape: `no rows`, filled: 0, empty: 0 });
  assert.equal(describeColumn([null, null]).shape, `null`);
  assert.deepEqual(describeColumn(undefined), { shape: `no rows`, filled: 0, empty: 0 });
});
