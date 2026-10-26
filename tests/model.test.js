// Tests of the dashboard model: cleaning of what comes from outside, and the changes of the model.
const test = require(`node:test`);
const assert = require(`node:assert/strict`);
const M = require(`../model.js`);
const L = require(`../layout.js`);

// Checks that no block leaves its page or meets another one, and that the pages hold every block.
function assertValid(model) {
  const grid = L.gridOf(model.page);
  assert.ok(model.pages >= 1 && model.pages <= L.MAX_PAGES);
  for (const block of model.blocks) {
    assert.ok(L.fits(block, grid), `block outside the page`);
    assert.ok(block.page >= 0 && block.page < model.pages, `block on a missing page`);
    assert.ok(M.TYPES.includes(block.type));
    for (const other of model.blocks) if (other.id !== block.id) assert.equal(L.overlaps(block, other), false, `overlap`);
  }
  assert.equal(new Set(model.blocks.map((block) => block.id)).size, model.blocks.length, `duplicate ids`);
}

test(`nothing saved gives an empty model with one screen page`, () => {
  const { model, warnings, locked } = M.validateModel(null);
  assert.deepEqual(model, M.emptyModel());
  assert.deepEqual(model.page, { format: `screen`, orientation: `landscape`, margin: 10, numbers: false, footer: ``, palette: `classic` });
  assert.equal(model.pages, 1);
  assert.deepEqual(warnings, []);
  assert.equal(locked, false);
});

test(`something that is not a model is refused with a warning`, () => {
  for (const bad of [`text`, 12, [], true]) {
    const result = M.validateModel(bad);
    assert.deepEqual(result.model, M.emptyModel());
    assert.deepEqual(result.warnings, [`invalid`]);
  }
});

test(`a model from a newer version is not read and is locked`, () => {
  const result = M.validateModel({ version: 99, blocks: [{ type: `text` }] });
  assert.equal(result.locked, true);
  assert.deepEqual(result.warnings, [`version`]);
  assert.equal(result.model.blocks.length, 0);
});

test(`unknown page settings give the defaults and valid ones are kept`, () => {
  assert.deepEqual(M.validateModel({ version: 1, page: { format: `a3`, orientation: `portrait`, margin: 5, numbers: true, footer: `Report`, palette: `warm` } }).model.page, { palette: `warm`, format: `a3`, orientation: `portrait`, margin: 5, numbers: true, footer: `Report` });
  assert.deepEqual(M.validateModel({ version: 1, page: { format: `<b>`, orientation: 3, margin: 7, numbers: `yes`, footer: 5 } }).model.page, { format: `screen`, orientation: `landscape`, margin: 10, numbers: false, footer: ``, palette: `classic` });
  assert.equal(M.validateModel({ version: 1, page: { footer: `x`.repeat(500) } }).model.page.footer.length, M.MAX_FOOTER);
});

test(`blocks are cleaned: type, title, numbers and ids`, () => {
  const { model, warnings } = M.validateModel({
    version: 1,
    blocks: [
      { id: `ab12`, type: `text`, title: `x`.repeat(500), page: 0, x: 1, y: 1, w: 10, h: 5 },
      { id: `<script>`, type: `chart`, title: 5, page: 0, x: `a`, y: null, w: NaN, h: -4 },
      { id: `ab12`, type: `table`, page: 0, x: 0, y: 20, w: 8, h: 4 },
      { type: `video` },
      null
    ]
  });
  assertValid(model);
  assert.equal(model.blocks.length, 3);
  assert.equal(M.findBlock(model, `ab12`).title.length, M.MAX_TITLE);
  assert.ok(model.blocks.every((block) => /^[a-z0-9]{1,24}$/.test(block.id)));
  assert.ok(warnings.includes(`invalid`));
});

test(`overlapping or oversize blocks are put back on valid places, with pages added if needed`, () => {
  const blocks = [];
  for (let i = 0; i < 12; i += 1) blocks.push({ id: `b${i}`, type: `table`, page: 0, x: 0, y: 0, w: 999, h: 999 });
  const { model } = M.validateModel({ version: 1, blocks });
  assertValid(model);
  assert.equal(model.blocks.length, 12);
  assert.equal(model.pages, 12);
});

test(`too many blocks are cut with a warning`, () => {
  const blocks = Array.from({ length: M.MAX_BLOCKS + 5 }, (_, i) => ({ id: `b${i}`, type: `indicator`, page: 0, x: 0, y: 0, w: 2, h: 2 }));
  const { model, warnings } = M.validateModel({ version: 1, blocks });
  assert.equal(model.blocks.length, M.MAX_BLOCKS);
  assert.ok(warnings.includes(`blocks`));
  assertValid(model);
});

test(`a new block takes the first free place and a page is added when no page has room`, () => {
  let model = M.emptyModel();
  const first = M.addBlock(model, `text`);
  model = first.model;
  assert.deepEqual([model.blocks[0].page, model.blocks[0].x, model.blocks[0].y], [0, 0, 0]);
  const second = M.addBlock(model, `text`);
  assert.deepEqual([second.model.blocks[1].x, second.model.blocks[1].y], [model.blocks[0].w, 0]);
  model = second.model;
  let added = null;
  for (let i = 0; i < 30 && !added; i += 1) {
    const result = M.addBlock(model, `table`);
    assert.ok(result.id);
    if (result.model.pages > model.pages) added = result;
    model = result.model;
  }
  assert.ok(added, `no page was added`);
  assert.equal(M.findBlock(added.model, added.id).page, 1);
  assert.equal(added.model.pages, 2);
  assertValid(model);
});

test(`no block can be added once the pages and the blocks are at their limit`, () => {
  let model = M.emptyModel();
  let last = null;
  for (let i = 0; i < M.MAX_BLOCKS + 5 && (!last || last.id); i += 1) {
    last = M.addBlock(model, `table`);
    if (last.id) model = last.model;
  }
  assert.ok(model.pages <= 40 && model.blocks.length <= M.MAX_BLOCKS);
  assert.ok([`full`, `limit`].includes(last.reason));
  assertValid(model);
});

test(`an unknown type adds nothing`, () => {
  const model = M.emptyModel();
  const result = M.addBlock(model, `video`);
  assert.equal(result.id, null);
  assert.equal(result.reason, `type`);
});

test(`a page without block is removed, the next pages move up and one page always stays`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `table`);
  const b = M.addBlock(a.model, `table`);
  const c = M.addBlock(b.model, `table`);
  model = c.model;
  assert.ok(model.pages >= 2);
  const pageOf = (id) => M.findBlock(model, id).page;
  const high = Math.max(pageOf(a.id), pageOf(b.id), pageOf(c.id));
  model = M.deleteBlock(model, c.id);
  model = M.compactPages(model, []);
  assert.equal(model.pages, new Set([pageOf(a.id), pageOf(b.id)]).size);
  assert.ok(Math.max(pageOf(a.id), pageOf(b.id)) <= high);
  const none = M.compactPages(M.deleteBlock(M.deleteBlock(model, a.id), b.id), []);
  assert.equal(none.pages, 1);
  assert.deepEqual(M.compactPages(M.emptyModel(), []).pages, 1);
  const gap = { ...M.emptyModel(), pages: 3, blocks: [{ ...a.model.blocks[0], page: 0 }, { ...a.model.blocks[0], id: `zz`, page: 2 }] };
  const packed = M.compactPages(gap, []);
  assert.equal(packed.pages, 2);
  assert.deepEqual(packed.blocks.map((block) => block.page), [0, 1]);
  assert.equal(M.compactPages(gap, [1]).pages, 3);
  assert.equal(M.compactPages(gap, [5]).pages, 2);
  const same = M.compactPages(a.model, []);
  assert.equal(same, a.model);
});

test(`a block with no title and no content still keeps its page`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  let spread = { ...a.model, pages: 2, blocks: [...a.model.blocks, { ...a.model.blocks[0], id: `empty1`, page: 1 }] };
  spread = M.compactPages(spread, []);
  assert.equal(spread.pages, 2);
});

test(`a block can be moved to a page after the last one, which then exists`, () => {
  const a = M.addBlock(M.emptyModel(), `text`);
  const unchanged = M.moveBlock(a.model, a.id, { page: 1, x: 0, y: 0 });
  assert.equal(unchanged, a.model);
  const moved = M.moveBlock(a.model, a.id, { page: 1, x: 0, y: 0 }, 1);
  assert.equal(M.findBlock(moved, a.id).page, 1);
  assert.equal(moved.pages, 2);
  assert.equal(M.moveBlock(a.model, a.id, { page: 3, x: 0, y: 0 }, 1), a.model);
});

test(`moving a block or deleting one never changes the number of pages by itself`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  model = M.moveBlock(a.model, a.id, { page: 1, x: 2, y: 2 }, 1);
  assert.equal(model.pages, 2);
  model = M.moveBlock(model, a.id, { page: 0, x: 0, y: 0 });
  assert.equal(model.pages, 2);
  assert.equal(M.deleteBlock(model, a.id).pages, 2);
});

test(`moving a block towards another block goes to a valid place, and may change page`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  const b = M.addBlock(a.model, `text`);
  model = M.moveBlock(b.model, b.id, { page: 0, x: 0, y: 0 });
  assertValid(model);
  model = M.moveBlock(model, b.id, { page: 1, x: 3, y: 2 }, 1);
  assert.deepEqual([M.findBlock(model, b.id).page, M.findBlock(model, b.id).x, M.findBlock(model, b.id).y], [1, 3, 2]);
  assert.equal(M.moveBlock(model, b.id, { page: 7, x: 0, y: 0 }), model);
});

test(`changing the format puts the blocks back in place without overlap`, () => {
  let model = M.emptyModel();
  for (let i = 0; i < 6; i += 1) model = M.addBlock(model, i % 2 ? `chart` : `table`).model;
  assert.equal(model.blocks.length, 6);
  for (const changes of [{ format: `a5`, orientation: `portrait` }, { format: `a3`, orientation: `landscape` }, { format: `square`, margin: 20 }, { format: `screen`, margin: 0 }]) {
    model = M.setPage(model, changes);
    assertValid(model);
    assert.equal(model.blocks.length, 6);
  }
});

test(`the title and the type of a block are changed without moving it`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  model = M.updateBlock(a.model, a.id, { title: `Titre`, type: `chart` });
  assert.equal(M.findBlock(model, a.id).title, `Titre`);
  assert.equal(M.findBlock(model, a.id).type, `chart`);
  assert.deepEqual([M.findBlock(model, a.id).x, M.findBlock(model, a.id).y], [0, 0]);
});

test(`the settings of a text block are cleaned and the other types have none`, () => {
  const { model } = M.validateModel({
    version: 1,
    blocks: [
      { id: `t1`, type: `text`, page: 0, x: 0, y: 0, w: 10, h: 4, config: { source: `cell`, text: `hello`, column: `Notes`, size: `large`, align: `justify`, fill: `green`, extra: 1 } },
      { id: `t2`, type: `text`, page: 0, x: 0, y: 5, w: 10, h: 4, config: { source: `other`, text: 5, column: `bad name`, size: `huge`, align: `x`, fill: `#ff0000` } },
      { id: `t3`, type: `text`, page: 0, x: 0, y: 10, w: 10, h: 4 },
      { id: `c1`, type: `image`, page: 0, x: 0, y: 15, w: 10, h: 4, config: { source: `cell` } }
    ]
  });
  assert.deepEqual(M.findBlock(model, `t1`).config, { source: `cell`, text: `hello`, column: `Notes`, size: `large`, align: `justify`, fill: `green` });
  assert.deepEqual(M.findBlock(model, `t2`).config, { source: `fixed`, text: ``, column: ``, size: `normal`, align: `left`, fill: `none` });
  assert.deepEqual(M.findBlock(model, `t3`).config, { source: `fixed`, text: ``, column: ``, size: `normal`, align: `left`, fill: `none` });
  assert.deepEqual(M.findBlock(model, `c1`).config, { path: ``, rank: 1, caption: `` });
  const long = M.cleanConfig(`text`, { text: `x`.repeat(9000) });
  assert.equal(long.text.length, M.MAX_FIXED_TEXT);
});

test(`changing the settings keeps the others, and a new type starts with default settings`, () => {
  let model = M.addBlock(M.emptyModel(), `text`).model;
  const id = model.blocks[0].id;
  model = M.updateBlock(model, id, { config: { text: `Bonjour {Name}`, align: `center` } });
  model = M.updateBlock(model, id, { config: { size: `small` } });
  assert.deepEqual(M.findBlock(model, id).config, { source: `fixed`, text: `Bonjour {Name}`, column: ``, size: `small`, align: `center`, fill: `none` });
  model = M.updateBlock(model, id, { type: `image` });
  assert.deepEqual(M.findBlock(model, id).config, { path: ``, rank: 1, caption: `` });
  model = M.updateBlock(model, id, { type: `text` });
  assert.equal(M.findBlock(model, id).config.text, ``);
});

test(`the settings of a table block are cleaned`, () => {
  const config = M.cleanConfig(`table`, {
    mode: `group`, start: `Building`, table: `Rooms`, link: `Rooms.Site>Sites.Parent`, groupBy: [`Usage`, `bad path`, `x`], merge: true,
    columns: [{ path: `Area`, fn: `sum`, label: `L`.repeat(100) }, { path: `bad path`, fn: `nope` }, `text`, null],
    filters: [{ path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } }, { path: `Area`, op: `evil` }, { path: `A`, op: `eq`, value: { kind: `field`, path: `B.C` } }, { path: `A`, op: `empty` }, { path: `A`, op: `eq` }],
    sort: { by: `value`, column: `Area`, dir: `desc` }, total: true, decimals: 2, extra: 1
  });
  assert.deepEqual(Object.keys(config).sort(), [`colItem`, `colSort`, `columns`, `decimals`, `filters`, `groupBy`, `labelTemplate`, `link`, `merge`, `mode`, `slice`, `sort`, `start`, `subtotals`, `table`, `total`, `totalLabel`, `totalRight`, `totalRightFn`]);
  assert.equal(config.mode, `group`);
  assert.equal(M.cleanConfig(`table`, { mode: `group` }).mode, `list`);
  assert.equal(M.cleanConfig(`table`, { mode: `list`, groupBy: [`Usage`] }).mode, `group`);
  assert.deepEqual(config.groupBy, [`Usage`, ``]);
  assert.equal(config.columns.length, 2);
  assert.equal(config.columns[0].label.length, 60);
  assert.deepEqual(config.columns[1], { path: ``, fn: ``, label: `` });
  assert.equal(config.filters.length, 2);
  assert.deepEqual(config.filters[0], { path: `Area`, op: `gt`, value: { kind: `const`, value: 10 } });
  assert.deepEqual(config.filters[1].value, { kind: `field`, path: `B.C` });
  assert.equal(config.link, `Rooms.Site>Sites.Parent`);
  assert.deepEqual(config.sort, { by: `value`, column: `Area`, dir: `desc`, order: [] });
  assert.equal(config.decimals, 2);
  assert.equal(M.cleanConfig(`table`, { link: `<x>` }).link, ``);
  assert.equal(M.cleanConfig(`table`, { link: `all` }).link, `all`);
  assert.equal(M.cleanConfig(`table`, { decimals: 99 }).decimals, -1);
});

test(`a new table block has the default settings`, () => {
  const model = M.addBlock(M.emptyModel(), `table`).model;
  assert.deepEqual(model.blocks[0].config, M.cleanConfig(`table`, {}));
  assert.equal(M.validateModel(JSON.parse(JSON.stringify(model))).model.blocks[0].config.mode, `list`);
});

test(`the functions do not change the model they receive`, () => {
  const model = M.addBlock(M.emptyModel(), `table`).model;
  const copy = JSON.stringify(model);
  const id = model.blocks[0].id;
  M.moveBlock(model, id, { page: 0, x: 4, y: 4 });
  M.resizeBlock(model, id, { w: 5, h: 5 }, false);
  M.updateBlock(model, id, { title: `t` });
  M.setPage(model, { format: `a5` });
  M.deleteBlock(model, id);
  M.addBlock(model, `text`);
  assert.equal(JSON.stringify(model), copy);
});

test(`a model that is saved and read again is the same`, () => {
  let model = M.emptyModel();
  for (let i = 0; i < 9; i += 1) model = M.addBlock(model, M.TYPES[i % 6]).model;
  model = M.updateBlock(model, model.blocks[0].id, { title: `Étage d'accueil` });
  const again = M.validateModel(JSON.parse(JSON.stringify(model))).model;
  assert.deepEqual(again, model);
});

// A small random generator, so that the test is the same on every run.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test(`random sequences of changes always leave a valid model`, () => {
  for (let seed = 1; seed <= 150; seed += 1) {
    const next = random(seed);
    let model = M.emptyModel();
    for (let step = 0; step < 60; step += 1) {
      const roll = next();
      const ids = model.blocks.map((block) => block.id);
      const pick = ids.length ? ids[Math.floor(next() * ids.length)] : `none`;
      if (roll < 0.25) model = M.addBlock(model, M.TYPES[Math.floor(next() * 6)]).model;
      else if (roll < 0.4) model = M.moveBlock(model, pick, { page: Math.floor(next() * (model.pages + 1)), x: Math.floor(next() * 60) - 5, y: Math.floor(next() * 40) - 5 }, model.pages);
      else if (roll < 0.55) model = M.resizeBlock(model, pick, { w: Math.floor(next() * 60), h: Math.floor(next() * 40) }, next() < 0.5);
      else if (roll < 0.65) model = M.deleteBlock(model, pick);
      else if (roll < 0.72) model = M.compactPages(model, []);
      else if (roll < 0.82) model = M.setPage(model, { format: Object.keys(L.FORMATS)[Math.floor(next() * 5)], orientation: L.ORIENTATIONS[Math.floor(next() * 2)], margin: L.MARGINS[Math.floor(next() * 5)] });
      else model = M.validateModel(JSON.parse(JSON.stringify(model))).model;
      assertValid(model);
    }
  }
});

test(`the decimals of a column are kept only between automatic (-1) and 4`, () => {
  const columns = M.cleanConfig(`table`, { columns: [{ path: `A`, decimals: 3 }, { path: `B`, decimals: -1 }, { path: `C`, decimals: 9 }, { path: `D`, decimals: `2` }, { path: `E` }] }).columns;
  assert.deepEqual(columns.map((column) => column.decimals), [3, -1, undefined, undefined, undefined]);
});

test(`the imposed order of the labels keeps texts without duplicates and the new sort kinds are accepted`, () => {
  const sort = M.cleanConfig(`table`, { sort: { by: `manual`, order: [`RDC`, `R+1`, `RDC`, 3, `x`.repeat(500), `TT`] } }).sort;
  assert.equal(sort.by, `manual`);
  assert.deepEqual(sort.order, [`RDC`, `R+1`, `TT`]);
  assert.equal(M.cleanConfig(`table`, { sort: { by: `ref` } }).sort.by, `ref`);
  assert.equal(M.cleanConfig(`table`, { sort: { by: `nothing` } }).sort.by, M.cleanConfig(`table`, {}).sort.by);
  assert.deepEqual(M.cleanConfig(`table`, { sort: { order: `x` } }).sort.order, []);
});

test(`the settings of an indicator block are cleaned`, () => {
  const clean = M.cleanConfig(`indicator`, { value: `ratio`, note: `n`.repeat(400), size: `large`, base: `blue`, rules: [{ op: `le`, limit: 5, color: `green` }, { op: `x`, limit: `3`, color: `pink` }, null, { op: `ge`, limit: 10, color: `red` }, {}, {}, {}] });
  assert.equal(clean.value, `ratio`);
  assert.equal(clean.note.length, M.MAX_NOTE);
  assert.deepEqual([clean.size, clean.base], [`large`, `blue`]);
  assert.equal(clean.rules.length, 3);
  assert.equal(M.cleanConfig(`indicator`, { rules: Array.from({ length: 9 }, () => ({ op: `ge`, limit: 1, color: `red` })) }).rules.length, M.MAX_RULES);
  assert.deepEqual(clean.rules[0], { op: `le`, limit: 5, color: `green` });
  assert.deepEqual(clean.rules[1], { op: `ge`, limit: null, color: `none` });
  assert.deepEqual(M.cleanConfig(`indicator`, {}), { value: ``, note: ``, size: `normal`, base: `none`, rules: [] });
  assert.equal(M.cleanConfig(`indicator`, { value: `bad name` }).value, ``);
});

test(`a table with an item in lines and an item in columns is a cross table`, () => {
  assert.equal(M.cleanConfig(`table`, { groupBy: [`A`], colItem: `B` }).mode, `cross`);
  assert.equal(M.cleanConfig(`table`, { groupBy: [`A`] }).mode, `group`);
  assert.equal(M.cleanConfig(`table`, { colItem: `B` }).mode, `list`);
  const config = M.cleanConfig(`table`, { groupBy: [`A`], colItem: `B.C`, colSort: `ref`, slice: 6 });
  assert.deepEqual([config.colItem, config.colSort, config.slice], [`B.C`, `ref`, 6]);
  const bad = M.cleanConfig(`table`, { colItem: `bad path`, colSort: `x`, slice: 7 });
  assert.deepEqual([bad.colItem, bad.colSort, bad.slice], [``, `key`, 0]);
});

test(`the settings of a chart block are the settings of a table block and the settings of the drawing`, () => {
  const config = M.cleanConfig(`chart`, { table: `Rooms`, groupBy: [`Usage`], chart: `donut`, legend: `right`, labels: `percent`, columns: [{ path: `Area`, fn: `sum` }] });
  assert.deepEqual([config.chart, config.legend, config.labels, config.mode, config.table], [`donut`, `right`, `percent`, `group`, `Rooms`]);
  assert.equal(config.palette, undefined);
  assert.equal(config.columns.length, 1);
  assert.deepEqual(M.cleanConfig(`chart`, {}).chart, `bar`);
  const bad = M.cleanConfig(`chart`, { chart: `radar`, palette: `x`, legend: `diagonal`, labels: `all` });
  assert.deepEqual([bad.chart, bad.legend, bad.labels], [`bar`, `bottom`, `none`]);
  assert.equal(M.cleanConfig(`chart`, { legend: `none` }).legend, `none`);
  const options = require(`../chart-option.js`);
  assert.deepEqual(M.CHART_TYPES, options.CHART_TYPES);
  assert.deepEqual(M.CHART_PALETTES, options.PALETTE_KEYS);
  assert.deepEqual(M.CHART_LEGENDS, options.LEGENDS);
  assert.deepEqual(M.CHART_LABELS, options.LABELS);
});

test(`the settings of an image block are cleaned`, () => {
  assert.deepEqual(M.cleanConfig(`image`, { path: `Site.Photo`, rank: 3, caption: `Site.Name`, extra: 1 }), { path: `Site.Photo`, rank: 3, caption: `Site.Name` });
  assert.deepEqual(M.cleanConfig(`image`, { path: `bad name`, rank: 0, caption: 5 }), { path: ``, rank: 1, caption: `` });
  assert.equal(M.cleanConfig(`image`, { rank: 21 }).rank, 1);
  assert.equal(M.cleanConfig(`image`, { caption: `Photo of {Name}` }).caption, ``);
});

test(`the new kinds of chart are kept and an unknown one is not`, () => {
  for (const kind of [`area`, `treemap`, `scatter`]) assert.equal(M.cleanConfig(`chart`, { chart: kind }).chart, kind);
  assert.equal(M.cleanConfig(`chart`, { chart: `radar` }).chart, `bar`);
});

test(`the palette is a setting of the page, and a dashboard saved before takes the palette of its first chart`, () => {
  assert.equal(M.validateModel({ version: 1, page: { palette: `blue` } }).model.page.palette, `blue`);
  assert.equal(M.validateModel({ version: 1, page: { palette: `nothing` } }).model.page.palette, `classic`);
  const chart = (palette) => ({ id: `c1`, type: `chart`, page: 0, x: 0, y: 0, w: 10, h: 8, config: { palette } });
  assert.equal(M.validateModel({ version: 1, page: {}, blocks: [chart(`douce`)] }).model.page.palette, `pastel`);
  assert.equal(M.validateModel({ version: 1, page: {}, blocks: [chart(`froide`)] }).model.page.palette, `cool`);
  assert.equal(M.validateModel({ version: 1, page: {}, blocks: [chart(`franche`)] }).model.page.palette, `classic`);
  assert.equal(M.validateModel({ version: 1, page: {}, blocks: [chart(`red`)] }).model.page.palette, `red`);
  assert.equal(M.validateModel({ version: 1, page: { palette: `grey` }, blocks: [chart(`douce`)] }).model.page.palette, `grey`);
  assert.equal(M.setPage(M.emptyModel(), { palette: `acid` }).page.palette, `acid`);
});

test(`a record block no longer keeps a number of columns, and the label of the total is cut to its length`, () => {
  assert.equal(M.RECORD_COLUMNS, undefined);
  assert.equal(`columns` in M.cleanConfig(`record`, { columns: 5 }), false);
  assert.equal(M.cleanConfig(`table`, { totalLabel: `x`.repeat(200) }).totalLabel.length, 60);
  assert.equal(M.cleanConfig(`table`, { totalLabel: 5 }).totalLabel, ``);
});
