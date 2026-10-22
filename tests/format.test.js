// Tests of the French writing of numbers, percentages and dates.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { formatNumber, formatPercent, formatDate, DASH } = require(`../format.js`);

test(`numbers have a narrow space between thousands and a comma for decimals`, () => {
  assert.equal(formatNumber(2188), `2 188`);
  assert.equal(formatNumber(1701.95), `1 701,95`);
  assert.equal(formatNumber(1234567.891, 2), `1 234 567,89`);
  assert.equal(formatNumber(81.48), `81,48`);
  assert.equal(formatNumber(0), `0`);
  assert.equal(formatNumber(999), `999`);
  assert.equal(formatNumber(1000), `1 000`);
});

test(`the number of decimals can be imposed or left automatic`, () => {
  assert.equal(formatNumber(21.9, 1), `21,9`);
  assert.equal(formatNumber(21, 1), `21,0`);
  assert.equal(formatNumber(21.6, 0), `22`);
  assert.equal(formatNumber(319, 0), `319`);
  assert.equal(formatNumber(20.126), `20,13`);
  assert.equal(formatNumber(20.1), `20,1`);
  assert.equal(formatNumber(5.004), `5`);
});

test(`negative numbers keep their sign and a rounded zero has none`, () => {
  assert.equal(formatNumber(-1234.5), `-1 234,5`);
  assert.equal(formatNumber(-0.001, 2), `0,00`);
  assert.equal(formatNumber(-0.001), `0`);
});

test(`a value that is not a number gives a dash`, () => {
  for (const bad of [null, undefined, NaN, Infinity, `12`, {}]) assert.equal(formatNumber(bad), DASH);
  assert.equal(formatPercent(null), DASH);
  assert.equal(formatDate(null), DASH);
});

test(`a ratio becomes a percentage with a space before the sign`, () => {
  assert.equal(formatPercent(0.777), `77,7 %`);
  assert.equal(formatPercent(0.964), `96,4 %`);
  assert.equal(formatPercent(1), `100,0 %`);
  assert.equal(formatPercent(0.5, 0), `50 %`);
});

test(`a date in seconds is written day, month, year in UTC`, () => {
  assert.equal(formatDate(1736294400), `08/01/2025`);
  assert.equal(formatDate(0), `01/01/1970`);
  assert.equal(formatDate(1704067199), `31/12/2023`);
  assert.equal(formatDate(1e20), DASH);
});
