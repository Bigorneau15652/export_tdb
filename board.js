// The dashboard tab (version 0.3): draws the pages and the blocks, lets the user add, move, resize
// and delete blocks with the pointer or the keyboard, edits the title and the type of a block in a
// settings panel, and saves the model in the options of the widget. The blocks are empty frames for
// now: their content comes in the next versions. Rules about places, collisions and cleaning are in
// layout.js and model.js; this file only draws and listens.
(function () {
  const { t } = window.exportTdbI18n;
  const Layout = window.exportTdbLayout;
  const Model = window.exportTdbModel;
  const access = window.exportTdbAccess;
  const { STEP_MM } = Layout;

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const DRAG_DISTANCE = 4;
  const SAVE_DELAY_MS = 400;
  const TYPE_KEYS = { text: `typeText`, table: `typeTable`, chart: `typeChart`, image: `typeImage`, indicator: `typeIndicator` };
  const FORMAT_KEYS = { screen: `formatScreen`, a3: `formatA3`, a4: `formatA4`, a5: `formatA5`, square: `formatSquare` };
  const ORIENTATION_KEYS = { landscape: `orientationLandscape`, portrait: `orientationPortrait` };
  const WARNING_KEYS = { version: `boardWarnVersion`, invalid: `boardWarnInvalid`, blocks: `boardWarnBlocks` };
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const $ = (id) => document.getElementById(id);
  const el = {
    panel: $(`panelBoard`), notice: $(`boardNotice`), edit: $(`boardEdit`), tools: $(`boardTools`), help: $(`boardHelp`),
    addType: $(`boardAddType`), add: $(`boardAdd`), addPage: $(`boardAddPage`), format: $(`boardFormat`),
    orientation: $(`boardOrientation`), margin: $(`boardMargin`), zoomOut: $(`boardZoomOut`), zoomFit: $(`boardZoomFit`),
    zoomIn: $(`boardZoomIn`), saveState: $(`boardSaveState`), confirm: $(`boardConfirm`), confirmText: $(`boardConfirmText`),
    confirmYes: $(`boardConfirmYes`), confirmNo: $(`boardConfirmNo`), scroll: $(`boardScroll`), canvas: $(`boardCanvas`),
    side: $(`boardPanel`), title: $(`boardTitle`), type: $(`boardType`), page: $(`boardPage`), x: $(`boardX`), y: $(`boardY`),
    w: $(`boardW`), h: $(`boardH`), remove: $(`boardDelete`), close: $(`boardClose`)
  };

  let model = Model.emptyModel();
  let locked = false;
  let editing = false;
  let selectedId = null;
  let panelOpen = false;
  let zoomIndex = ZOOMS.indexOf(1);
  let drag = null;
  let saveTimer = null;
  // Pixels per millimetre of the page on the screen.
  let mmPx = 1;

  // ------------------------------------------------------------------ Helpers

  // Translated text with `{name}` values (short name used all over this file).
  const tr = (key, values) => t(key, values);

  // The block of the model that is selected, or undefined.
  const selectedBlock = () => (selectedId ? Model.findBlock(model, selectedId) : undefined);

  // The text shown for the title of a block: its title or a grey placeholder.
  const blockTitle = (block) => block.title || tr(`boardNoTitle`);

  // Fills a select element with [value, label] pairs and selects `value`.
  function fillSelect(select, items, value) {
    select.textContent = ``;
    for (const [optionValue, label] of items) {
      const option = document.createElement(`option`);
      option.value = String(optionValue);
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = String(value);
  }

  // ------------------------------------------------------------------ Saving

  // Shows the result of the last save.
  function showSaveState(ok) {
    el.saveState.textContent = ok === null ? `` : ok ? tr(`boardSaved`) : tr(`boardSaveFailed`);
    el.saveState.className = ok === false ? `warning` : `hint`;
  }

  // Saves the model a short time after the last change, so that a drag makes one save.
  function scheduleSave() {
    if (locked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      showSaveState(await access.saveModel(model));
    }, SAVE_DELAY_MS);
  }

  // Replaces the model by a new one, draws it and saves it.
  function commit(next, options = {}) {
    if (next === model) {
      render(options);
      return;
    }
    model = next;
    if (selectedId && !Model.findBlock(model, selectedId)) selectedId = null;
    render(options);
    scheduleSave();
  }

  // ------------------------------------------------------------------ Drawing

  // Computes the scale so that the page fills the width of the area, times the zoom.
  function computeScale() {
    const size = Layout.pageSizeMm(model.page.format, model.page.orientation);
    const available = Math.max(120, el.scroll.clientWidth - 2);
    mmPx = (available / size.w) * ZOOMS[zoomIndex];
  }

  // Sets the position and size of an element from a rectangle in grid steps.
  function place(node, rect) {
    node.style.left = `${rect.x * STEP_MM * mmPx}px`;
    node.style.top = `${rect.y * STEP_MM * mmPx}px`;
    node.style.width = `${rect.w * STEP_MM * mmPx}px`;
    node.style.height = `${rect.h * STEP_MM * mmPx}px`;
  }

  // Builds the element of one block, with its pencil and its three resize handles.
  function buildBlock(block) {
    const node = document.createElement(`div`);
    node.className = `block`;
    node.dataset.id = block.id;
    node.dataset.type = block.type;
    node.setAttribute(`role`, `group`);
    node.setAttribute(`aria-label`, tr(`boardBlockLabel`, { type: tr(TYPE_KEYS[block.type]), title: blockTitle(block) }));
    if (editing) node.tabIndex = 0;
    if (block.id === selectedId) node.classList.add(`selected`);
    const kind = document.createElement(`div`);
    kind.className = `blockType`;
    kind.textContent = tr(TYPE_KEYS[block.type]);
    const title = document.createElement(`div`);
    title.className = `blockTitle`;
    if (!block.title) title.classList.add(`empty`);
    title.textContent = blockTitle(block);
    node.append(kind, title);
    if (editing) {
      const pencil = document.createElement(`button`);
      pencil.type = `button`;
      pencil.className = `pencil`;
      pencil.textContent = `✎`;
      pencil.setAttribute(`aria-label`, tr(`boardPencil`));
      node.appendChild(pencil);
      for (const handle of [`e`, `s`, `se`]) {
        const grip = document.createElement(`div`);
        grip.className = `handle ${handle}`;
        grip.dataset.handle = handle;
        node.appendChild(grip);
      }
    }
    place(node, block);
    return node;
  }

  // Draws every page with its blocks. With `focus` the selected block gets the keyboard focus again.
  function render(options = {}) {
    computeScale();
    const size = Layout.pageSizeMm(model.page.format, model.page.orientation);
    const margin = Layout.gridOf(model.page).margin;
    el.canvas.textContent = ``;
    el.canvas.classList.toggle(`editing`, editing);
    for (let index = 0; index < model.pages; index += 1) {
      const wrap = document.createElement(`section`);
      wrap.className = `pageWrap`;
      const label = document.createElement(`div`);
      label.className = `pageLabel`;
      label.textContent = tr(`boardPageLabel`, { n: index + 1, total: model.pages });
      const page = document.createElement(`div`);
      page.className = `page`;
      page.dataset.page = String(index);
      page.style.width = `${size.w * mmPx}px`;
      page.style.height = `${size.h * mmPx}px`;
      const area = document.createElement(`div`);
      area.className = `area`;
      area.style.left = `${margin * mmPx}px`;
      area.style.top = `${margin * mmPx}px`;
      area.style.right = `${margin * mmPx}px`;
      area.style.bottom = `${margin * mmPx}px`;
      page.appendChild(area);
      for (const block of model.blocks) {
        if (block.page !== index) continue;
        const node = buildBlock(block);
        node.style.marginLeft = `${margin * mmPx}px`;
        node.style.marginTop = `${margin * mmPx}px`;
        page.appendChild(node);
      }
      wrap.append(label, page);
      el.canvas.appendChild(wrap);
    }
    if (!model.blocks.length && !editing) {
      const hint = document.createElement(`p`);
      hint.className = `hint`;
      hint.textContent = tr(`boardEmpty`);
      el.canvas.appendChild(hint);
    }
    syncTools();
    if (panelOpen) fillPanel();
    if (options.focus && selectedId) {
      const node = el.canvas.querySelector(`.block[data-id="${selectedId}"]`);
      if (node) node.focus({ preventScroll: true });
    }
  }

  // Shows or hides the tools and sets the controls to the state of the model.
  function syncTools() {
    el.edit.textContent = editing ? tr(`boardDone`) : tr(`boardEdit`);
    el.edit.disabled = locked;
    el.tools.hidden = !editing;
    el.help.hidden = !editing;
    const showPanel = editing && panelOpen && Boolean(selectedBlock());
    el.side.hidden = !showPanel;
    $(`boardLayout`).classList.toggle(`withPanel`, showPanel);
    el.format.value = model.page.format;
    el.orientation.value = model.page.orientation;
    el.margin.value = String(model.page.margin);
  }

  // ------------------------------------------------------------------ Settings panel

  // Fills the settings panel with the selected block.
  function fillPanel() {
    const block = selectedBlock();
    if (!block) return;
    el.title.value = block.title;
    el.type.value = block.type;
    el.page.value = String(block.page + 1);
    el.page.max = String(model.pages);
    el.x.value = String(block.x * STEP_MM);
    el.y.value = String(block.y * STEP_MM);
    el.w.value = String(block.w * STEP_MM);
    el.h.value = String(block.h * STEP_MM);
  }

  // Selects a block (or none) and opens or closes its settings.
  function select(id, openPanel) {
    selectedId = id;
    panelOpen = Boolean(id) && openPanel;
    for (const node of el.canvas.querySelectorAll(`.block`)) node.classList.toggle(`selected`, node.dataset.id === id);
    if (panelOpen) fillPanel();
    const before = el.scroll.clientWidth;
    syncTools();
    if (el.scroll.clientWidth !== before) render();
  }

  // Reads a number from a field of the panel in millimetres and returns it in grid steps.
  const steps = (input) => Math.round(Number(input.value) / STEP_MM);

  // Applies the geometry fields of the panel to the selected block.
  function applyGeometry() {
    const block = selectedBlock();
    if (!block) return;
    const wanted = { page: Math.round(Number(el.page.value)) - 1, x: steps(el.x), y: steps(el.y), w: steps(el.w), h: steps(el.h) };
    if (![wanted.page, wanted.x, wanted.y, wanted.w, wanted.h].every(Number.isFinite)) {
      fillPanel();
      return;
    }
    commit(Model.setGeometry(model, block.id, wanted));
    fillPanel();
  }

  // ------------------------------------------------------------------ Deleting

  // Asks to confirm the deletion of the selected block, in the page (no dialog box).
  function askDelete() {
    const block = selectedBlock();
    if (!block) return;
    el.confirmText.textContent = tr(`boardConfirmText`, { title: blockTitle(block) });
    el.confirm.hidden = false;
    el.confirmYes.focus();
  }

  // Closes the confirmation without deleting.
  function cancelDelete() {
    el.confirm.hidden = true;
    const node = selectedId && el.canvas.querySelector(`.block[data-id="${selectedId}"]`);
    if (node) node.focus({ preventScroll: true });
  }

  // Deletes the selected block after the confirmation.
  function confirmDelete() {
    const block = selectedBlock();
    el.confirm.hidden = true;
    if (!block) return;
    selectedId = null;
    panelOpen = false;
    commit(Model.deleteBlock(model, block.id));
  }

  // ------------------------------------------------------------------ Pointer

  // Position of the pointer on a page in grid steps counted from the content area.
  function gridPoint(pageNode, event) {
    const rect = pageNode.getBoundingClientRect();
    const margin = Layout.gridOf(model.page).margin;
    return { x: (event.clientX - rect.left) / (STEP_MM * mmPx) - margin / STEP_MM, y: (event.clientY - rect.top) / (STEP_MM * mmPx) - margin / STEP_MM };
  }

  // The page element under the pointer, or the closest one above or below it.
  function pageAt(event) {
    let best = null;
    let bestDistance = Infinity;
    for (const node of el.canvas.querySelectorAll(`.page`)) {
      const rect = node.getBoundingClientRect();
      const distance = event.clientY < rect.top ? rect.top - event.clientY : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0;
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  // Shows or moves the outline that tells where the block will go.
  function showGhost(pageNode, rect) {
    if (!drag.ghost) {
      drag.ghost = document.createElement(`div`);
      drag.ghost.className = `ghost`;
    }
    const margin = Layout.gridOf(model.page).margin;
    if (drag.ghost.parentNode !== pageNode) pageNode.appendChild(drag.ghost);
    place(drag.ghost, rect);
    drag.ghost.style.marginLeft = `${margin * mmPx}px`;
    drag.ghost.style.marginTop = `${margin * mmPx}px`;
  }

  // Follows the pointer while a block is moved or resized.
  function onPointerMove(event) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_DISTANCE) return;
      drag.started = true;
      drag.node.classList.add(`dragging`);
    }
    const block = Model.findBlock(model, drag.id);
    const grid = Layout.gridOf(model.page);
    if (drag.kind === `move`) {
      const pageNode = pageAt(event);
      const point = gridPoint(pageNode, event);
      const wanted = { page: Number(pageNode.dataset.page), x: point.x - drag.grabX, y: point.y - drag.grabY };
      const spot = Layout.resolveMove(model.blocks, block, wanted, grid);
      drag.last = spot ? { wanted } : null;
      if (spot) showGhost(pageNode, { ...spot, w: block.w, h: block.h });
    } else {
      const dx = Math.round((event.clientX - drag.startX) / (STEP_MM * mmPx));
      const dy = Math.round((event.clientY - drag.startY) / (STEP_MM * mmPx));
      let w = block.w + (drag.handle.includes(`e`) ? dx : 0);
      let h = block.h + (drag.handle.includes(`s`) ? dy : 0);
      const keep = event.shiftKey;
      if (keep) {
        const ratio = block.w / block.h;
        if (drag.handle === `e`) h = Math.round(w / ratio);
        else if (drag.handle === `s`) w = Math.round(h * ratio);
        else {
          w = Math.round(Math.max(w, h * ratio));
          h = Math.round(w / ratio);
        }
      }
      const size = Layout.resolveResize(model.blocks, block, { w, h }, grid, keep);
      drag.last = { wanted: { w, h }, keep };
      showGhost(drag.node.parentNode, { x: block.x, y: block.y, w: size.w, h: size.h });
    }
  }

  // Ends a move or a resize: applies it, or only selects the block when the pointer did not move.
  function onPointerUp() {
    const finished = drag;
    stopDrag();
    if (!finished || !finished.started) return;
    if (!finished.last) render({ focus: true });
    else if (finished.kind === `move`) commit(Model.moveBlock(model, finished.id, finished.last.wanted), { focus: true });
    else commit(Model.resizeBlock(model, finished.id, finished.last.wanted, finished.last.keep), { focus: true });
  }

  // Cancels the move or the resize with the Escape key.
  function onDragKey(event) {
    if (event.key !== `Escape` || !drag) return;
    stopDrag();
    render({ focus: true });
  }

  // Removes the listeners and the outline of a move or a resize.
  function stopDrag() {
    window.removeEventListener(`pointermove`, onPointerMove);
    window.removeEventListener(`pointerup`, onPointerUp);
    window.removeEventListener(`pointercancel`, onPointerUp);
    window.removeEventListener(`keydown`, onDragKey);
    if (drag && drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    if (drag) drag.node.classList.remove(`dragging`);
    const finished = drag;
    drag = null;
    return finished;
  }

  // Starts a move (on the block) or a resize (on a handle).
  el.canvas.addEventListener(`pointerdown`, (event) => {
    if (!editing || event.button !== 0) return;
    const node = event.target.closest(`.block`);
    if (!node) {
      select(null, false);
      return;
    }
    if (event.target.closest(`.pencil`)) return;
    const id = node.dataset.id;
    if (id !== selectedId) select(id, panelOpen);
    const block = Model.findBlock(model, id);
    const handle = event.target.closest(`.handle`);
    const rect = node.getBoundingClientRect();
    drag = {
      id, node, started: false, last: null, ghost: null,
      kind: handle ? `resize` : `move`,
      handle: handle ? handle.dataset.handle : ``,
      startX: event.clientX,
      startY: event.clientY,
      grabX: (event.clientX - rect.left) / (STEP_MM * mmPx),
      grabY: (event.clientY - rect.top) / (STEP_MM * mmPx)
    };
    if (!block) drag = null;
    window.addEventListener(`pointermove`, onPointerMove);
    window.addEventListener(`pointerup`, onPointerUp);
    window.addEventListener(`pointercancel`, onPointerUp);
    window.addEventListener(`keydown`, onDragKey);
  });

  // Opens the settings of a block with a double click.
  el.canvas.addEventListener(`dblclick`, (event) => {
    if (!editing) return;
    const node = event.target.closest(`.block`);
    if (node) select(node.dataset.id, true);
  });

  // Opens the settings with the pencil.
  el.canvas.addEventListener(`click`, (event) => {
    if (!editing || !event.target.closest(`.pencil`)) return;
    const node = event.target.closest(`.block`);
    select(node.dataset.id, true);
    el.title.focus();
  });

  // ------------------------------------------------------------------ Keyboard

  // Arrows move the selected block by one step, Delete removes it, Enter opens its settings.
  el.canvas.addEventListener(`keydown`, (event) => {
    if (!editing || drag) return;
    const block = selectedBlock();
    if (!block || !event.target.classList.contains(`block`)) return;
    if (ARROWS[event.key]) {
      event.preventDefault();
      const [dx, dy] = ARROWS[event.key];
      commit(Model.moveBlock(model, block.id, { page: block.page, x: block.x + dx, y: block.y + dy }), { focus: true });
    } else if (event.key === `Delete` || event.key === `Backspace`) {
      event.preventDefault();
      askDelete();
    } else if (event.key === `Enter` || event.key === `F2`) {
      event.preventDefault();
      select(block.id, true);
      el.title.focus();
    } else if (event.key === `Escape`) {
      select(null, false);
    }
  });

  // ------------------------------------------------------------------ Controls

  // Switches between the reading mode and the editing mode.
  function setEditing(value) {
    editing = value && !locked;
    if (!editing) {
      selectedId = null;
      panelOpen = false;
      el.confirm.hidden = true;
    }
    render();
  }

  // Adds a block of the chosen type and selects it.
  function addBlock() {
    const result = Model.addBlock(model, el.addType.value);
    if (!result.id) {
      el.notice.textContent = tr(`boardLimit`);
      el.notice.hidden = false;
      return;
    }
    el.notice.hidden = true;
    selectedId = result.id;
    commit(result.model, { focus: true });
    const node = el.canvas.querySelector(`.block[data-id="${result.id}"]`);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: `nearest` });
  }

  // Moves the zoom one level up or down, or back to the page width.
  function zoom(direction) {
    zoomIndex = direction === 0 ? ZOOMS.indexOf(1) : Math.min(ZOOMS.length - 1, Math.max(0, zoomIndex + direction));
    render();
  }

  // Shows the notices of a cleaned model.
  function showWarnings(warnings) {
    const texts = warnings.map((code) => tr(WARNING_KEYS[code])).filter(Boolean);
    el.notice.textContent = texts.join(` `);
    el.notice.hidden = !texts.length;
  }

  // Fills the lists of the tools with the translated names.
  function fillTools() {
    fillSelect(el.addType, Model.TYPES.map((type) => [type, tr(TYPE_KEYS[type])]), `text`);
    fillSelect(el.type, Model.TYPES.map((type) => [type, tr(TYPE_KEYS[type])]), `text`);
    fillSelect(el.format, Object.keys(FORMAT_KEYS).map((key) => [key, tr(FORMAT_KEYS[key])]), model.page.format);
    fillSelect(el.orientation, Layout.ORIENTATIONS.map((key) => [key, tr(ORIENTATION_KEYS[key])]), model.page.orientation);
    fillSelect(el.margin, Layout.MARGINS.map((mm) => [mm, tr(`boardMarginValue`, { mm })]), model.page.margin);
  }

  el.edit.addEventListener(`click`, () => setEditing(!editing));
  el.add.addEventListener(`click`, addBlock);
  el.addPage.addEventListener(`click`, () => {
    const next = Model.addPage(model);
    if (next === model) {
      el.notice.textContent = tr(`boardLimit`);
      el.notice.hidden = false;
      return;
    }
    el.notice.hidden = true;
    commit(next);
  });
  const pageChange = () => commit(Model.setPage(model, { format: el.format.value, orientation: el.orientation.value, margin: Number(el.margin.value) }));
  el.format.addEventListener(`change`, pageChange);
  el.orientation.addEventListener(`change`, pageChange);
  el.margin.addEventListener(`change`, pageChange);
  el.zoomOut.addEventListener(`click`, () => zoom(-1));
  el.zoomIn.addEventListener(`click`, () => zoom(1));
  el.zoomFit.addEventListener(`click`, () => zoom(0));
  el.title.addEventListener(`input`, () => {
    if (selectedId) commit(Model.updateBlock(model, selectedId, { title: el.title.value }));
  });
  el.type.addEventListener(`change`, () => {
    if (selectedId) commit(Model.updateBlock(model, selectedId, { type: el.type.value }));
  });
  for (const input of [el.page, el.x, el.y, el.w, el.h]) input.addEventListener(`change`, applyGeometry);
  el.remove.addEventListener(`click`, askDelete);
  el.close.addEventListener(`click`, () => select(selectedId, false));
  el.confirmYes.addEventListener(`click`, confirmDelete);
  el.confirmNo.addEventListener(`click`, cancelDelete);

  // The page is drawn again when the tab is shown (its width is known only then) and when the window changes size.
  window.addEventListener(`exporttdb:tabchanged`, (event) => {
    if (event.detail === `board`) render();
  });
  window.addEventListener(`resize`, () => {
    if (window.exportTdbCurrentTab === `board`) render();
  });

  // A saved model arrives from Grist (at the start and after each save, or when another user changes it).
  access.onModel((raw) => {
    if (drag) return;
    const result = Model.validateModel(raw);
    locked = result.locked;
    showWarnings(result.warnings);
    if (JSON.stringify(result.model) === JSON.stringify(model) && !locked) return;
    model = result.model;
    if (locked) editing = false;
    if (selectedId && !Model.findBlock(model, selectedId)) {
      selectedId = null;
      panelOpen = false;
    }
    render();
  });

  fillTools();
  render();
  window.exportTdbBoard = { getModel: () => model };
})();
