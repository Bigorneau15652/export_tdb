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

  const api = { STEP_MM, MIN_SIZE, MAX_PAGES, MARGINS, DEFAULT_MARGIN, FORMATS, ORIENTATIONS, pageSizeMm, gridOf, overlaps, fits, isFree, clampSize, findFreeSpot, resolveMove, resolveResize };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbLayout = api;
})(typeof window !== `undefined` ? window : globalThis);
