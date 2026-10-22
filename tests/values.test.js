// Tests of the reading of the raw values given by Grist.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { listItems, isList, isUnusable, isEmpty, toNumber, toSeconds, toText, kindOf } = require(`../values.js`);

test(`a list loses its code, a plain value is not a list`, () => {
  assert.deepEqual(listItems([`L`, 3, 4]), [3, 4]);
  assert.deepEqual(listItems([`L`]), []);
  assert.deepEqual(listItems([5, 6]), [5, 6]);
  assert.deepEqual(listItems(null), []);
  assert.deepEqual(listItems(`text`), []);
  assert.equal(isList([`L`, 1]), true);
  assert.equal(isList(3), false);
});

test(`errors, pending and censored values are unusable`, () => {
  assert.equal(isUnusable([`E`, `ZeroDivisionError`]), true);
  assert.equal(isUnusable([`P`]), true);
  assert.equal(isUnusable([`C`]), true);
  assert.equal(isUnusable([`L`, 1]), false);
  assert.equal(isUnusable(4), false);
});

test(`empty values depend on the type of the column`, () => {
  assert.equal(isEmpty(null, `Text`), true);
  assert.equal(isEmpty(undefined, `Numeric`), true);
  assert.equal(isEmpty(``, `Text`), true);
  assert.equal(isEmpty(``, `Any`), false);
  assert.equal(isEmpty(0, `Ref:Sites`), true);
  assert.equal(isEmpty(0, `Numeric`), false);
  assert.equal(isEmpty(false, `Bool`), false);
  assert.equal(isEmpty([`L`], `RefList:Contacts`), true);
  assert.equal(isEmpty([`L`, 2], `RefList:Contacts`), false);
  assert.equal(isEmpty([], `ChoiceList`), true);
});

test(`numbers and dates are read as numbers`, () => {
  assert.equal(toNumber(4.5), 4.5);
  assert.equal(toNumber(0), 0);
  assert.equal(toNumber(`4`), null);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber(Infinity), null);
  assert.equal(toNumber([`d`, 1700000000]), 1700000000);
  assert.equal(toNumber([`D`, 1700000000, `UTC`]), 1700000000);
  assert.equal(toSeconds(1736294400), 1736294400);
  assert.equal(toSeconds([`L`, 1]), null);
});

test(`texts are built from every kind of value`, () => {
  assert.equal(toText(null), ``);
  assert.equal(toText(`abc`), `abc`);
  assert.equal(toText(12), `12`);
  assert.equal(toText(true), `true`);
  assert.equal(toText([`L`, `a`, `b`]), `a, b`);
  assert.equal(toText([`R`, `Sites`, 3]), `3`);
  assert.equal(toText([`R`, `Sites`, 3], (id) => `site ${id}`), `site 3`);
  assert.equal(toText([`E`, `x`]), ``);
  assert.equal(toText({ a: 1 }), ``);
});

test(`kindOf names the kind of a value`, () => {
  assert.equal(kindOf(null), `empty`);
  assert.equal(kindOf(1), `number`);
  assert.equal(kindOf(`a`), `text`);
  assert.equal(kindOf(false), `boolean`);
  assert.equal(kindOf([`L`, 1]), `list`);
  assert.equal(kindOf([`d`, 1]), `date`);
  assert.equal(kindOf([`R`, `T`, 1]), `reference`);
  assert.equal(kindOf([`E`]), `unusable`);
  assert.equal(kindOf([`O`, {}]), `object`);
  assert.equal(kindOf({}), `object`);
});
