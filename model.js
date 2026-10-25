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
  const TYPES = [`text`, `table`, `record`, `chart`, `image`, `indicator`];
  // Size of a new block in grid steps, by type.
  const DEFAULT_SIZES = { text: { w: 20, h: 8 }, table: { w: 40, h: 16 }, record: { w: 40, h: 8 }, chart: { w: 24, h: 16 }, image: { w: 20, h: 16 }, indicator: { w: 12, h: 8 } };
  const ID_PATTERN = /^[a-z0-9]{1,24}$/;
  // Settings of a text block: where the text comes from, its size, its alignment and a background.
  const TEXT_SOURCES = [`fixed`, `cell`];
  const TEXT_SIZES = [`small`, `normal`, `large`];
  const TEXT_ALIGNS = [`left`, `center`, `justify`];
  const FILLS = [`none`, `grey`, `blue`, `green`, `yellow`, `red`];
  const MAX_FIXED_TEXT = 5000;
  const COLUMN_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
  // Settings of a table block: what is chosen in the panel, checked against these lists and patterns.
  const TABLE_MODES = [`list`, `group`, `cross`];
  const SLICES = [0, 3, 4, 5, 6, 8, 10, 12];
  const FUNCTIONS = [`sum`, `avg`, `min`, `max`, `count`, `distinct`];
  const OPERATORS = [`eq`, `ne`, `gt`, `ge`, `lt`, `le`, `contains`, `empty`, `notEmpty`, `true`, `false`];
  const SORT_BYS = [`none`, `key`, `value`, `column`, `ref`, `manual`];
  const MAX_ORDER = 300;
  const MAX_ORDER_LABEL = 120;
  const MAX_COLUMNS = 12;
  const MAX_RECORD_ITEMS = 24;
  const MAX_VALUES = 40;
  const CHART_TYPES = [`bar`, `stack`, `barh`, `barhStack`, `line`, `area`, `pie`, `donut`, `treemap`, `scatter`];
  const CHART_PALETTES = [`franche`, `douce`, `contrastee`, `froide`];
  const CHART_LEGENDS = [`none`, `top`, `bottom`, `right`];
  const CHART_LABELS = [`none`, `values`, `percent`];
  const INDICATOR_COLORS = [`none`, `green`, `orange`, `red`, `blue`, `grey`];
  const MAX_RULES = 4;
  const MAX_NOTE = 200;
  const MAX_IMAGE_RANK = 20;
  const MAX_FOOTER = 120;
  const VALUE_KINDS = [`calc`, `field`, `expr`];
  const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
  const MAX_UNIT = 12;
  const MAX_EXPRESSION = 500;
  const RECORD_COLUMNS = [1, 2, 3, 4];
  const MAX_FILTERS = 3;
  const MAX_GROUPS = 2;
  const MAX_LABEL = 60;
  const MAX_FILTER_TEXT = 200;
  const PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}(\.[A-Za-z_][A-Za-z0-9_]{0,63}){0,3}$/;
  const LINK_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}\.[A-Za-z_][A-Za-z0-9_]{0,63}(>[A-Za-z_][A-Za-z0-9_]{0,63}\.[A-Za-z_][A-Za-z0-9_]{0,63}){0,5}$/;

  // A model with one empty page: screen format, landscape, 10 mm margins.
  function emptyModel() {
    return { version: FORMAT_VERSION, page: { format: `screen`, orientation: `landscape`, margin: DEFAULT_MARGIN, numbers: false, footer: `` }, pages: 1, blocks: [], values: [] };
  }

  // A value that must be one of the allowed ones, or the first allowed one.
  const oneOf = (value, allowed) => (allowed.includes(value) ? value : allowed[0]);

  // A text that must match a pattern, or an empty text.
  const matching = (value, pattern) => (typeof value === `string` && pattern.test(value) ? value : ``);

  // A filter of a table block cleaned: a known column path and operator, and a value typed as a number,
  // a text, the value of a column of the starting row or the number of that row.
  function cleanFilter(raw) {
    if (!raw || typeof raw !== `object`) return null;
    const path = matching(raw.path, PATH_PATTERN);
    if (!path || !OPERATORS.includes(raw.op)) return null;
    const filter = { path, op: raw.op };
    const value = raw.value;
    if (value && typeof value === `object`) {
      if (value.kind === `id`) filter.value = { kind: `id` };
      else if (value.kind === `field` && matching(value.path, PATH_PATTERN)) filter.value = { kind: `field`, path: value.path };
      else if (value.kind === `const` && (typeof value.value === `number` ? Number.isFinite(value.value) : typeof value.value === `string`)) {
        filter.value = { kind: `const`, value: typeof value.value === `string` ? value.value.slice(0, MAX_FILTER_TEXT) : value.value };
      }
    }
    return filter;
  }

  // The imposed order of the labels of the groups cleaned: texts, without duplicates, within the limits.
  function cleanOrder(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (typeof item === `string` && item.length <= MAX_ORDER_LABEL && !out.includes(item) && out.length < MAX_ORDER) out.push(item);
    }
    return out;
  }

  // The settings of a table block cleaned. The kind of table is not chosen: it is `group` when an item to
  // group by is chosen and `list` otherwise.
  function cleanTable(raw) {
    const sort = raw.sort && typeof raw.sort === `object` ? raw.sort : {};
    const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);
    const groupBy = list(raw.groupBy, MAX_GROUPS).map((path) => matching(path, PATH_PATTERN));
    return {
      mode: groupBy.some(Boolean) ? (matching(raw.colItem, PATH_PATTERN) ? `cross` : `group`) : `list`,
      colItem: matching(raw.colItem, PATH_PATTERN),
      colSort: raw.colSort === `ref` ? `ref` : `key`,
      slice: SLICES.includes(raw.slice) ? raw.slice : 0,
      start: matching(raw.start, PATH_PATTERN),
      table: matching(raw.table, COLUMN_PATTERN),
      link: raw.link === `self` || raw.link === `all` ? raw.link : matching(raw.link, LINK_PATTERN),
      groupBy,
      merge: raw.merge === true,
      columns: list(raw.columns, MAX_COLUMNS).filter((item) => item && typeof item === `object`).map((item) => ({
        path: matching(item.path, PATH_PATTERN),
        fn: FUNCTIONS.includes(item.fn) ? item.fn : ``,
        label: typeof item.label === `string` ? item.label.slice(0, MAX_LABEL) : ``,
        ...(Number.isInteger(item.decimals) && item.decimals >= -1 && item.decimals <= 4 ? { decimals: item.decimals } : {})
      })),
      filters: list(raw.filters, MAX_FILTERS).map(cleanFilter).filter(Boolean),
      sort: { by: oneOf(sort.by, SORT_BYS), column: matching(sort.column, PATH_PATTERN), dir: sort.dir === `desc` ? `desc` : `asc`, order: cleanOrder(sort.order) },
      total: raw.total === true,
      totalRight: raw.totalRight === true,
      totalRightFn: FUNCTIONS.includes(raw.totalRightFn) ? raw.totalRightFn : `sum`,
      ...(Number.isInteger(raw.totalRightDecimals) && raw.totalRightDecimals >= -1 && raw.totalRightDecimals <= 4 ? { totalRightDecimals: raw.totalRightDecimals } : {}),
      decimals: Number.isInteger(raw.decimals) && raw.decimals >= 0 && raw.decimals <= 4 ? raw.decimals : -1
    };
  }

  // The settings of a record block cleaned: the list of information (a column path and a label), the number
  // of columns of the grid and the size of the text.
  function cleanRecord(raw) {
    const items = Array.isArray(raw.items) ? raw.items : [];
    return {
      items: items.slice(0, MAX_RECORD_ITEMS).filter((item) => item && typeof item === `object`).map((item) => ({
        path: matching(item.path, PATH_PATTERN),
        label: typeof item.label === `string` ? item.label.slice(0, MAX_LABEL) : ``
      })),
      columns: RECORD_COLUMNS.includes(raw.columns) ? raw.columns : 2,
      size: TEXT_SIZES.includes(raw.size) ? raw.size : `normal`
    };
  }

  // The settings of a chart block cleaned: the data are chosen like those of a table block (the same keys), then
  // the type of chart, the palette, the position of the legend and the labels of the values.
  function cleanChart(raw) {
    return {
      ...cleanTable(raw),
      chart: oneOf(raw.chart, CHART_TYPES),
      palette: oneOf(raw.palette, CHART_PALETTES),
      legend: CHART_LEGENDS.includes(raw.legend) ? raw.legend : `bottom`,
      labels: oneOf(raw.labels, CHART_LABELS)
    };
  }

  // The settings of an image block cleaned: the column that holds the picture (a path, possibly through a
  // reference), the rank of the picture in the cell (1 is the first) and the column whose value is the caption (a path;
  // the key keeps its name `caption` from version 0.8.0, when it held a text: such a text is not a path and is dropped).
  function cleanImage(raw) {
    return {
      path: matching(raw.path, PATH_PATTERN),
      rank: Number.isInteger(raw.rank) && raw.rank >= 1 && raw.rank <= MAX_IMAGE_RANK ? raw.rank : 1,
      caption: matching(raw.caption, PATH_PATTERN)
    };
  }

  // The settings of an indicator block cleaned: the named value that it shows, a short note under it, the size of
  // the text, the default colour and up to four rules (`ge` or `le` a limit gives a colour; the first rule met wins).
  function cleanIndicator(raw) {
    const rules = Array.isArray(raw.rules) ? raw.rules : [];
    return {
      value: matching(raw.value, NAME_PATTERN),
      note: typeof raw.note === `string` ? raw.note.slice(0, MAX_NOTE) : ``,
      size: TEXT_SIZES.includes(raw.size) ? raw.size : `normal`,
      base: oneOf(raw.base, INDICATOR_COLORS),
      rules: rules.slice(0, MAX_RULES).filter((rule) => rule && typeof rule === `object`).map((rule) => ({
        op: rule.op === `le` ? `le` : `ge`,
        limit: typeof rule.limit === `number` && Number.isFinite(rule.limit) ? rule.limit : null,
        color: oneOf(rule.color, INDICATOR_COLORS)
      }))
    };
  }

  // The named values of the dashboard cleaned. A value has a name (empty while it is being typed), a kind
  // (`calc` a calculation on a table, `field` a column of the selected row, `expr` an expression of other
  // values), a unit and decimals for its text, and the settings of its kind.
  function cleanValues(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.slice(0, MAX_VALUES).filter((item) => item && typeof item === `object`).map((item) => ({
      name: matching(item.name, NAME_PATTERN),
      kind: oneOf(item.kind, VALUE_KINDS),
      unit: typeof item.unit === `string` ? item.unit.slice(0, MAX_UNIT) : ``,
      decimals: Number.isInteger(item.decimals) && item.decimals >= 0 && item.decimals <= 4 ? item.decimals : -1,
      table: matching(item.table, COLUMN_PATTERN),
      start: matching(item.start, PATH_PATTERN),
      link: item.link === `self` || item.link === `all` ? item.link : matching(item.link, LINK_PATTERN),
      filters: (Array.isArray(item.filters) ? item.filters : []).slice(0, MAX_FILTERS).map(cleanFilter).filter(Boolean),
      fn: oneOf(item.fn, FUNCTIONS),
      path: matching(item.path, PATH_PATTERN),
      expr: typeof item.expr === `string` ? item.expr.slice(0, MAX_EXPRESSION) : ``
    }));
  }

  // Replaces the named values of the model by the cleaned list.
  function setValues(model, values) {
    return { ...model, values: cleanValues(values) };
  }

  // The settings of a block cleaned for its type. The text and table blocks have settings; the other
  // types get an empty object that later versions will fill. Unknown keys are dropped.
  function cleanConfig(type, raw) {
    const source = raw && typeof raw === `object` ? raw : {};
    if (type === `table`) return cleanTable(source);
    if (type === `record`) return cleanRecord(source);
    if (type === `chart`) return cleanChart(source);
    if (type === `indicator`) return cleanIndicator(source);
    if (type === `image`) return cleanImage(source);
    if (type !== `text`) return {};
    return {
      source: oneOf(source.source, TEXT_SOURCES),
      text: typeof source.text === `string` ? source.text.slice(0, MAX_FIXED_TEXT) : ``,
      column: typeof source.column === `string` && COLUMN_PATTERN.test(source.column) ? source.column : ``,
      size: TEXT_SIZES.includes(source.size) ? source.size : `normal`,
      align: oneOf(source.align, TEXT_ALIGNS),
      fill: oneOf(source.fill, FILLS)
    };
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

  // Page settings cleaned: unknown values give the defaults. `numbers` shows the page numbers and `footer` is a free
  // text, both written in the bottom margin of every page.
  function cleanPage(raw) {
    const source = raw && typeof raw === `object` ? raw : {};
    return {
      format: Object.prototype.hasOwnProperty.call(FORMATS, source.format) ? source.format : `screen`,
      orientation: ORIENTATIONS.includes(source.orientation) ? source.orientation : `landscape`,
      margin: MARGINS.includes(source.margin) ? source.margin : DEFAULT_MARGIN,
      numbers: source.numbers === true,
      footer: typeof source.footer === `string` ? source.footer.slice(0, MAX_FOOTER) : ``
    };
  }

  // Puts every block on a valid place: blocks keep their place when it is free, otherwise they go to
  // the first free place. When a block fits nowhere (a smaller format, a saved model that does not fit) a
  // page is added so that no block is lost: this is the only case where pages are added by the program.
  // Blocks are handled in reading order but keep
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
        h: whole(item.h, 1, 1000, size.h),
        config: cleanConfig(item.type, item.config)
      });
    }
    const pages = whole(raw.pages, 1, MAX_PAGES, 1);
    const model = reflow({ version: FORMAT_VERSION, page, pages, blocks, values: cleanValues(raw.values) });
    return { model, warnings: [...new Set(warnings)], locked: false };
  }

  // A block of the model by identifier, or undefined.
  function findBlock(model, id) {
    return model.blocks.find((block) => block.id === id);
  }

  // Adds a block of a type at the first free place of the existing pages. When no page has room, a page is
  // added for it. Returns { model, id, reason } (id is null and reason is `full` when there is no room
  // and no page can be added, `limit` when the number of blocks is reached, `type` for an unknown type).
  function addBlock(model, type) {
    if (!TYPES.includes(type)) return { model, id: null, reason: `type` };
    if (model.blocks.length >= MAX_BLOCKS) return { model, id: null, reason: `limit` };
    const grid = gridOf(model.page);
    const size = clampSize(DEFAULT_SIZES[type], grid);
    let spot = findFreeSpot(model.blocks, size, model.pages, grid);
    let pages = model.pages;
    if (!spot && pages < MAX_PAGES) {
      spot = { page: pages, x: 0, y: 0 };
      pages += 1;
    }
    if (!spot) return { model, id: null, reason: `full` };
    const id = newId(model.blocks);
    const block = { id, type, title: ``, ...spot, ...size, config: cleanConfig(type, {}) };
    return { model: { ...model, pages, blocks: [...model.blocks, block] }, id, reason: `` };
  }

  // Removes the pages that hold no block, so that no blank page stays: the blocks of the following pages
  // move up and the pages are numbered again. The pages of the list `keep` (the pages that the rest of a
  // long table uses) stay even without a block. A model without block keeps one page.
  function compactPages(model, keep) {
    const used = new Set(model.blocks.map((block) => block.page));
    for (const page of keep || []) {
      if (page >= 0 && page < model.pages) used.add(page);
    }
    const sorted = [...used].sort((a, b) => a - b);
    const pages = Math.max(1, sorted.length);
    const same = pages === model.pages && sorted.every((page, index) => page === index);
    if (same) return model;
    const renumbered = new Map(sorted.map((page, index) => [page, index]));
    return { ...model, pages, blocks: model.blocks.map((block) => ({ ...block, page: renumbered.get(block.page) })) };
  }

  // Changes the title, the type or the settings of a block. A new type starts with default settings.
  function updateBlock(model, id, changes) {
    const block = findBlock(model, id);
    if (!block) return model;
    const next = { ...block };
    if (typeof changes.title === `string`) next.title = changes.title.slice(0, MAX_TITLE);
    if (TYPES.includes(changes.type) && changes.type !== block.type) {
      next.type = changes.type;
      // What the two types have in common (a table and a chart share their data) is kept; the rest starts again.
      next.config = cleanConfig(changes.type, block.config);
    }
    if (changes.config && typeof changes.config === `object`) next.config = cleanConfig(next.type, { ...next.config, ...changes.config });
    return { ...model, blocks: model.blocks.map((item) => (item.id === id ? next : item)) };
  }

  // Moves a block towards a wanted place { page, x, y }: it goes to the valid place closest to it. The
  // wanted page can be a page after the last one, up to `lastPage` (the pages that are drawn, empty ones
  // included): the pages up to it then exist. When the wanted page has no room for it, the model is
  // returned unchanged.
  function moveBlock(model, id, wanted, lastPage) {
    const block = findBlock(model, id);
    const limit = Math.min(MAX_PAGES - 1, Math.max(model.pages - 1, Number.isInteger(lastPage) ? lastPage : 0));
    if (!block || wanted.page < 0 || wanted.page > limit) return model;
    const spot = resolveMove(model.blocks, block, wanted, gridOf(model.page));
    if (!spot) return model;
    return { ...model, pages: Math.max(model.pages, spot.page + 1), blocks: model.blocks.map((item) => (item.id === id ? { ...item, ...spot } : item)) };
  }

  // Resizes a block towards a wanted size { w, h }: it gets the valid size closest to it.
  function resizeBlock(model, id, wanted, keepRatio) {
    const block = findBlock(model, id);
    if (!block) return model;
    const size = resolveResize(model.blocks, block, wanted, gridOf(model.page), keepRatio);
    return { ...model, blocks: model.blocks.map((item) => (item.id === id ? { ...item, ...size } : item)) };
  }

  // Removes a block. A page that becomes empty is removed later by `compactPages`.
  function deleteBlock(model, id) {
    return { ...model, blocks: model.blocks.filter((block) => block.id !== id) };
  }

  // Changes the page settings (format, orientation, margin) and puts the blocks back in place.
  function setPage(model, changes) {
    return reflow({ ...model, page: cleanPage({ ...model.page, ...changes }) });
  }

  const api = { FORMAT_VERSION, MAX_BLOCKS, MAX_TITLE, MAX_FIXED_TEXT, MAX_COLUMNS, MAX_FILTERS, MAX_GROUPS, TABLE_MODES, SLICES, FUNCTIONS, OPERATORS, SORT_BYS, TYPES, MAX_RECORD_ITEMS, RECORD_COLUMNS, MAX_VALUES, CHART_TYPES, CHART_PALETTES, CHART_LEGENDS, CHART_LABELS, INDICATOR_COLORS, MAX_RULES, MAX_NOTE, MAX_IMAGE_RANK, MAX_FOOTER, VALUE_KINDS, NAME_PATTERN, cleanValues, setValues, TEXT_SOURCES, TEXT_SIZES, TEXT_ALIGNS, FILLS, DEFAULT_SIZES, emptyModel, cleanConfig, validateModel, reflow, findBlock, addBlock, compactPages, updateBlock, moveBlock, resizeBlock, deleteBlock, setPage };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbModel = api;
})(typeof window !== `undefined` ? window : globalThis);
