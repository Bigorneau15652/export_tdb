// Geometry of the pages and of the blocks placed on them. Positions and sizes are whole numbers of
// grid steps (5 mm) counted from the top left corner of the content area of a page (the page
// without its margins). Blocks never overlap and never leave the content area. This file has no
// access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const STEP_MM = 5;
  const MIN_SIZE = 2;
  const MAX_PAGES = 40;
  const MARGINS = [0, 5, 10, 15, 20];
  const DEFAULT_MARGIN = 10;
  // Sizes in millimetres, written for the landscape orientation (the long side first).
  const FORMATS = {
    screen: { long: 297, short: 167 },
    a3: { long: 420, short: 297 },
    a4: { long: 297, short: 210 },
    a5: { long: 210, short: 148 },
    square: { long: 210, short: 210 }
  };
  const ORIENTATIONS = [`landscape`, `portrait`];

  // Width and height of a page in millimetres for a format and an orientation.
  function pageSizeMm(format, orientation) {
    const size = FORMATS[format] || FORMATS.screen;
    return orientation === `portrait` ? { w: size.short, h: size.long } : { w: size.long, h: size.short };
  }

  // Number of columns and rows of the content area of a page, in grid steps.
  function gridOf(page) {
    const size = pageSizeMm(page.format, page.orientation);
    const margin = MARGINS.includes(page.margin) ? page.margin : DEFAULT_MARGIN;
    return {
      cols: Math.max(MIN_SIZE, Math.floor((size.w - 2 * margin) / STEP_MM)),
      rows: Math.max(MIN_SIZE, Math.floor((size.h - 2 * margin) / STEP_MM)),
      margin
    };
  }

  // True when two blocks are on the same page and share some area.
  function overlaps(a, b) {
    return a.page === b.page && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // True when a rectangle (x, y, w, h) lies inside the content area.
  function fits(rect, grid) {
    return rect.x >= 0 && rect.y >= 0 && rect.w >= MIN_SIZE && rect.h >= MIN_SIZE && rect.x + rect.w <= grid.cols && rect.y + rect.h <= grid.rows;
  }

  // True when a block with this geometry (page, x, y, w, h) fits and meets no block except `ignoreId`.
  function isFree(blocks, rect, grid, ignoreId) {
    if (!fits(rect, grid)) return false;
    for (const other of blocks) {
      if (other.id !== ignoreId && overlaps(rect, other)) return false;
    }
    return true;
  }

  // A size brought inside the content area and above the minimum.
  function clampSize(size, grid) {
    return {
      w: Math.min(grid.cols, Math.max(MIN_SIZE, Math.round(size.w))),
      h: Math.min(grid.rows, Math.max(MIN_SIZE, Math.round(size.h)))
    };
  }

  // First free place for a block of the given size, reading the pages from top to bottom and from
  // left to right. Returns { page, x, y } or null when the `pageCount` pages have no room.
  function findFreeSpot(blocks, size, pageCount, grid) {
    const { w, h } = clampSize(size, grid);
    for (let page = 0; page < pageCount; page += 1) {
      for (let y = 0; y + h <= grid.rows; y += 1) {
        for (let x = 0; x + w <= grid.cols; x += 1) {
          if (isFree(blocks, { page, x, y, w, h }, grid, null)) return { page, x, y };
        }
      }
    }
    return null;
  }

  // The valid position closest to the wanted one on the wanted page, for a block that keeps its size.
  // Returns { page, x, y } or null when that page has no valid position for it.
  function resolveMove(blocks, block, wanted, grid) {
    const page = wanted.page;
    const x0 = Math.min(Math.max(0, Math.round(wanted.x)), Math.max(0, grid.cols - block.w));
    const y0 = Math.min(Math.max(0, Math.round(wanted.y)), Math.max(0, grid.rows - block.h));
    if (isFree(blocks, { page, x: x0, y: y0, w: block.w, h: block.h }, grid, block.id)) return { page, x: x0, y: y0 };
    let best = null;
    let bestDistance = Infinity;
    for (let y = 0; y + block.h <= grid.rows; y += 1) {
      for (let x = 0; x + block.w <= grid.cols; x += 1) {
        const distance = (x - x0) * (x - x0) + (y - y0) * (y - y0);
        if (distance >= bestDistance) continue;
        if (isFree(blocks, { page, x, y, w: block.w, h: block.h }, grid, block.id)) {
          best = { page, x, y };
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  // The most pushes a single move may need; a longer chain means that something is wrong, and the move is refused.
  const MAX_PUSHES = 2000;

  // Where the block `other` goes when the rectangle `pusher` pushes it: just beyond the pusher, in the direction of
  // the push (`vertical` and `sign`: 1 down or to the right, -1 up or to the left). A block pushed out of the bottom of a page
  // goes to the top of the next page, a block pushed out of the top goes to the bottom of the previous page. Returns the
  // new rectangle of `other`, or null when it has no place to go (out of the sides of the page, before the first page, after
  // the last one).
  function pushedBy(pusher, other, vertical, sign, grid) {
    if (vertical) {
      if (sign > 0) {
        const y = pusher.y + pusher.h;
        if (y + other.h <= grid.rows) return { ...other, page: pusher.page, y };
        return pusher.page + 1 < MAX_PAGES ? { ...other, page: pusher.page + 1, y: 0 } : null;
      }
      const y = pusher.y - other.h;
      if (y >= 0) return { ...other, page: pusher.page, y };
      return pusher.page > 0 ? { ...other, page: pusher.page - 1, y: grid.rows - other.h } : null;
    }
    const x = sign > 0 ? pusher.x + pusher.w : pusher.x - other.w;
    return x >= 0 && x + other.w <= grid.cols ? { ...other, page: pusher.page, x } : null;
  }

  // A move that pushes the blocks in the way instead of going round them. The block goes exactly where it is wanted (kept
  // inside its page); the blocks that it covers are pushed away from it, in the direction opposite to the move of the
  // block (it moves up: they go down; it moves left: they go right), by just the room needed, and the blocks that they
  // cover in turn are pushed the same way. The direction is the vertical one unless the block moved more sideways than up
  // or down. Returns { spot: { page, x, y }, shifted: [{ id, page, x, y }] } (`shifted` is empty when nothing was in the
  // way), or null when the blocks cannot all be pushed: the caller then looks for the closest free place (see resolveMove).
  function resolvePush(blocks, block, wanted, grid) {
    const page = wanted.page;
    if (!Number.isInteger(page) || page < 0 || page >= MAX_PAGES) return null;
    const x = Math.min(Math.max(0, Math.round(wanted.x)), Math.max(0, grid.cols - block.w));
    const y = Math.min(Math.max(0, Math.round(wanted.y)), Math.max(0, grid.rows - block.h));
    const target = { id: block.id, page, x, y, w: block.w, h: block.h };
    const dx = x - block.x;
    const dy = (page - block.page) * grid.rows + (y - block.y);
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const sign = (vertical ? dy : dx) < 0 ? 1 : -1;
    const rects = new Map(blocks.filter((item) => item.id !== block.id).map((item) => [item.id, { id: item.id, page: item.page, x: item.x, y: item.y, w: item.w, h: item.h }]));
    const queue = [target];
    let pushes = 0;
    while (queue.length) {
      const pusher = queue.shift();
      const current = rects.get(pusher.id);
      // A block that was pushed again since it was queued no longer pushes from its old place.
      if (current && (current.page !== pusher.page || current.x !== pusher.x || current.y !== pusher.y)) continue;
      for (const other of rects.values()) {
        if (other.id === pusher.id || !overlaps(pusher, other)) continue;
        pushes += 1;
        const next = pushes > MAX_PUSHES ? null : pushedBy(pusher, other, vertical, sign, grid);
        if (!next) return null;
        rects.set(other.id, next);
        queue.push(next);
      }
    }
    const all = [target, ...rects.values()];
    for (const item of all) {
      if (!fits(item, grid)) return null;
      for (const other of all) if (other.id !== item.id && overlaps(item, other)) return null;
    }
    const shifted = blocks
      .filter((item) => item.id !== block.id)
      .map((item) => ({ before: item, after: rects.get(item.id) }))
      .filter(({ before, after }) => before.page !== after.page || before.x !== after.x || before.y !== after.y)
      .map(({ after }) => ({ id: after.id, page: after.page, x: after.x, y: after.y }));
    return { spot: { page, x, y }, shifted };
  }

  // The valid size closest to the wanted one for a block whose top left corner stays where it is.
  // With `keepRatio` the proportions of the block are kept. Returns { w, h } (the size of the block
  // itself is always valid, so there is always an answer).
  function resolveResize(blocks, block, wanted, grid, keepRatio) {
    const ratio = block.w / block.h;
    const room = { cols: grid.cols - block.x, rows: grid.rows - block.y };
    let w = Math.min(room.cols, Math.max(MIN_SIZE, Math.round(wanted.w)));
    let h = Math.min(room.rows, Math.max(MIN_SIZE, Math.round(wanted.h)));
    const free = (width, height) => isFree(blocks, { page: block.page, x: block.x, y: block.y, w: width, h: height }, grid, block.id);
    if (keepRatio) {
      for (let width = w; width >= MIN_SIZE; width -= 1) {
        const height = Math.max(MIN_SIZE, Math.round(width / ratio));
        if (height <= room.rows && free(width, height)) return { w: width, h: height };
      }
      return { w: block.w, h: block.h };
    }
    if (free(w, h)) return { w, h };
    let best = { w: block.w, h: block.h };
    let bestDistance = Infinity;
    for (let width = MIN_SIZE; width <= w; width += 1) {
      for (let height = MIN_SIZE; height <= h; height += 1) {
        const distance = (w - width) * (w - width) + (h - height) * (h - height);
        if (distance < bestDistance && free(width, height)) {
          best = { w: width, h: height };
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  // The valid rectangle closest to the one wanted when the edges of a block are pulled: `edges` gives how many steps the
  // left, top, right and bottom edges move (a positive left or top moves the edge inwards, a positive right or bottom
  // outwards, as the pointer goes to the right or down). The block keeps at least the minimum size, stays in the page and
  // meets no other block: the movement is reduced until the rectangle is valid (the block itself always is).
  // Returns { x, y, w, h }.
  function resolveBox(blocks, block, edges, grid) {
    const at = (t) => {
      const left = Math.round((edges.left || 0) * t);
      const top = Math.round((edges.top || 0) * t);
      const right = Math.round((edges.right || 0) * t);
      const bottom = Math.round((edges.bottom || 0) * t);
      return { page: block.page, x: block.x + left, y: block.y + top, w: block.w - left + right, h: block.h - top + bottom };
    };
    for (let step = 20; step >= 0; step -= 1) {
      const rect = at(step / 20);
      if (isFree(blocks, rect, grid, block.id)) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    }
    return { x: block.x, y: block.y, w: block.w, h: block.h };
  }

  const api = { STEP_MM, MIN_SIZE, MAX_PAGES, MARGINS, DEFAULT_MARGIN, FORMATS, ORIENTATIONS, pageSizeMm, gridOf, overlaps, fits, isFree, clampSize, findFreeSpot, resolveMove, resolvePush, resolveResize, resolveBox };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbLayout = api;
})(typeof window !== `undefined` ? window : globalThis);
