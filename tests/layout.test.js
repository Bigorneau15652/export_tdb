// Tests of the geometry of pages and blocks: sizes, free places, nearest valid move and resize.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const L = require(`../layout.js`);

const GRID = { cols: 10, rows: 6, margin: 10 };
const block = (id, x, y, w, h, page = 0) => ({ id, page, x, y, w, h });

test(`page sizes follow the format and the orientation`, () => {
  assert.deepEqual(L.pageSizeMm(`a4`, `landscape`), { w: 297, h: 210 });
  assert.deepEqual(L.pageSizeMm(`a4`, `portrait`), { w: 210, h: 297 });
  assert.deepEqual(L.pageSizeMm(`a3`, `landscape`), { w: 420, h: 297 });
  assert.deepEqual(L.pageSizeMm(`a5`, `portrait`), { w: 148, h: 210 });
  assert.deepEqual(L.pageSizeMm(`square`, `portrait`), { w: 210, h: 210 });
  assert.deepEqual(L.pageSizeMm(`screen`, `landscape`), { w: 297, h: 167 });
  assert.deepEqual(L.pageSizeMm(`unknown`, `landscape`), { w: 297, h: 167 });
});

test(`the grid is the content area counted in steps of 5 mm`, () => {
  assert.deepEqual(L.gridOf({ format: `a4`, orientation: `landscape`, margin: 10 }), { cols: 55, rows: 38, margin: 10 });
  assert.deepEqual(L.gridOf({ format: `a4`, orientation: `portrait`, margin: 0 }), { cols: 42, rows: 59, margin: 0 });
  assert.equal(L.gridOf({ format: `a4`, orientation: `landscape`, margin: 7 }).margin, 10);
});

test(`blocks on the same page overlap only when they share area`, () => {
  assert.equal(L.overlaps(block(`a`, 0, 0, 4, 4), block(`b`, 3, 3, 4, 4)), true);
  assert.equal(L.overlaps(block(`a`, 0, 0, 4, 4), block(`b`, 4, 0, 4, 4)), false);
  assert.equal(L.overlaps(block(`a`, 0, 0, 4, 4), block(`b`, 0, 4, 4, 4)), false);
  assert.equal(L.overlaps(block(`a`, 0, 0, 4, 4, 0), block(`b`, 0, 0, 4, 4, 1)), false);
});

test(`the first free place is read from top to bottom and from left to right`, () => {
  const blocks = [block(`a`, 0, 0, 5, 3)];
  assert.deepEqual(L.findFreeSpot(blocks, { w: 5, h: 3 }, 1, GRID), { page: 0, x: 5, y: 0 });
  assert.deepEqual(L.findFreeSpot(blocks, { w: 6, h: 3 }, 1, GRID), { page: 0, x: 0, y: 3 });
  assert.equal(L.findFreeSpot([block(`a`, 0, 0, 10, 6)], { w: 2, h: 2 }, 1, GRID), null);
  assert.deepEqual(L.findFreeSpot([block(`a`, 0, 0, 10, 6)], { w: 2, h: 2 }, 2, GRID), { page: 1, x: 0, y: 0 });
});

test(`a block bigger than the page is brought to the size of the page`, () => {
  assert.deepEqual(L.findFreeSpot([], { w: 99, h: 99 }, 1, GRID), { page: 0, x: 0, y: 0 });
});

test(`a move to a free place is kept, a move onto a block goes to the closest free place`, () => {
  const a = block(`a`, 0, 0, 4, 3);
  const b = block(`b`, 6, 0, 4, 3);
  assert.deepEqual(L.resolveMove([a, b], a, { page: 0, x: 1, y: 3 }, GRID), { page: 0, x: 1, y: 3 });
  const spot = L.resolveMove([a, b], a, { page: 0, x: 5, y: 1 }, GRID);
  assert.equal(L.isFree([a, b], { ...a, ...spot }, GRID, `a`), true);
  assert.deepEqual(L.resolveMove([a, b], a, { page: 0, x: 50, y: 50 }, GRID), { page: 0, x: 6, y: 3 });
});

test(`a move to a page that is full gives null`, () => {
  const a = block(`a`, 0, 0, 4, 3);
  const full = block(`f`, 0, 0, 10, 6, 1);
  assert.equal(L.resolveMove([a, full], a, { page: 1, x: 0, y: 0 }, GRID), null);
});

test(`a resize stops at the neighbour and at the edge of the page`, () => {
  const a = block(`a`, 0, 0, 3, 3);
  const b = block(`b`, 6, 0, 4, 3);
  assert.deepEqual(L.resolveResize([a, b], a, { w: 8, h: 3 }, GRID, false), { w: 6, h: 3 });
  assert.deepEqual(L.resolveResize([a], a, { w: 30, h: 30 }, GRID, false), { w: 10, h: 6 });
  assert.deepEqual(L.resolveResize([a], a, { w: 1, h: 1 }, GRID, false), { w: 2, h: 2 });
});

test(`a resize with the keep-ratio option keeps the proportions`, () => {
  const a = block(`a`, 0, 0, 4, 2);
  assert.deepEqual(L.resolveResize([a], a, { w: 8, h: 2 }, GRID, true), { w: 8, h: 4 });
  const b = block(`b`, 0, 5, 10, 1);
  const size = L.resolveResize([a, b], a, { w: 10, h: 2 }, GRID, true);
  assert.equal(size.w / size.h, 2);
  assert.ok(size.h + 0 <= 5);
});

// A small random generator, so that the test is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test(`random moves and resizes never overlap blocks or leave the page`, () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = random(seed);
    const grid = { cols: 12 + Math.floor(next() * 40), rows: 8 + Math.floor(next() * 30), margin: 10 };
    const blocks = [];
    for (let i = 0; i < 8; i += 1) {
      const size = { w: 2 + Math.floor(next() * 10), h: 2 + Math.floor(next() * 8) };
      const spot = L.findFreeSpot(blocks, size, 1, grid);
      if (spot) blocks.push({ id: `b${i}`, ...spot, ...L.clampSize(size, grid) });
    }
    for (let step = 0; step < 40 && blocks.length; step += 1) {
      const index = Math.floor(next() * blocks.length);
      const current = blocks[index];
      if (next() < 0.5) {
        const spot = L.resolveMove(blocks, current, { page: 0, x: Math.floor(next() * grid.cols) - 3, y: Math.floor(next() * grid.rows) - 3 }, grid);
        if (spot) blocks[index] = { ...current, ...spot };
      } else {
        const size = L.resolveResize(blocks, current, { w: Math.floor(next() * grid.cols), h: Math.floor(next() * grid.rows) }, grid, next() < 0.5);
        blocks[index] = { ...current, ...size };
      }
      blocks.forEach((item) => {
        assert.ok(L.fits(item, grid), `seed ${seed} step ${step}: block outside`);
        blocks.forEach((other) => {
          if (other.id !== item.id) assert.equal(L.overlaps(item, other), false, `seed ${seed} step ${step}: overlap`);
        });
      });
    }
  }
});

test(`pulling the edges of a block moves them, never out of the page, under the minimum size or onto another block`, () => {
  const a = block(`a`, 4, 2, 4, 3);
  assert.deepEqual(L.resolveBox([a], a, { left: -2 }, GRID), { x: 2, y: 2, w: 6, h: 3 });
  assert.deepEqual(L.resolveBox([a], a, { top: -1, bottom: 1 }, GRID), { x: 4, y: 1, w: 4, h: 5 });
  assert.deepEqual(L.resolveBox([a], a, { left: 1, right: 2 }, GRID), { x: 5, y: 2, w: 5, h: 3 });
  assert.deepEqual(L.resolveBox([a], a, { left: -9 }, GRID), { x: 0, y: 2, w: 8, h: 3 });
  const tiny = L.resolveBox([a], a, { left: 9 }, GRID);
  assert.ok(tiny.w >= L.MIN_SIZE && tiny.x + tiny.w === 8);
  const beside = block(`b`, 0, 0, 3, 6);
  assert.deepEqual(L.resolveBox([a, beside], a, { left: -4 }, GRID), { x: 3, y: 2, w: 5, h: 3 });
  const above = block(`c`, 4, 0, 4, 1);
  assert.deepEqual(L.resolveBox([a, above], a, { top: -2 }, GRID), { x: 4, y: 1, w: 4, h: 4 });
  const otherPage = block(`d`, 0, 0, 10, 6, 1);
  assert.deepEqual(L.resolveBox([a, otherPage], a, { left: -4 }, GRID), { x: 0, y: 2, w: 8, h: 3 });
});
