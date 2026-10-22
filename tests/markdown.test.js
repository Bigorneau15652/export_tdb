// Tests of the Markdown reader of the text blocks: what it understands, and that it never makes code.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const { parseMarkdown, parseInline, safeUrl } = require(`../markdown.js`);

// A flat text of the nodes, to compare simply.
const plain = (nodes) => nodes.map((node) => (node.type === `text` ? node.value : node.type === `break` ? `\n` : plain(node.children || []))).join(``);

test(`titles of level 1 to 3 are read and level 4 is plain text`, () => {
  const blocks = parseMarkdown(`# One\n## Two\n### Three\n#### Four`);
  assert.deepEqual(blocks.slice(0, 3).map((b) => [b.type, b.level, plain(b.children)]), [[`heading`, 1, `One`], [`heading`, 2, `Two`], [`heading`, 3, `Three`]]);
  assert.equal(blocks[3].type, `paragraph`);
  assert.equal(plain(blocks[3].children), `#### Four`);
});

test(`a blank line separates paragraphs and a single line break is kept`, () => {
  const blocks = parseMarkdown(`first line\nsecond line\n\nnext paragraph`);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].children.map((n) => n.type), [`text`, `break`, `text`]);
  assert.equal(plain(blocks[1].children), `next paragraph`);
});

test(`bulleted and numbered lists are read and a change of kind starts a new list`, () => {
  const blocks = parseMarkdown(`- a\n- b\n1. c\n2) d`);
  assert.deepEqual(blocks.map((b) => [b.type, b.ordered, b.items.length]), [[`list`, false, 2], [`list`, true, 2]]);
  assert.equal(plain(blocks[1].items[1]), `d`);
});

test(`bold and italic are read, also together`, () => {
  assert.deepEqual(parseInline(`a **b** c`, 0).map((n) => n.type), [`text`, `strong`, `text`]);
  assert.deepEqual(parseInline(`*i* and _j_`, 0).map((n) => n.type), [`em`, `text`, `em`]);
  const nested = parseInline(`**bold and *italic***`, 0);
  assert.equal(nested[0].type, `strong`);
  assert.equal(plain(nested), `bold and italic`);
});

test(`signs without a closing mark or next to spaces stay as they are`, () => {
  assert.equal(plain(parseInline(`2 * 3 * 4`, 0)), `2 * 3 * 4`);
  assert.equal(plain(parseInline(`**open`, 0)), `**open`);
  assert.equal(plain(parseInline(`snake_case_name`, 0)), `snake_case_name`);
  assert.equal(plain(parseInline(`{Surface_SUN_m2_}`, 0)), `{Surface_SUN_m2_}`);
});

test(`a backslash protects a sign`, () => {
  assert.equal(plain(parseInline(`\\*not italic\\*`, 0)), `*not italic*`);
  assert.equal(plain(parseInline(`\\{field\\}`, 0)), `{field}`);
});

test(`only https links without credentials are links`, () => {
  assert.equal(safeUrl(`https://example.org/a?b=c`), `https://example.org/a?b=c`);
  for (const bad of [`http://example.org`, `javascript:alert(1)`, `data:text/html,x`, `//example.org`, `https://user:pass@example.org`, `https://`, ``, `ftp://example.org`, `https://example.org/${`a`.repeat(2100)}`]) {
    assert.equal(safeUrl(bad), null, bad);
  }
  const link = parseInline(`see [the site](https://example.org/x) now`, 0)[1];
  assert.deepEqual([link.type, link.href, plain(link.children)], [`link`, `https://example.org/x`, `the site`]);
  assert.equal(parseInline(`[x](javascript:alert(1))`, 0).every((n) => n.type === `text`), true);
  assert.equal(plain(parseInline(`[x](http://example.org)`, 0)), `[x](http://example.org)`);
});

test(`html is never made: it stays plain text`, () => {
  const blocks = parseMarkdown(`<script>alert(1)</script> <b>x</b> <img src=x onerror=alert(1)>`);
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].children.every((n) => n.type === `text`));
  assert.match(plain(blocks[0].children), /<script>/);
});

test(`empty or odd inputs give no error`, () => {
  assert.deepEqual(parseMarkdown(``), []);
  assert.deepEqual(parseMarkdown(null), []);
  assert.deepEqual(parseMarkdown(undefined), []);
  assert.deepEqual(parseMarkdown(`   \n  \n`), []);
  assert.equal(parseMarkdown(`x`.repeat(50000))[0].children[0].value.length, 20000);
});

test(`nesting is bounded`, () => {
  const text = `*`.repeat(200) + `x` + `*`.repeat(200);
  assert.doesNotThrow(() => parseMarkdown(text));
});

// A small random generator, so that the test is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test(`random texts never throw and always give valid nodes`, () => {
  const pieces = [`*`, `**`, `_`, `[`, `](`, `)`, `https://example.org`, `# `, `- `, `1. `, `\n`, `\n\n`, `a`, `b c`, `{x}`, `\\`, `<`, `>`, `é`, ` `];
  const check = (nodes) => nodes.forEach((n) => {
    assert.ok([`text`, `break`, `strong`, `em`, `link`, `paragraph`, `heading`, `list`].includes(n.type));
    if (n.type === `link`) assert.match(n.href, /^https:\/\//);
    if (n.children) check(n.children);
    if (n.items) n.items.forEach(check);
  });
  for (let seed = 1; seed <= 300; seed += 1) {
    const next = random(seed);
    let text = ``;
    for (let i = 0; i < 40; i += 1) text += pieces[Math.floor(next() * pieces.length)];
    check(parseMarkdown(text));
  }
});
