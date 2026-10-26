// Long tables over several pages. When the rows of a table block do not fit in its frame, the rest of
// the rows continues in the free places of the following pages, at the same horizontal position and
// with the same width, starting from the top of the page. This file has no access to the page or to
// Grist: it is pure logic, tested with Node. Heights of rows are given in pixels by the display, the
// places of the pages in grid steps (see layout.js).
(function (root) {
  const MIN_BAND = 4;

  // The free vertical bands of the page `page` in the columns of `block`, from top to bottom. A band is
  // { y, h } in grid steps. The blocks of the page that share some of these columns cut the page; bands
  // shorter than `MIN_BAND` steps are left out.
  function freeBands(blocks, block, page, grid) {
    const left = block.x;
    const right = block.x + block.w;
    const others = blocks
      .filter((other) => other.page === page && other.id !== block.id && other.x < right && left < other.x + other.w)
      .sort((a, b) => a.y - b.y);
    const bands = [];
    let cursor = 0;
    for (const other of others) {
      if (other.y > cursor) bands.push({ y: cursor, h: other.y - cursor });
      cursor = Math.max(cursor, other.y + other.h);
    }
    if (cursor < grid.rows) bands.push({ y: cursor, h: grid.rows - cursor });
    return bands.filter((band) => band.h >= MIN_BAND);
  }

  // The height, in grid steps, that a block can take on its own page when it grows downwards: from its top to the top
  // of the next block under it in the same columns, or to the bottom of the page when there is none. It is never less
  // than the height of the block itself.
  function roomBelow(blocks, block, grid) {
    const left = block.x;
    const right = block.x + block.w;
    const under = blocks
      .filter((other) => other.page === block.page && other.id !== block.id && other.x < right && left < other.x + other.w && other.y >= block.y + block.h)
      .map((other) => other.y);
    const limit = under.length ? Math.min(...under) : grid.rows;
    return Math.max(block.h, limit - block.y);
  }

  // The places that the rest of a table can use: the free bands of the pages after the page of the block,
  // in reading order. Returns [{ page, y, h }].
  function regionsAfter(blocks, block, pageCount, grid) {
    const regions = [];
    for (let page = block.page + 1; page < pageCount; page += 1) {
      for (const band of freeBands(blocks, block, page, grid)) regions.push({ page, y: band.y, h: band.h });
    }
    return regions;
  }

  // Cuts the rows of a table into the places that are available. `heights` are the heights of the rows,
  // `firstRoom` the height that the first place keeps for rows (after its title and heading) and
  // `rooms` the same for each following place. Returns { chunks: [{ start, end }], leftover } where the
  // chunk i holds the rows start to end (excluded) and `leftover` is the number of rows that do not fit
  // anywhere. The first chunk is always given, even when it is empty.
  function splitRows(heights, firstRoom, rooms) {
    const chunks = [];
    let at = 0;
    const all = [firstRoom, ...rooms];
    for (let index = 0; index < all.length; index += 1) {
      const start = at;
      let used = 0;
      while (at < heights.length && used + heights[at] <= all[index] + 0.5) {
        used += heights[at];
        at += 1;
      }
      chunks.push({ start, end: at });
      if (at >= heights.length) break;
    }
    return { chunks, leftover: heights.length - at };
  }

  const api = { MIN_BAND, freeBands, roomBelow, regionsAfter, splitRows };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbFlow = api;
})(typeof window !== `undefined` ? window : globalThis);
