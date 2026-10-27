// Tests of the calculation of named values: examples, errors, and random expressions compared with
// a direct calculation.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { parseExpression, evaluate } = require(`../expr.js`);

const calc = (text, values = {}) => {
  const parsed = parseExpression(text);
  assert.ok(!parsed.error, parsed.error);
  return evaluate(parsed.ast, (name) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name] : null));
};

test(`the four operations follow the usual priority`, () => {
  assert.equal(calc(`1 + 2 * 3`), 7);
  assert.equal(calc(`(1 + 2) * 3`), 9);
  assert.equal(calc(`10 - 4 - 3`), 3);
  assert.equal(calc(`100 / 5 / 2`), 10);
  assert.equal(calc(`2 * 3 + 4 * 5`), 26);
});

test(`the minus sign applies to a number, a name or a group`, () => {
  assert.equal(calc(`-3 + 5`), 2);
  assert.equal(calc(`-{a}`, { a: 4 }), -4);
  assert.equal(calc(`-(1 + 2)`), -3);
  assert.equal(calc(`5 - -2`), 7);
  assert.equal(calc(`--3`), 3);
});

test(`numbers can be written with a point or a comma`, () => {
  assert.equal(calc(`2,5 * 2`), 5);
  assert.equal(calc(`2.5 * 2`), 5);
  assert.equal(calc(`.5 + 0,5`), 1);
});

test(`names are read between braces and may hold spaces and accents`, () => {
  assert.equal(calc(`{Floor area} / {Seats}`, { [`Floor area`]: 2188, Seats: 100 }), 21.88);
  assert.equal(calc(`{Été} + 1`, { Été: 2 }), 3);
  assert.deepEqual(parseExpression(`{a} + {b} * {a}`).names.sort(), [`a`, `b`]);
});

test(`a missing value or a division by zero gives null, never 0`, () => {
  assert.equal(calc(`{a} + 1`, {}), null);
  assert.equal(calc(`{a} + 1`, { a: null }), null);
  assert.equal(calc(`1 / 0`), null);
  assert.equal(calc(`1 / ({a} - {a})`, { a: 3 }), null);
  assert.equal(calc(`{a} * 0`, { a: null }), null);
  assert.equal(calc(`{a}`, { a: NaN }), null);
  assert.equal(calc(`{a}`, { a: `text` }), null);
});

test(`a wrong expression is refused with a message`, () => {
  for (const bad of [``, `   `, `1 +`, `(1 + 2`, `1 + 2)`, `1 2`, `{a`, `{}`, `*3`, `3 $ 4`, `1 + + 2 )`, `()`]) {
    assert.ok(parseExpression(bad).error, `expected an error for "${bad}"`);
  }
  assert.ok(parseExpression(undefined).error);
  assert.ok(parseExpression(null).error);
});

test(`text is never run as code`, () => {
  for (const attack of [`alert(1)`, `1; process.exit()`, `constructor`, `{a}.constructor`, `__proto__`, `\`x\``, `1 + require(x)`]) {
    assert.ok(parseExpression(attack).error, attack);
  }
  assert.equal(calc(`{constructor}`, {}), null);
  assert.equal(calc(`{__proto__}`, {}), null);
});

test(`a very long or very deep expression is refused`, () => {
  assert.ok(parseExpression(`1+`.repeat(300) + `1`).error);
  assert.ok(parseExpression(`(`.repeat(100) + `1` + `)`.repeat(100)).error);
  assert.ok(!parseExpression(`(`.repeat(20) + `1` + `)`.repeat(20)).error);
});

// A small random generator, so that the test is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// A random tree: a number, a name or an operation on two smaller trees.
function build(next, depth) {
  if (depth === 0 || next() < 0.25) {
    return next() < 0.5 ? { text: String(Math.floor(next() * 9) + 1), kind: `n` } : { text: `{x${Math.floor(next() * 3)}}`, kind: `v` };
  }
  return { op: `+-*/`[Math.floor(next() * 4)], left: build(next, depth - 1), right: build(next, depth - 1), kind: `op` };
}

// The text of a tree, with the parentheses that the priorities require.
function render(node, parentOp, isRight) {
  if (node.kind !== `op`) return node.text;
  const text = `${render(node.left, node.op, false)} ${node.op} ${render(node.right, node.op, true)}`;
  const weak = `+-`.includes(node.op);
  const insideProduct = parentOp === `*` || parentOp === `/`;
  const needs = (insideProduct && weak) || (parentOp === `-` && isRight && weak) || (parentOp === `/` && isRight && !weak);
  return needs ? `(${text})` : text;
}

// The value of a tree computed directly, without the parser.
function direct(node, values) {
  if (node.kind === `n`) return Number(node.text);
  if (node.kind === `v`) return values[node.text.slice(1, -1)];
  const a = direct(node.left, values);
  const b = direct(node.right, values);
  if (a === null || b === null) return null;
  if (node.op === `+`) return a + b;
  if (node.op === `-`) return a - b;
  if (node.op === `*`) return a * b;
  return b === 0 ? null : a / b;
}

test(`random expressions give the same result as a direct calculation`, () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const next = random(seed);
    const tree = build(next, 4);
    const text = render(tree, null, false);
    const values = { x0: Math.floor(next() * 20) - 5, x1: Math.floor(next() * 20), x2: next() < 0.3 ? null : 2.5 };
    const parsed = parseExpression(text);
    assert.ok(!parsed.error, `${text}: ${parsed.error}`);
    const got = evaluate(parsed.ast, (name) => values[name]);
    const expected = direct(tree, values);
    if (expected === null || !Number.isFinite(expected)) assert.equal(got, null, text);
    else assert.ok(Math.abs(got - expected) < 1e-9 * Math.max(1, Math.abs(expected)), `${text}: ${got} instead of ${expected}`);
  }
});

test(`a number too big to be written as a finite number is refused`, () => {
  assert.deepEqual(parseExpression(`9`.repeat(400)), { error: `a number is too big` });
  assert.deepEqual(parseExpression(`1 + ${`9`.repeat(400)}`), { error: `a number is too big` });
  assert.ok(!parseExpression(`123456789012345678`).error);
});
