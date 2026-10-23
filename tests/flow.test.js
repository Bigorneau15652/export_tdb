const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const F = require(`../flow.js`);

const grid = { cols: 56, rows: 38 };
const table = { id: `t`, page: 0, x: 2, y: 3, w: 20, h: 10 };

test(`the free bands of a page are cut by the blocks that share its columns`, () => {
  assert.deepEqual(F.freeBands([table], table, 1, grid), [{ y: 0, h: 38 }]);
  const blocks = [table, { id: `a`, page: 1, x: 0, y: 10, w: 5, h: 8 }, { id: `b`, page: 1, x: 30, y: 0, w: 5, h: 38 }];
  assert.deepEqual(F.freeBands(blocks, table, 1, grid), [{ y: 0, h: 10 }, { y: 18, h: 20 }]);
  const top = [table, { id: `c`, page: 1, x: 10, y: 0, w: 4, h: 36 }];
  assert.deepEqual(F.freeBands(top, table, 1, grid), []);
});

test(`the places after a block are the free bands of the following pages in reading order`, () => {
  const blocks = [table, { id: `a`, page: 1, x: 0, y: 10, w: 5, h: 8 }];
  assert.deepEqual(F.regionsAfter(blocks, table, 3, grid), [{ page: 1, y: 0, h: 10 }, { page: 1, y: 18, h: 20 }, { page: 2, y: 0, h: 38 }]);
  assert.deepEqual(F.regionsAfter(blocks, table, 1, grid), []);
});

test(`rows are cut into the places and the rows that fit nowhere are counted`, () => {
  const heights = [10, 10, 10, 10, 10, 10, 10];
  assert.deepEqual(F.splitRows(heights, 35, [25, 100]), { chunks: [{ start: 0, end: 3 }, { start: 3, end: 5 }, { start: 5, end: 7 }], leftover: 0 });
  assert.deepEqual(F.splitRows(heights, 35, []), { chunks: [{ start: 0, end: 3 }], leftover: 4 });
  assert.deepEqual(F.splitRows(heights, 100, [50]), { chunks: [{ start: 0, end: 7 }], leftover: 0 });
  assert.deepEqual(F.splitRows(heights, 5, [30]), { chunks: [{ start: 0, end: 0 }, { start: 0, end: 3 }], leftover: 4 });
  assert.deepEqual(F.splitRows([], 10, [10]), { chunks: [{ start: 0, end: 0 }], leftover: 0 });
});

test(`every row is placed once, in order, whatever the heights and the places`, () => {
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let round = 0; round < 300; round += 1) {
    const heights = Array.from({ length: Math.floor(next() * 40) }, () => 5 + Math.floor(next() * 30));
    const rooms = Array.from({ length: Math.floor(next() * 4) }, () => Math.floor(next() * 200));
    const result = F.splitRows(heights, Math.floor(next() * 200), rooms);
    let at = 0;
    for (const chunk of result.chunks) {
      assert.equal(chunk.start, at);
      assert.ok(chunk.end >= chunk.start);
      at = chunk.end;
    }
    assert.equal(at + result.leftover, heights.length);
  }
});
