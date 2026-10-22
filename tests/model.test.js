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
  assert.deepEqual(model.page, { format: `screen`, orientation: `landscape`, margin: 10 });
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
  assert.deepEqual(M.validateModel({ version: 1, page: { format: `a3`, orientation: `portrait`, margin: 5 } }).model.page, { format: `a3`, orientation: `portrait`, margin: 5 });
  assert.deepEqual(M.validateModel({ version: 1, page: { format: `<b>`, orientation: 3, margin: 7 } }).model.page, { format: `screen`, orientation: `landscape`, margin: 10 });
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

test(`a new block takes the first free place and a page is added when there is no room`, () => {
  let model = M.emptyModel();
  const first = M.addBlock(model, `text`);
  model = first.model;
  assert.deepEqual([model.blocks[0].page, model.blocks[0].x, model.blocks[0].y], [0, 0, 0]);
  const second = M.addBlock(model, `text`);
  assert.deepEqual([second.model.blocks[1].x, second.model.blocks[1].y], [model.blocks[0].w, 0]);
  model = second.model;
  for (let i = 0; i < 30; i += 1) model = M.addBlock(model, `table`).model;
  assertValid(model);
  assert.ok(model.pages > 1);
});

test(`an unknown type adds nothing`, () => {
  const model = M.emptyModel();
  assert.equal(M.addBlock(model, `video`).id, null);
});

test(`deleting the last block of the last page removes the empty page but keeps one page`, () => {
  let model = M.addPage(M.addPage(M.emptyModel()));
  assert.equal(model.pages, 3);
  const added = M.addBlock(model, `text`);
  model = M.deleteBlock(added.model, added.id);
  assert.equal(model.pages, 1);
  assert.deepEqual(M.deleteBlock(M.emptyModel(), `nothing`).blocks, []);
});

test(`moving a block towards another block goes to a valid place, and may change page`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  const b = M.addBlock(a.model, `text`);
  model = M.moveBlock(b.model, b.id, { page: 0, x: 0, y: 0 });
  assertValid(model);
  model = M.addPage(model);
  model = M.moveBlock(model, b.id, { page: 1, x: 3, y: 2 });
  assert.deepEqual([M.findBlock(model, b.id).page, M.findBlock(model, b.id).x, M.findBlock(model, b.id).y], [1, 3, 2]);
  assert.equal(M.moveBlock(model, b.id, { page: 7, x: 0, y: 0 }), model);
});

test(`changing the format puts the blocks back in place without overlap`, () => {
  let model = M.emptyModel();
  for (let i = 0; i < 6; i += 1) model = M.addBlock(model, i % 2 ? `chart` : `table`).model;
  for (const changes of [{ format: `a5`, orientation: `portrait` }, { format: `a3`, orientation: `landscape` }, { format: `square`, margin: 20 }, { format: `screen`, margin: 0 }]) {
    model = M.setPage(model, changes);
    assertValid(model);
    assert.equal(model.blocks.length, 6);
  }
});

test(`the geometry from the settings panel is resolved like a move`, () => {
  let model = M.emptyModel();
  const a = M.addBlock(model, `text`);
  const b = M.addBlock(a.model, `text`);
  model = M.setGeometry(b.model, b.id, { x: 0, y: 0, w: 30, h: 10 });
  assertValid(model);
  assert.equal(M.findBlock(model, b.id).w, 30);
  model = M.updateBlock(model, b.id, { title: `Titre`, type: `chart` });
  assert.equal(M.findBlock(model, b.id).title, `Titre`);
  assert.equal(M.findBlock(model, b.id).type, `chart`);
  assert.equal(M.findBlock(model, b.id).w, 30);
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
  for (let i = 0; i < 9; i += 1) model = M.addBlock(model, M.TYPES[i % 5]).model;
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
      if (roll < 0.25) model = M.addBlock(model, M.TYPES[Math.floor(next() * 5)]).model;
      else if (roll < 0.4) model = M.moveBlock(model, pick, { page: Math.floor(next() * model.pages), x: Math.floor(next() * 60) - 5, y: Math.floor(next() * 40) - 5 });
      else if (roll < 0.55) model = M.resizeBlock(model, pick, { w: Math.floor(next() * 60), h: Math.floor(next() * 40) }, next() < 0.5);
      else if (roll < 0.65) model = M.deleteBlock(model, pick);
      else if (roll < 0.72) model = M.addPage(model);
      else if (roll < 0.82) model = M.setPage(model, { format: Object.keys(L.FORMATS)[Math.floor(next() * 5)], orientation: L.ORIENTATIONS[Math.floor(next() * 2)], margin: L.MARGINS[Math.floor(next() * 5)] });
      else if (roll < 0.9) model = M.setGeometry(model, pick, { page: Math.floor(next() * model.pages), x: Math.floor(next() * 50), y: Math.floor(next() * 30), w: 2 + Math.floor(next() * 40), h: 2 + Math.floor(next() * 20) });
      else model = M.validateModel(JSON.parse(JSON.stringify(model))).model;
      assertValid(model);
    }
  }
});
