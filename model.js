// The model of a dashboard: page settings and the list of blocks, saved as one JSON object in the
// options of the widget. This file reads, cleans and changes the model. Every function returns a new
// model and never changes its argument. Whatever comes in (a saved model, an imported file) is
// cleaned first, so the rest of the widget can trust it: known types, bounded numbers, short titles,
// blocks that never overlap and never leave their page. Pure logic, tested with Node.
(function (root) {
  const layout = typeof module !== `undefined` && module.exports ? require(`./layout.js`) : root.exportTdbLayout;
  const { MAX_PAGES, MARGINS, DEFAULT_MARGIN, FORMATS, ORIENTATIONS, gridOf, isFree, clampSize, findFreeSpot, resolveMove, resolveResize } = layout;

  // Version of the saved format. A change of format needs a migration here.
  const FORMAT_VERSION = 1;
  const MAX_BLOCKS = 120;
  const MAX_TITLE = 200;
  const TYPES = [`text`, `table`, `chart`, `image`, `indicator`];
  // Size of a new block in grid steps, by type.
  const DEFAULT_SIZES = { text: { w: 20, h: 8 }, table: { w: 40, h: 16 }, chart: { w: 24, h: 16 }, image: { w: 20, h: 16 }, indicator: { w: 12, h: 8 } };
  const ID_PATTERN = /^[a-z0-9]{1,24}$/;

  // A model with one empty page: screen format, landscape, 10 mm margins.
  function emptyModel() {
    return { version: FORMAT_VERSION, page: { format: `screen`, orientation: `landscape`, margin: DEFAULT_MARGIN }, pages: 1, blocks: [] };
  }

  // A new identifier that no block of the list uses.
  function newId(blocks) {
    const used = new Set(blocks.map((block) => block.id));
    let id;
    do {
      id = `b${Math.random().toString(36).slice(2, 10)}`;
    } while (used.has(id));
    return id;
  }

  // A whole number inside bounds, or the fallback when the value is not a finite number.
  function whole(value, min, max, fallback) {
    if (typeof value !== `number` || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  // Page settings cleaned: unknown values give the defaults.
  function cleanPage(raw) {
    const source = raw && typeof raw === `object` ? raw : {};
    return {
      format: Object.prototype.hasOwnProperty.call(FORMATS, source.format) ? source.format : `screen`,
      orientation: ORIENTATIONS.includes(source.orientation) ? source.orientation : `landscape`,
      margin: MARGINS.includes(source.margin) ? source.margin : DEFAULT_MARGIN
    };
  }

  // Puts every block on a valid place: blocks keep their place when it is free, otherwise they go to
  // the first free place, and pages are added when needed. Blocks are handled in reading order but keep
  // their order in the list.
  function reflow(model) {
    const grid = gridOf(model.page);
    const order = new Map(model.blocks.map((block, index) => [block.id, index]));
    const ordered = [...model.blocks].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    const placed = [];
    let pages = Math.min(MAX_PAGES, Math.max(1, model.pages));
    for (const block of ordered) {
      const size = clampSize(block, grid);
      const wanted = {
        page: Math.min(block.page, pages - 1),
        x: Math.min(Math.max(0, block.x), grid.cols - size.w),
        y: Math.min(Math.max(0, block.y), grid.rows - size.h),
        w: size.w,
        h: size.h
      };
      let spot = isFree(placed, wanted, grid, null) ? wanted : null;
      if (!spot) {
        const found = findFreeSpot(placed, size, pages, grid);
        if (found) spot = { ...found, ...size };
      }
      if (!spot && pages < MAX_PAGES) {
        pages += 1;
        spot = { page: pages - 1, x: 0, y: 0, ...size };
      }
      if (spot) placed.push({ ...block, ...spot });
    }
    placed.sort((a, b) => order.get(a.id) - order.get(b.id));
    const last = placed.reduce((most, block) => Math.max(most, block.page), 0);
    return { ...model, pages: Math.max(pages, last + 1), blocks: placed };
  }

  // Removes the empty pages at the end, but keeps at least one page.
  function trimPages(model) {
    const last = model.blocks.reduce((most, block) => Math.max(most, block.page), 0);
    return { ...model, pages: Math.min(model.pages, Math.max(1, last + 1)) };
  }

  // Cleans a model that comes from outside. Returns { model, warnings, locked }. `warnings` holds codes
  // (`version`, `blocks`, `invalid`). `locked` is true for a model saved by a newer version: it must
  // not be overwritten.
  function validateModel(raw) {
    const warnings = [];
    if (raw === null || raw === undefined) return { model: emptyModel(), warnings, locked: false };
    if (typeof raw !== `object` || Array.isArray(raw)) return { model: emptyModel(), warnings: [`invalid`], locked: false };
    if (typeof raw.version === `number` && raw.version > FORMAT_VERSION) return { model: emptyModel(), warnings: [`version`], locked: true };
    const page = cleanPage(raw.page);
    const list = Array.isArray(raw.blocks) ? raw.blocks : [];
    if (list.length > MAX_BLOCKS) warnings.push(`blocks`);
    const ids = new Set();
    const blocks = [];
    for (const item of list.slice(0, MAX_BLOCKS)) {
      if (!item || typeof item !== `object` || !TYPES.includes(item.type)) {
        warnings.push(`invalid`);
        continue;
      }
      let id = typeof item.id === `string` && ID_PATTERN.test(item.id) && !ids.has(item.id) ? item.id : newId(blocks);
      ids.add(id);
      const size = DEFAULT_SIZES[item.type];
      blocks.push({
        id,
        type: item.type,
        title: typeof item.title === `string` ? item.title.slice(0, MAX_TITLE) : ``,
        page: whole(item.page, 0, MAX_PAGES - 1, 0),
        x: whole(item.x, 0, 1000, 0),
        y: whole(item.y, 0, 1000, 0),
        w: whole(item.w, 1, 1000, size.w),
        h: whole(item.h, 1, 1000, size.h)
      });
    }
    const pages = whole(raw.pages, 1, MAX_PAGES, 1);
    const model = trimPages(reflow({ version: FORMAT_VERSION, page, pages, blocks }));
    return { model, warnings: [...new Set(warnings)], locked: false };
  }

  // A block of the model by identifier, or undefined.
  function findBlock(model, id) {
    return model.blocks.find((block) => block.id === id);
  }

  // Adds a block of a type at the first free place, with a new page when there is no room. Returns
  // { model, id } (id is null when the limits are reached).
  function addBlock(model, type) {
    if (!TYPES.includes(type) || model.blocks.length >= MAX_BLOCKS) return { model, id: null };
    const grid = gridOf(model.page);
    const size = clampSize(DEFAULT_SIZES[type], grid);
    let pages = model.pages;
    let spot = findFreeSpot(model.blocks, size, pages, grid);
    if (!spot) {
      if (pages >= MAX_PAGES) return { model, id: null };
      pages += 1;
      spot = { page: pages - 1, x: 0, y: 0 };
    }
    const id = newId(model.blocks);
    const block = { id, type, title: ``, ...spot, ...size };
    return { model: { ...model, pages, blocks: [...model.blocks, block] }, id };
  }

  // Adds an empty page at the end.
  function addPage(model) {
    if (model.pages >= MAX_PAGES) return model;
    return { ...model, pages: model.pages + 1 };
  }

  // Changes the title or the type of a block.
  function updateBlock(model, id, changes) {
    const block = findBlock(model, id);
    if (!block) return model;
    const next = { ...block };
    if (typeof changes.title === `string`) next.title = changes.title.slice(0, MAX_TITLE);
    if (TYPES.includes(changes.type)) next.type = changes.type;
    return { ...model, blocks: model.blocks.map((item) => (item.id === id ? next : item)) };
  }

  // Moves a block towards a wanted place { page, x, y }: it goes to the valid place closest to it.
  // When the wanted page has no room for it, the model is returned unchanged.
  function moveBlock(model, id, wanted) {
    const block = findBlock(model, id);
    if (!block || wanted.page < 0 || wanted.page >= model.pages) return model;
    const spot = resolveMove(model.blocks, block, wanted, gridOf(model.page));
    if (!spot) return model;
    return trimPages({ ...model, blocks: model.blocks.map((item) => (item.id === id ? { ...item, ...spot } : item)) });
  }

  // Resizes a block towards a wanted size { w, h }: it gets the valid size closest to it.
  function resizeBlock(model, id, wanted, keepRatio) {
    const block = findBlock(model, id);
    if (!block) return model;
    const size = resolveResize(model.blocks, block, wanted, gridOf(model.page), keepRatio);
    return { ...model, blocks: model.blocks.map((item) => (item.id === id ? { ...item, ...size } : item)) };
  }

  // Sets the geometry of a block from the settings panel: size first, then place.
  function setGeometry(model, id, wanted) {
    const block = findBlock(model, id);
    if (!block) return model;
    const grid = gridOf(model.page);
    const size = clampSize({ w: wanted.w === undefined ? block.w : wanted.w, h: wanted.h === undefined ? block.h : wanted.h }, grid);
    const others = model.blocks.filter((item) => item.id !== id);
    const resized = { ...block, ...size, x: Math.min(block.x, grid.cols - size.w), y: Math.min(block.y, grid.rows - size.h) };
    const target = {
      page: wanted.page === undefined ? block.page : Math.min(Math.max(0, wanted.page), model.pages - 1),
      x: wanted.x === undefined ? resized.x : wanted.x,
      y: wanted.y === undefined ? resized.y : wanted.y
    };
    const spot = resolveMove(others, { ...resized, page: target.page }, target, grid);
    if (!spot) return model;
    return trimPages({ ...model, blocks: model.blocks.map((item) => (item.id === id ? { ...resized, ...spot } : item)) });
  }

  // Removes a block and the empty pages at the end.
  function deleteBlock(model, id) {
    return trimPages({ ...model, blocks: model.blocks.filter((block) => block.id !== id) });
  }

  // Changes the page settings (format, orientation, margin) and puts the blocks back in place.
  function setPage(model, changes) {
    return trimPages(reflow({ ...model, page: cleanPage({ ...model.page, ...changes }) }));
  }

  const api = { FORMAT_VERSION, MAX_BLOCKS, MAX_TITLE, TYPES, DEFAULT_SIZES, emptyModel, validateModel, reflow, trimPages, findBlock, addBlock, addPage, updateBlock, moveBlock, resizeBlock, setGeometry, deleteBlock, setPage };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbModel = api;
})(typeof window !== `undefined` ? window : globalThis);
