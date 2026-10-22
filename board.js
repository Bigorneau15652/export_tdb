// The dashboard tab (versions 0.3 and 0.4): draws the pages and the blocks, lets the user add, move, resize
// and delete blocks with the pointer or the keyboard, edits the title and the type of a block in a
// settings panel, and saves the model in the options of the widget. A text block shows Markdown with
// fields taken from the selected row, and can read and write a text cell; the other blocks are empty
// frames for now: their content comes in the next versions. Rules about places, collisions and cleaning are in
// layout.js and model.js; this file only draws and listens.
(function () {
  const { t } = window.exportTdbI18n;
  const Layout = window.exportTdbLayout;
  const Model = window.exportTdbModel;
  const access = window.exportTdbAccess;
  const Markdown = window.exportTdbMarkdown;
  const MarkdownView = window.exportTdbMarkdownView;
  const Fields = window.exportTdbFields;
  const Data = window.exportTdbData;
  const { createDataset } = window.exportTdbDataset;
  const { describeStep } = window.exportTdbSchema;
  const Query = window.exportTdbTableQuery;
  const FilterUi = window.exportTdbFilterUi;
  const { STEP_MM } = Layout;

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const DRAG_DISTANCE = 4;
  const SAVE_DELAY_MS = 400;
  const TYPE_KEYS = { text: `typeText`, table: `typeTable`, chart: `typeChart`, image: `typeImage`, indicator: `typeIndicator` };
  const FORMAT_KEYS = { screen: `formatScreen`, a3: `formatA3`, a4: `formatA4`, a5: `formatA5`, square: `formatSquare` };
  const ORIENTATION_KEYS = { landscape: `orientationLandscape`, portrait: `orientationPortrait` };
  const WARNING_KEYS = { version: `boardWarnVersion`, invalid: `boardWarnInvalid`, blocks: `boardWarnBlocks` };
  // Height of the characters of a text block in millimetres, by size.
  const TEXT_MM = { small: 3, normal: 3.5, large: 5 };
  const TABLE_MM = 3;
  const CELL_DELAY_MS = 900;
  const SIZE_KEYS = { small: `sizeSmall`, normal: `sizeNormal`, large: `sizeLarge` };
  const ALIGN_KEYS = { left: `alignLeft`, center: `alignCenter`, justify: `alignJustify` };
  const FILL_KEYS = { none: `fillNone`, grey: `fillGrey`, blue: `fillBlue`, green: `fillGreen`, yellow: `fillYellow`, red: `fillRed` };
  const FN_KEYS = { sum: `fnSum`, avg: `fnAvg`, min: `fnMin`, max: `fnMax`, count: `fnCount`, distinct: `fnDistinct` };
  const QUALITY_KEYS = { summary: `labQualitySummary`, list: `labQualityList` };
  const REASON_KEYS = { choose: `boardTableChoose`, columns: `boardTableColumns`, groups: `boardTableGroups`, start: `boardTableStart`, nostart: `boardTableNoStart`, link: `boardTableLink`, notloaded: `boardTableNotLoaded` };
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const $ = (id) => document.getElementById(id);
  const el = {
    panel: $(`panelBoard`), notice: $(`boardNotice`), edit: $(`boardEdit`), tools: $(`boardTools`), help: $(`boardHelp`),
    addType: $(`boardAddType`), add: $(`boardAdd`), addPage: $(`boardAddPage`), format: $(`boardFormat`),
    orientation: $(`boardOrientation`), margin: $(`boardMargin`), zoomOut: $(`boardZoomOut`), zoomFit: $(`boardZoomFit`),
    zoomIn: $(`boardZoomIn`), saveState: $(`boardSaveState`), confirm: $(`boardConfirm`), confirmText: $(`boardConfirmText`),
    confirmYes: $(`boardConfirmYes`), confirmNo: $(`boardConfirmNo`), scroll: $(`boardScroll`), canvas: $(`boardCanvas`),
    side: $(`boardPanel`), titleRow: $(`boardTitleRow`), title: $(`boardTitle`), type: $(`boardType`), remove: $(`boardDelete`), close: $(`boardClose`), refresh: $(`boardRefresh`),
    textBox: $(`boardTextSettings`), source: $(`boardSource`), columnRow: $(`boardColumnRow`), column: $(`boardColumn`),
    text: $(`boardText`), field: $(`boardField`), size: $(`boardSize`), align: $(`boardAlign`), fill: $(`boardFill`),
    textInfo: $(`boardTextInfo`), cellState: $(`boardCellState`),
    tableBox: $(`boardTableSettings`), mode: $(`boardMode`), tableSel: $(`boardTable`), link: $(`boardLink`), linkInfo: $(`boardLinkInfo`),
    groupRow: $(`boardGroupRow`), group1: $(`boardGroup1`), group2: $(`boardGroup2`), merge: $(`boardMerge`),
    columnRows: $(`boardColumnRows`), addColumn: $(`boardAddColumn`), sortBy: $(`boardSortBy`), sortColumn: $(`boardSortColumn`),
    sortDir: $(`boardSortDir`), decimals: $(`boardDecimals`), total: $(`boardTotal`), tableInfo: $(`boardTableInfo`)
  };
  const filterBoxes = [$(`boardFilter1`), $(`boardFilter2`), $(`boardFilter3`)];

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
  // The text typed for a cell source and not yet written, and the written value kept on screen until
  // Grist gives the row again.
  let cellPending = null;
  let cellOverride = null;
  let cellTimer = null;
  let datasetMemo = null;
  let loadingData = false;
  const failedTables = new Set();
  const reloadedFor = new Set();

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

  // ------------------------------------------------------------------ Text blocks

  // What the exploration found: the schema, the linked table and the selected row.
  const context = () => window.exportTdbContext.state;

  // The dataset of the loaded tables, rebuilt only when tables were loaded.
  function currentDataset() {
    const state = context();
    if (!datasetMemo || datasetMemo.version !== Data.version() || datasetMemo.schema !== state.schema) {
      datasetMemo = { version: Data.version(), schema: state.schema, dataset: createDataset(state.schema, Data.tables()) };
    }
    return datasetMemo.dataset;
  }

  // The text columns of the linked table that can receive a text: real Text columns, no formula.
  function writableColumns() {
    const state = context();
    const table = state.schema && state.schema.tables.get(state.linked);
    return table ? table.columns.filter((column) => column.base === `Text` && column.kind === `plain` && !column.isFormula) : [];
  }

  // The Markdown text of a block: the fixed text or the content of the cell of the selected row.
  function sourceText(block) {
    const config = block.config;
    if (config.source !== `cell`) return config.text;
    const record = context().record;
    if (!record || !config.column) return ``;
    if (cellOverride && cellOverride.rowId === record.id && cellOverride.column === config.column) return cellOverride.value;
    const value = record[config.column];
    return typeof value === `string` ? value : ``;
  }

  // The nodes of a text block with its fields replaced, and the fields that could not be read.
  function textContent(block) {
    const raw = sourceText(block);
    const tree = Markdown.parseMarkdown(raw);
    const state = context();
    const empty = !raw.trim();
    if (!state.schema || !state.record) return { nodes: tree, problems: [], empty };
    const words = { yes: tr(`wordYes`), no: tr(`wordNo`) };
    const dataset = currentDataset();
    const result = Fields.expandFields(tree, (path) => Fields.resolveField(dataset, state.schema, state.linked, state.record, path, words));
    return { nodes: result.nodes, problems: result.problems, empty };
  }

  // Loads the tables that the text blocks and the table blocks need, then draws again.
  function requestData() {
    const state = context();
    if (!state.schema || !state.record || loadingData) return;
    const paths = new Set();
    const wanted = new Set();
    for (const block of model.blocks) {
      if (block.type === `text`) Fields.extractFields(sourceText(block)).forEach((path) => paths.add(path));
      if (block.type === `table`) Query.tablesFor(state.schema, state.linked, block.config).forEach((name) => wanted.add(name));
    }
    // A row that the loaded table does not hold yet (added since it was loaded): load the table again, once.
    const loadedLinked = Data.tables().get(state.linked);
    if (loadedLinked && paths.size && !(loadedLinked.id || []).includes(state.record.id) && !reloadedFor.has(state.record.id)) {
      reloadedFor.add(state.record.id);
      Data.drop(state.linked);
    }
    Fields.tablesForPaths(state.schema, state.linked, [...paths]).forEach((name) => wanted.add(name));
    const names = [...wanted].filter((name) => !Data.tables().has(name) && !failedTables.has(name));
    if (!names.length) return;
    loadingData = true;
    Data.ensure(names).catch(() => names.forEach((name) => failedTables.add(name))).then(() => {
      names.filter((name) => !Data.tables().has(name)).forEach((name) => failedTables.add(name));
      loadingData = false;
      render({ keepFocus: true });
    });
  }

  // Writes the text typed for a cell source, after checking the column and the row.
  async function flushCell() {
    clearTimeout(cellTimer);
    const pending = cellPending;
    if (!pending) return;
    cellPending = null;
    const state = context();
    const column = writableColumns().find((item) => item.id === pending.column);
    if (!column || pending.table !== state.linked || !(pending.rowId > 0)) {
      el.cellState.textContent = tr(`boardCellUnsafe`);
      el.cellState.className = `warning`;
      return;
    }
    const result = await access.writeCell(pending.table, pending.rowId, pending.column, pending.value);
    el.cellState.textContent = result.ok ? tr(`boardCellSaved`) : tr(`boardCellFailed`, { reason: result.reason });
    el.cellState.className = result.ok ? `hint` : `warning`;
    if (!result.ok) cellOverride = null;
    else if (state.record && cellOverride && state.record[cellOverride.column] === cellOverride.value) cellOverride = null;
  }

  // Keeps the text typed for a cell source on screen and writes it a short time after the last key.
  function typeInCell(block, value) {
    const record = context().record;
    if (!record || !block.config.column) return;
    if (!writableColumns().some((column) => column.id === block.config.column)) {
      el.cellState.textContent = tr(`boardCellUnsafe`);
      el.cellState.className = `warning`;
      return;
    }
    cellOverride = { rowId: record.id, column: block.config.column, value };
    cellPending = { table: context().linked, rowId: record.id, column: block.config.column, value };
    el.cellState.textContent = tr(`boardCellPending`);
    el.cellState.className = `hint`;
    clearTimeout(cellTimer);
    cellTimer = setTimeout(flushCell, CELL_DELAY_MS);
    render({ keepFocus: true });
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
    const available = Math.max(120, el.scroll.clientWidth - 18);
    mmPx = (available / size.w) * ZOOMS[zoomIndex];
  }

  // Sets the position and size of an element from a rectangle in grid steps.
  function place(node, rect) {
    node.style.left = `${rect.x * STEP_MM * mmPx}px`;
    node.style.top = `${rect.y * STEP_MM * mmPx}px`;
    node.style.width = `${rect.w * STEP_MM * mmPx}px`;
    node.style.height = `${rect.h * STEP_MM * mmPx}px`;
  }

  // The texts that the tables use: names of the functions, the word total and the label of an empty key.
  function tableWords() {
    return { sum: tr(`fnSum`), avg: tr(`fnAvg`), min: tr(`fnMin`), max: tr(`fnMax`), count: tr(`fnCount`), distinct: tr(`fnDistinct`), total: tr(`labTotal`), empty: tr(`tableEmptyKey`), yes: tr(`wordYes`), no: tr(`wordNo`) };
  }

  // The result of a table block for the selected row, or a reason why there is none yet.
  function tableResult(block) {
    const state = context();
    if (!state.schema || !state.record) return { ok: false, reason: `notready` };
    return Query.runTable(state.schema, currentDataset(), state.linked, state.record, block.config, tableWords());
  }

  // The message that explains why a table cannot be shown yet.
  function reasonText(result) {
    if (result.reason === `notready`) return tr(`boardTableNotReady`);
    if (result.reason === `error`) return tr(`boardTableError`, { reason: result.detail });
    return tr(REASON_KEYS[result.reason] || `boardTableChoose`);
  }

  // Draws the table of a result: a heading line, the rows and the total line.
  function drawTable(result) {
    const table = document.createElement(`table`);
    table.className = `dt`;
    const head = table.createTHead().insertRow();
    result.headers.forEach((header) => {
      const cell = document.createElement(`th`);
      cell.textContent = header.text;
      if (header.numeric) cell.className = `num`;
      head.appendChild(cell);
    });
    const body = table.createTBody();
    const addRow = (texts, className) => {
      const row = body.insertRow();
      if (className) row.className = className;
      texts.forEach((text, index) => {
        const cell = row.insertCell();
        cell.textContent = text;
        if (result.headers[index] && result.headers[index].numeric) cell.className = `num`;
      });
    };
    result.rows.forEach((texts) => addRow(texts, ``));
    if (result.total) addRow(result.total, `total`);
    return table;
  }

  // Fills the element of a table block: its title and its table, or a hint in the editing mode.
  function buildTableBody(node, block) {
    node.classList.add(`tableBlock`);
    node.style.fontSize = `${TABLE_MM * mmPx}px`;
    if (block.title) {
      const title = document.createElement(`div`);
      title.className = `tableTitle`;
      title.textContent = block.title;
      node.appendChild(title);
    }
    const result = tableResult(block);
    if (result.ok) {
      node.appendChild(drawTable(result));
    } else if (editing) {
      const hint = document.createElement(`p`);
      hint.className = `tableHint`;
      hint.textContent = reasonText(result);
      node.appendChild(hint);
    }
  }

  // Fills the element of a text block: its look from the settings and its Markdown content.
  function buildTextBody(node, block) {
    const config = block.config;
    node.classList.add(`textBlock`, `fill-${config.fill}`, `align-${config.align}`);
    node.style.fontSize = `${TEXT_MM[config.size] * mmPx}px`;
    const body = document.createElement(`div`);
    body.className = `md`;
    const content = textContent(block);
    if (content.empty) {
      if (editing) {
        body.classList.add(`placeholder`);
        body.textContent = tr(`boardTextEmpty`);
      }
    } else {
      body.appendChild(MarkdownView.build(content.nodes));
    }
    node.appendChild(body);
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
    if (block.type === `text`) {
      buildTextBody(node, block);
    } else if (block.type === `table`) {
      buildTableBody(node, block);
    } else {
      const kind = document.createElement(`div`);
      kind.className = `blockType`;
      kind.textContent = tr(TYPE_KEYS[block.type]);
      const title = document.createElement(`div`);
      title.className = `blockTitle`;
      if (!block.title) title.classList.add(`empty`);
      title.textContent = blockTitle(block);
      node.append(kind, title);
    }
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
    const hadFocus = Boolean(options.keepFocus) && el.canvas.contains(document.activeElement);
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
    for (const node of el.canvas.querySelectorAll(`.block.textBlock, .block.tableBlock`)) {
      node.classList.toggle(`overflowing`, node.scrollHeight > node.clientHeight + 2);
    }
    syncTools();
    if (panelOpen) fillPanel();
    requestData();
    if ((options.focus || hadFocus) && selectedId) {
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

  // Sets the value of a field of the panel, unless the user is typing in it.
  function setValue(input, value) {
    if (input.value !== value && document.activeElement !== input) input.value = value;
  }

  // The schema for which the lists of columns of the panel were built.
  let listsFor = null;

  // Builds the lists that depend on the document: the text columns and the fields that can be inserted.
  function fillDynamicLists() {
    const state = context();
    if (listsFor === state.schema) return;
    listsFor = state.schema;
    const columns = writableColumns().map((column) => [column.id, column.id]);
    fillSelect(el.column, [[``, tr(`boardColumnNone`)], ...columns], ``);
    const fields = state.schema && state.linked ? Fields.fieldChoices(state.schema, state.linked).map((choice) => [choice.path, choice.label]) : [];
    fillSelect(el.field, [[``, tr(`boardFieldPlaceholder`)], ...fields], ``);
  }

  // Fills the settings of a text block and the messages about its text.
  function fillTextSettings(block) {
    const config = block.config;
    const state = context();
    fillDynamicLists();
    el.source.value = config.source;
    el.size.value = config.size;
    el.align.value = config.align;
    el.fill.value = config.fill;
    el.columnRow.hidden = config.source !== `cell`;
    if ([...el.column.options].some((option) => option.value === config.column)) el.column.value = config.column;
    else el.column.value = ``;
    const cell = config.source === `cell`;
    const messages = [];
    let usable = true;
    if (cell && !state.schema) {
      messages.push(tr(`boardCellNotReady`));
      usable = false;
    } else if (cell && !config.column) {
      messages.push(tr(`boardCellNoColumn`));
      usable = false;
    } else if (cell && !state.record) {
      messages.push(tr(`boardCellNoRow`));
      usable = false;
    }
    el.text.disabled = !usable;
    el.text.maxLength = cell ? 20000 : Model.MAX_FIXED_TEXT;
    setValue(el.text, usable ? (cell ? sourceText(block) : config.text) : ``);
    const content = textContent(block);
    if (content.problems.length) messages.push(tr(`boardTextProblems`, { fields: content.problems.map((path) => `{${path}}`).join(`, `) }));
    const node = el.canvas.querySelector(`.block[data-id="${block.id}"]`);
    if (node && node.classList.contains(`overflowing`)) messages.push(tr(`boardTextOverflow`));
    el.textInfo.textContent = messages.join(` `);
    el.textInfo.className = messages.length ? `warning` : `hint`;
  }

  // Sets the options of a select element only when the list changed, then its value.
  function setOptions(select, items, value) {
    const signature = JSON.stringify(items);
    if (select.dataset.signature !== signature) {
      fillSelect(select, items, value);
      select.dataset.signature = signature;
    }
    if (select.value !== String(value)) select.value = String(value);
  }

  // The sentence that names a way to choose the rows of a table (see Query.listChoices).
  function choiceLabel(choice) {
    const linked = context().linked;
    const chain = choice.startSteps.map((step) => `${step.from}.${step.column}`).join(` > `);
    const where = choice.startSteps.length ? tr(`boardWhereItem`, { table: choice.startTable, chain }) : tr(`boardWhereSelected`, { table: linked });
    if (choice.kind === `all`) return tr(`labAllRows`);
    if (choice.kind === `self`) return choice.startSteps.length ? tr(`boardRowsOnly`, { where }) : tr(`labSelfRow`);
    const note = QUALITY_KEYS[choice.quality] ? ` ${tr(QUALITY_KEYS[choice.quality])}` : ``;
    if (choice.steps.length === 1) return tr(`boardRowsPointing`, { column: `${choice.steps[0].from}.${choice.steps[0].column}`, where }) + note;
    return tr(`boardRowsLinked`, { chain: choice.steps.map(describeStep).join(` ; `), where }) + note;
  }

  // The structure for which the filters and the column lines were built.
  let filtersFor = ``;
  let columnsFor = ``;
  let filterUis = [];

  // Changes the settings of the selected block (text or table) and draws again.
  function changeConfig(changes) {
    const block = selectedBlock();
    if (block && (block.type === `text` || block.type === `table`)) commit(Model.updateBlock(model, block.id, { config: changes }));
  }

  // Builds the line of one column of the table: path, calculation, heading and the buttons.
  function buildColumnRow(index) {
    const row = document.createElement(`div`);
    row.className = `colrow`;
    row.dataset.index = String(index);
    const path = document.createElement(`select`);
    path.className = `colPath`;
    const fn = document.createElement(`select`);
    fn.className = `colFn`;
    const tools = document.createElement(`div`);
    tools.className = `tools`;
    const label = document.createElement(`input`);
    label.type = `text`;
    label.className = `colLabel`;
    label.maxLength = 60;
    label.placeholder = tr(`boardColumnLabel`);
    label.setAttribute(`aria-label`, tr(`boardColumnLabel`));
    const button = (text, key, action) => {
      const item = document.createElement(`button`);
      item.type = `button`;
      item.textContent = text;
      item.setAttribute(`aria-label`, tr(key));
      item.title = tr(key);
      item.addEventListener(`click`, action);
      return item;
    };
    const edit = (patch) => {
      const block = selectedBlock();
      if (!block) return;
      const columns = block.config.columns.map((column) => ({ ...column }));
      columns[index] = { ...columns[index], ...patch };
      changeConfig({ columns });
    };
    const move = (delta) => {
      const block = selectedBlock();
      if (!block) return;
      const columns = block.config.columns.map((column) => ({ ...column }));
      const target = index + delta;
      if (target < 0 || target >= columns.length) return;
      [columns[index], columns[target]] = [columns[target], columns[index]];
      changeConfig({ columns });
    };
    path.addEventListener(`change`, () => edit({ path: path.value }));
    fn.addEventListener(`change`, () => edit({ fn: fn.value }));
    label.addEventListener(`input`, () => edit({ label: label.value }));
    tools.append(
      label,
      button(`\u2191`, `boardColumnUp`, () => move(-1)),
      button(`\u2193`, `boardColumnDown`, () => move(1)),
      button(`\u00d7`, `boardColumnRemove`, () => {
        const block = selectedBlock();
        if (block) changeConfig({ columns: block.config.columns.filter((_, at) => at !== index) });
      })
    );
    row.append(path, fn, tools);
    tools.style.gridColumn = `1 / 3`;
    return row;
  }

  // Shows the column lines of the table block, rebuilding them only when their number or the table changes.
  function renderColumnRows(block, choices) {
    const config = block.config;
    const key = `${block.id}|${config.table}|${config.mode}|${config.columns.length}`;
    if (key !== columnsFor) {
      columnsFor = key;
      el.columnRows.textContent = ``;
      config.columns.forEach((_, index) => el.columnRows.appendChild(buildColumnRow(index)));
    }
    const functions = Model.FUNCTIONS.map((name) => [name, tr(FN_KEYS[name])]);
    const items = config.mode === `list` ? [[``, tr(`fnNoTotal`)], ...functions] : functions;
    config.columns.forEach((column, index) => {
      const row = el.columnRows.children[index];
      if (!row) return;
      setOptions(row.querySelector(`.colPath`), [[``, tr(`boardColumnNone`)], ...choices.map((choice) => [choice.path, choice.label])], column.path);
      setOptions(row.querySelector(`.colFn`), items, column.fn || (config.mode === `group` ? `sum` : ``));
      setValue(row.querySelector(`.colLabel`), column.label);
    });
  }

  // Builds the three filters of the table block, only when the starting row or the table changes.
  function renderFilters(block, choices, startChoices) {
    const key = `${block.id}|${block.config.start}|${block.config.table}`;
    if (key === filtersFor) return;
    filtersFor = key;
    filterUis = filterBoxes.map((box, index) => FilterUi.build(box, choices, startChoices, block.config.filters[index], () => {
      changeConfig({ filters: filterUis.map(FilterUi.read).filter(Boolean) });
    }));
  }

  // Fills the settings of a table block and the messages about its content.
  function fillTableSettings(block) {
    const config = block.config;
    const state = context();
    const controls = [el.mode, el.tableSel, el.link, el.group1, el.group2, el.merge, el.addColumn, el.sortBy, el.sortColumn, el.sortDir, el.decimals, el.total];
    controls.forEach((control) => { control.disabled = !state.schema; });
    if (!state.schema) {
      el.tableInfo.textContent = tr(`boardTableNotReady`);
      el.tableInfo.className = `warning`;
      return;
    }
    const schema = state.schema;
    const starts = Query.listStarts(schema, state.linked);
    const start = starts.find((item) => item.key === config.start) || starts[0];
    const choices = config.table && schema.tables.has(config.table) ? Fields.fieldChoices(schema, config.table) : [];
    const columnItems = [[``, tr(`boardColumnNone`)], ...choices.map((choice) => [choice.path, choice.label])];
    setOptions(el.mode, [[`list`, tr(`boardModeList`)], [`group`, tr(`boardModeGroup`)]], config.mode);
    const tables = Query.listAllTables(schema).map((entry) => [entry.table, entry.summary ? `${entry.table} ${tr(`labQualitySummary`)}` : entry.table]);
    setOptions(el.tableSel, [[``, tr(`boardColumnNone`)], ...tables], config.table);
    const rowChoices = config.table && schema.tables.has(config.table) ? Query.listChoices(schema, state.linked, config.table) : [];
    const chosen = rowChoices.find((item) => item.start === config.start && item.link === config.link);
    setOptions(el.link, [[``, tr(`boardColumnNone`)], ...rowChoices.map((item) => [item.value, choiceLabel(item)])], chosen ? chosen.value : ``);
    el.linkInfo.textContent = chosen ? choiceLabel(chosen) : ``;
    el.groupRow.hidden = config.mode !== `group`;
    setOptions(el.group1, columnItems, config.groupBy[0] || ``);
    setOptions(el.group2, columnItems, config.groupBy[1] || ``);
    el.merge.checked = config.merge;
    const sortItems = config.mode === `list` ? [[`none`, tr(`sortNone`)], [`column`, tr(`sortByColumn`)]] : [[`key`, tr(`sortByKey`)], [`value`, tr(`sortByValue`)]];
    const sortBy = sortItems.some(([value]) => value === config.sort.by) ? config.sort.by : sortItems[0][0];
    setOptions(el.sortBy, sortItems, sortBy);
    el.sortColumn.hidden = !(config.mode === `list` && sortBy === `column`);
    setOptions(el.sortColumn, [[``, tr(`sortChoose`)], ...choices.map((choice) => [choice.path, choice.label])], config.sort.column);
    setOptions(el.sortDir, [[`asc`, tr(`sortAsc`)], [`desc`, tr(`sortDesc`)]], config.sort.dir);
    setOptions(el.decimals, [[-1, tr(`decimalsAuto`)], [0, `0`], [1, `1`], [2, `2`], [3, `3`]], config.decimals);
    el.total.checked = config.total;
    renderColumnRows(block, choices);
    renderFilters(block, choices, Fields.fieldChoices(schema, start.table));
    const messages = [];
    const result = tableResult(block);
    if (result.ok) {
      messages.push(tr(`boardTableCounts`, { kept: result.kept, total: result.scanned }));
      result.warnings.forEach((reason) => messages.push(tr(`boardTableFilterIgnored`, { reason })));
      if (result.truncated) messages.push(tr(`boardTableTruncated`, { max: Query.MAX_ROWS }));
    } else if (result.reason !== `choose`) {
      messages.push(reasonText(result));
    }
    const node = el.canvas.querySelector(`.block[data-id="${block.id}"]`);
    const overflow = Boolean(node) && node.classList.contains(`overflowing`);
    if (overflow) messages.push(tr(`boardTableOverflow`));
    el.tableInfo.textContent = messages.join(` `);
    el.tableInfo.className = overflow || (result.ok && (result.warnings.length || result.truncated)) || (!result.ok && result.reason !== `choose`) ? `warning` : `hint`;
  }

  // Fills the settings panel with the selected block.
  function fillPanel() {
    const block = selectedBlock();
    if (!block) return;
    setValue(el.title, block.title);
    el.type.value = block.type;
    el.titleRow.hidden = block.type === `text`;
    el.tableBox.hidden = block.type !== `table`;
    if (block.type === `table`) fillTableSettings(block);
    el.textBox.hidden = block.type !== `text`;
    if (block.type === `text`) fillTextSettings(block);
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
      flushCell();
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
    fillSelect(el.source, Model.TEXT_SOURCES.map((key) => [key, tr(key === `fixed` ? `boardSourceFixed` : `boardSourceCell`)]), `fixed`);
    fillSelect(el.size, Model.TEXT_SIZES.map((key) => [key, tr(SIZE_KEYS[key])]), `normal`);
    fillSelect(el.align, Model.TEXT_ALIGNS.map((key) => [key, tr(ALIGN_KEYS[key])]), `left`);
    fillSelect(el.fill, Model.FILLS.map((key) => [key, tr(FILL_KEYS[key])]), `none`);
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
  el.remove.addEventListener(`click`, askDelete);
  el.close.addEventListener(`click`, () => select(selectedId, false));
  el.confirmYes.addEventListener(`click`, confirmDelete);
  el.confirmNo.addEventListener(`click`, cancelDelete);


  // The settings of the table block that depend on the table are cleared when the table changes.
  const tableReset = (mode) => ({ link: ``, columns: [], groupBy: [], filters: [], sort: { by: mode === `group` ? `key` : `none`, column: ``, dir: `asc` } });
  el.mode.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (!block) return;
    const group = el.mode.value === `group`;
    changeConfig({ mode: el.mode.value, columns: block.config.columns.map((column) => ({ ...column, fn: group ? column.fn || `sum` : column.fn })), sort: { ...block.config.sort, by: group ? `key` : `none` } });
  });
  el.tableSel.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (block) changeConfig({ table: el.tableSel.value, start: ``, ...tableReset(block.config.mode) });
  });
  el.link.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (!block) return;
    const [start, link] = el.link.value ? el.link.value.split(`|`) : [``, ``];
    changeConfig(start === block.config.start ? { start, link } : { start, link, filters: [] });
  });
  el.group1.addEventListener(`change`, () => changeConfig({ groupBy: [el.group1.value, el.group2.value] }));
  el.group2.addEventListener(`change`, () => changeConfig({ groupBy: [el.group1.value, el.group2.value] }));
  el.merge.addEventListener(`change`, () => changeConfig({ merge: el.merge.checked }));
  el.addColumn.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (block && block.config.columns.length < Model.MAX_COLUMNS) changeConfig({ columns: [...block.config.columns, { path: ``, fn: block.config.mode === `group` ? `sum` : ``, label: `` }] });
  });
  const changeSort = () => changeConfig({ sort: { by: el.sortBy.value, column: el.sortColumn.value, dir: el.sortDir.value } });
  el.sortBy.addEventListener(`change`, changeSort);
  el.sortColumn.addEventListener(`change`, changeSort);
  el.sortDir.addEventListener(`change`, changeSort);
  el.decimals.addEventListener(`change`, () => changeConfig({ decimals: Number(el.decimals.value) }));
  el.total.addEventListener(`change`, () => changeConfig({ total: el.total.checked }));
  el.source.addEventListener(`change`, () => changeConfig({ source: el.source.value }));
  el.column.addEventListener(`change`, () => changeConfig({ column: el.column.value }));
  el.size.addEventListener(`change`, () => changeConfig({ size: el.size.value }));
  el.align.addEventListener(`change`, () => changeConfig({ align: el.align.value }));
  el.fill.addEventListener(`change`, () => changeConfig({ fill: el.fill.value }));
  el.text.addEventListener(`input`, () => {
    const block = selectedBlock();
    if (!block || block.type !== `text`) return;
    if (block.config.source === `cell`) typeInCell(block, el.text.value);
    else commit(Model.updateBlock(model, block.id, { config: { text: el.text.value } }));
  });
  el.field.addEventListener(`change`, () => {
    const path = el.field.value;
    if (!path || el.text.disabled) return;
    el.text.setRangeText(`{${path}}`, el.text.selectionStart, el.text.selectionEnd, `end`);
    el.field.value = ``;
    el.text.focus();
    el.text.dispatchEvent(new Event(`input`));
  });
  el.refresh.addEventListener(`click`, () => {
    Data.clear();
    failedTables.clear();
    reloadedFor.clear();
    datasetMemo = null;
    render({ keepFocus: true });
  });

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

  // The selected row changed (or its content): the texts are drawn again. A text typed for the cell of
  // the previous row is written first.
  window.addEventListener(`exporttdb:rowchanged`, () => {
    const record = context().record;
    if (cellPending && record && cellPending.rowId !== record.id) flushCell();
    if (cellOverride && record && (cellOverride.rowId !== record.id || record[cellOverride.column] === cellOverride.value) && !cellPending) cellOverride = null;
    if (!drag) render({ keepFocus: true });
  });
  // The exploration is done (or done again): the lists of columns and the loaded tables start again.
  window.addEventListener(`exporttdb:explored`, () => {
    Data.clear();
    failedTables.clear();
    datasetMemo = null;
    listsFor = null;
    if (!drag) render({ keepFocus: true });
  });
  // A text that is still waiting is written before the page is left.
  window.addEventListener(`pagehide`, flushCell);
  document.addEventListener(`visibilitychange`, () => {
    if (document.visibilityState === `hidden`) flushCell();
  });

  fillTools();
  render();
  window.exportTdbBoard = { getModel: () => model };
})();
