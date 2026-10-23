// The dashboard tab (versions 0.3 and 0.4): draws the pages and the blocks, lets the user add, move, resize
// and delete blocks with the pointer or the keyboard, edits the title and the type of a block in a
// settings panel, and saves the model in the options of the widget. A text block shows Markdown with
// fields taken from the selected row, and can read and write a text cell; the other blocks are empty
// frames for now: their content comes in the next versions. Rules about places, collisions and cleaning are in
// layout.js and model.js; this file only draws and listens.
(function () {
  const { t } = window.exportTdbI18n;
  const Layout = window.exportTdbLayout;
  const Flow = window.exportTdbFlow;
  const Model = window.exportTdbModel;
  const access = window.exportTdbAccess;
  const Markdown = window.exportTdbMarkdown;
  const MarkdownView = window.exportTdbMarkdownView;
  const Fields = window.exportTdbFields;
  const Record = window.exportTdbRecord;
  const Help = window.exportTdbHelp;
  const Data = window.exportTdbData;
  const { createDataset } = window.exportTdbDataset;
  const { describeStep } = window.exportTdbSchema;
  const Query = window.exportTdbTableQuery;
  const FilterUi = window.exportTdbFilterUi;
  const { STEP_MM } = Layout;

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const DRAG_DISTANCE = 4;
  const SAVE_DELAY_MS = 400;
  const TYPE_KEYS = { text: `typeText`, table: `typeTable`, record: `typeRecord`, chart: `typeChart`, image: `typeImage`, indicator: `typeIndicator` };
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
  const FN_ORDER = [`sum`, `avg`, `min`, `max`, `count`, `distinct`];
  const FN_SHORT_KEYS = { sum: `fnSumShort`, avg: `fnAvgShort`, min: `fnMinShort`, max: `fnMaxShort`, count: `fnCountShort`, distinct: `fnDistinctShort` };
  const FN_KEYS = { sum: `fnSum`, avg: `fnAvg`, min: `fnMin`, max: `fnMax`, count: `fnCount`, distinct: `fnDistinct` };
  const QUALITY_KEYS = { summary: `labQualitySummary`, list: `labQualityList` };
  const REASON_KEYS = { choose: `boardTableChoose`, columns: `boardTableColumns`, groups: `boardTableGroups`, start: `boardTableStart`, nostart: `boardTableNoStart`, link: `boardTableLink`, notloaded: `boardTableNotLoaded` };
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const $ = (id) => document.getElementById(id);
  const el = {
    panel: $(`panelBoard`), notice: $(`boardNotice`), edit: $(`boardEdit`), tools: $(`boardTools`), help: $(`boardHelp`),
    addType: $(`boardAddType`), add: $(`boardAdd`), format: $(`boardFormat`),
    orientation: $(`boardOrientation`), margin: $(`boardMargin`), zoomOut: $(`boardZoomOut`), zoomFit: $(`boardZoomFit`),
    zoomIn: $(`boardZoomIn`), saveState: $(`boardSaveState`), confirm: $(`boardConfirm`), confirmText: $(`boardConfirmText`),
    confirmYes: $(`boardConfirmYes`), confirmNo: $(`boardConfirmNo`), scroll: $(`boardScroll`), canvas: $(`boardCanvas`),
    side: $(`boardPanel`), titleRow: $(`boardTitleRow`), title: $(`boardTitle`), remove: $(`boardDelete`), close: $(`boardClose`), refresh: $(`boardRefresh`),
    textBox: $(`boardTextSettings`), recordBox: $(`boardRecordSettings`), recordRows: $(`boardRecordRows`), recordAdd: $(`boardRecordAdd`), recordColumns: $(`boardRecordColumns`), recordSize: $(`boardRecordSize`), recordInfo: $(`boardRecordInfo`), source: $(`boardSource`), columnRow: $(`boardColumnRow`), column: $(`boardColumn`),
    text: $(`boardText`), field: $(`boardField`), size: $(`boardSize`), align: $(`boardAlign`), fill: $(`boardFill`),
    textInfo: $(`boardTextInfo`), cellState: $(`boardCellState`),
    tableBox: $(`boardTableSettings`), kind: $(`boardKind`), tableSel: $(`boardTable`), linkRow: $(`boardLinkRow`), link: $(`boardLink`), rowsHelp: $(`boardRowsHelp`),
    explain: $(`boardExplain`), explainBody: $(`boardExplainBody`), explainHead: $(`boardExplainHead`), explainClose: $(`boardExplainClose`), more: $(`boardMore`), totalRight: $(`boardTotalRight`), totalRightRow: $(`boardTotalRightRow`), totalRightFn: $(`boardTotalRightFn`), totalRightLess: $(`boardTotalRightLess`), totalRightMore: $(`boardTotalRightMore`), moreLinks: $(`boardMoreLinks`),
    groupRow: $(`boardGroupRow`), group1: $(`boardGroup1`), merge: $(`boardMerge`),
    columnRows: $(`boardColumnRows`), addColumn: $(`boardAddColumn`), sortBy: $(`boardSortBy`), sortColumn: $(`boardSortColumn`),
    sortDir: $(`boardSortDir`), total: $(`boardTotal`), tableInfo: $(`boardTableInfo`),
    filterToggle: $(`boardFilterToggle`), filterBody: $(`boardFilterBody`), sortToggle: $(`boardSortToggle`), sortBody: $(`boardSortBody`), sortOrderBox: $(`boardSortOrderBox`), sortOrder: $(`boardSortOrder`)
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

  // Fills a select element with [value, label] pairs (a third item names a group of options) and selects `value`.
  function fillSelect(select, items, value) {
    select.textContent = ``;
    const groups = new Map();
    for (const [optionValue, label, group] of items) {
      const option = document.createElement(`option`);
      option.value = String(optionValue);
      option.textContent = label;
      if (group) {
        if (!groups.has(group)) {
          const element = document.createElement(`optgroup`);
          element.label = group;
          groups.set(group, element);
          select.appendChild(element);
        }
        groups.get(group).appendChild(option);
      } else {
        select.appendChild(option);
      }
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
      if (block.type === `record`) Record.recordPaths(block.config).forEach((path) => paths.add(path));
      if (block.type === `table` && explainOpen && block.id === selectedId && block.config.table) Query.tablesForChoices(state.schema, state.linked, block.config.table).forEach((name) => wanted.add(name));
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
    model = Model.compactPages(next, flowPages());
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

  // Fills the element of a record block: its title and its grid of information, each one a small label above
  // its value, or a hint in the editing mode when nothing is chosen yet.
  function buildRecordBody(node, block) {
    const config = block.config;
    node.classList.add(`recordBlock`);
    node.style.fontSize = `${TEXT_MM[config.size] * mmPx}px`;
    if (block.title) {
      const title = document.createElement(`div`);
      title.className = `recordTitle`;
      title.textContent = block.title;
      node.appendChild(title);
    }
    const state = context();
    const shown = state.schema && state.record ? Record.recordCells(state.schema, currentDataset(), state.linked, state.record, config, { yes: tr(`wordYes`), no: tr(`wordNo`) }) : null;
    if (!shown || !shown.cells.length) {
      if (editing) {
        const hint = document.createElement(`p`);
        hint.className = `tableHint`;
        hint.textContent = config.items.some((item) => item.path) ? tr(`boardRecordWaiting`) : tr(`boardRecordEmpty`);
        node.appendChild(hint);
      }
      return;
    }
    const grid = document.createElement(`div`);
    grid.className = `recordGrid`;
    grid.style.gridTemplateColumns = `repeat(${config.columns}, minmax(0, 1fr))`;
    for (const cell of shown.cells) {
      const item = document.createElement(`div`);
      item.className = `recordCell`;
      const label = document.createElement(`div`);
      label.className = `recordLabel`;
      label.textContent = cell.label;
      const value = document.createElement(`div`);
      value.className = `recordValue`;
      value.textContent = cell.text;
      item.append(label, value);
      grid.appendChild(item);
    }
    node.appendChild(grid);
  }

  // Fills the settings of a record block: one line per information (the column, its label and the buttons
  // that move or remove it), the number of columns of the grid and the size of the text.
  function fillRecordSettings(block) {
    const config = block.config;
    const state = context();
    const choices = state.schema && state.linked && state.schema.tables.has(state.linked) ? Fields.sortChoices(Fields.fieldChoices(state.schema, state.linked)) : [];
    el.recordAdd.disabled = !state.schema || config.items.length >= Model.MAX_RECORD_ITEMS;
    const key = `${block.id}|${config.items.length}|${state.linked}|${choices.length}`;
    if (key !== recordRowsFor) {
      recordRowsFor = key;
      el.recordRows.textContent = ``;
      config.items.forEach((_, index) => el.recordRows.appendChild(buildRecordRow(index)));
    }
    config.items.forEach((item, index) => {
      const row = el.recordRows.children[index];
      if (!row) return;
      setOptions(row.querySelector(`.colPath`), [[``, tr(`boardColumnNone`)], ...choices.map((choice) => [choice.path, choice.label])], item.path);
      setValue(row.querySelector(`.colLabel`), item.label);
    });
    setOptions(el.recordColumns, Model.RECORD_COLUMNS.map((count) => [count, String(count)]), config.columns);
    setOptions(el.recordSize, Model.TEXT_SIZES.map((name) => [name, tr(SIZE_KEYS[name])]), config.size);
    const shown = state.schema && state.record ? Record.recordCells(state.schema, currentDataset(), state.linked, state.record, config, { yes: tr(`wordYes`), no: tr(`wordNo`) }) : null;
    const messages = [];
    if (!state.schema) messages.push(tr(`boardTableNotReady`));
    else if (shown && shown.problems.length) messages.push(tr(`boardRecordProblems`, { fields: shown.problems.join(`, `) }));
    const node = el.canvas.querySelector(`.block[data-id="${block.id}"]`);
    if (node && node.classList.contains(`overflowing`)) messages.push(tr(`boardRecordOverflow`));
    el.recordInfo.textContent = messages.join(` `);
    el.recordInfo.className = messages.length ? `warning` : `hint`;
  }

  // The structure for which the lines of the record settings were built.
  let recordRowsFor = ``;

  // Builds the two lines of one information of a record block: the column and its label, then the buttons.
  function buildRecordRow(index) {
    const row = document.createElement(`div`);
    row.className = `colrow list`;
    const top = document.createElement(`div`);
    top.className = `colTop`;
    const bottom = document.createElement(`div`);
    bottom.className = `colBottom`;
    const path = document.createElement(`select`);
    path.className = `colPath`;
    const label = document.createElement(`input`);
    label.type = `text`;
    label.className = `colLabel`;
    label.maxLength = 60;
    label.placeholder = tr(`boardColumnLabel`);
    label.setAttribute(`aria-label`, tr(`boardColumnLabel`));
    const button = (text, name, action) => {
      const item = document.createElement(`button`);
      item.type = `button`;
      item.textContent = text;
      item.setAttribute(`aria-label`, tr(name));
      item.addEventListener(`click`, action);
      return item;
    };
    const edit = (patch) => {
      const block = selectedBlock();
      if (!block) return;
      const items = block.config.items.map((item) => ({ ...item }));
      items[index] = { ...items[index], ...patch };
      changeConfig({ items });
    };
    const move = (delta) => {
      const block = selectedBlock();
      if (!block) return;
      const items = block.config.items.map((item) => ({ ...item }));
      const target = index + delta;
      if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
      changeConfig({ items });
    };
    path.addEventListener(`change`, () => edit({ path: path.value }));
    label.addEventListener(`input`, () => edit({ label: label.value }));
    top.append(path);
    bottom.append(
      label,
      button(`\u2191`, `boardColumnUp`, () => move(-1)),
      button(`\u2193`, `boardColumnDown`, () => move(1)),
      button(`\u00d7`, `boardColumnRemove`, () => {
        const block = selectedBlock();
        if (block) changeConfig({ items: block.config.items.filter((_, at) => at !== index) });
      })
    );
    row.append(top, bottom);
    return row;
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
    } else if (block.type === `record`) {
      buildRecordBody(node, block);
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

  // What the last drawing found about the long tables: for each block, the rows that fit nowhere, the
  // number of pages that follow its first page and that it uses, and the list of these pages.
  const flowInfo = new Map();

  // The pages that the rest of long tables uses, from the last drawing: they stay even without a block.
  function flowPages() {
    const pages = new Set();
    for (const info of flowInfo.values()) info.used.forEach((page) => pages.add(page));
    return [...pages];
  }

  // Builds the element of a page (its label is written later, when the number of pages is known).
  function makePage(index, empty) {
    const size = Layout.pageSizeMm(model.page.format, model.page.orientation);
    const margin = Layout.gridOf(model.page).margin;
    const wrap = document.createElement(`section`);
    wrap.className = `pageWrap`;
    const label = document.createElement(`div`);
    label.className = `pageLabel`;
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
    if (!empty) {
      for (const block of model.blocks) {
        if (block.page !== index) continue;
        const node = buildBlock(block);
        node.style.marginLeft = `${margin * mmPx}px`;
        node.style.marginTop = `${margin * mmPx}px`;
        page.appendChild(node);
      }
    }
    wrap.append(label, page);
    el.canvas.appendChild(wrap);
    return page;
  }

  // The element of the page `index`, with the pages before it when they do not exist yet (the pages that
  // only a long table uses are drawn but not saved).
  function pageElement(index) {
    let found = el.canvas.querySelector(`.page[data-page="${index}"]`);
    for (let next = el.canvas.querySelectorAll(`.page`).length; !found && next <= index; next += 1) {
      const page = makePage(next, true);
      if (next === index) found = page;
    }
    return found;
  }

  // Cuts the table of a block when its rows do not fit in its frame: the rows that do not fit in its frame move to
  // the free places of the following pages (pages are drawn when needed), with the title (followed by
  // "(continued)") and the heading again. Each frame of the rest of the table takes the height of its
  // rows, so that the rest of the page stays free. The heights of the rows are measured in the page, so the
  // cut follows the real layout. `taken` lists the frames already placed by other tables.
  function applyFlow(block, node, taken) {
    const table = node.querySelector(`table.dt`);
    const rows = [...table.tBodies[0].rows];
    if (!node.clientHeight || !rows.length) return;
    node.dataset.flow = `1`;
    const style = getComputedStyle(node);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const overhead = table.offsetTop - parseFloat(style.paddingTop) + table.tHead.offsetHeight;
    const stepPx = STEP_MM * mmPx;
    const regions = Flow.regionsAfter([...model.blocks, ...taken], block, Layout.MAX_PAGES, Layout.gridOf(model.page));
    const heights = rows.map((row) => row.offsetHeight);
    const rooms = regions.map((region) => region.h * stepPx - padding - overhead);
    const split = Flow.splitRows(heights, node.clientHeight - padding - overhead, rooms);
    rows.slice(split.chunks[0].end).forEach((row) => row.remove());
    let last = node;
    const used = new Set();
    split.chunks.slice(1).forEach((chunk, index) => {
      if (chunk.end <= chunk.start) return;
      const region = regions[index];
      const page = pageElement(region.page);
      const next = document.createElement(`div`);
      next.className = `block tableBlock continuation`;
      next.dataset.flow = `1`;
      next.dataset.parent = block.id;
      if (block.id === selectedId) next.classList.add(`selected`);
      next.style.fontSize = node.style.fontSize;
      next.style.marginLeft = node.style.marginLeft;
      next.style.marginTop = node.style.marginTop;
      if (block.title) {
        const title = document.createElement(`div`);
        title.className = `tableTitle`;
        title.textContent = `${block.title} ${tr(`boardSuite`)}`;
        next.appendChild(title);
      }
      const part = document.createElement(`table`);
      part.className = `dt`;
      part.appendChild(table.tHead.cloneNode(true));
      const body = part.createTBody();
      rows.slice(chunk.start, chunk.end).forEach((row) => body.appendChild(row));
      next.appendChild(part);
      const content = padding + overhead + heights.slice(chunk.start, chunk.end).reduce((sum, height) => sum + height, 0);
      const steps = Math.min(region.h, Math.max(Layout.MIN_SIZE, Math.ceil(content / stepPx)));
      const rect = { x: block.x, y: region.y, w: block.w, h: steps };
      place(next, rect);
      page.appendChild(next);
      taken.push({ id: `${block.id}:${region.page}:${region.y}`, page: region.page, ...rect });
      used.add(region.page);
      last = next;
    });
    node.classList.toggle(`overflowing`, split.leftover > 0 && last === node);
    last.classList.toggle(`overflowing`, split.leftover > 0);
    const pages = used.size ? Math.max(...used) - block.page : 0;
    flowInfo.set(block.id, { leftover: split.leftover, pages, used: [...used] });
  }

  // Draws every page with its blocks. With `focus` the selected block gets the keyboard focus again.
  function render(options = {}) {
    const hadFocus = Boolean(options.keepFocus) && el.canvas.contains(document.activeElement);
    computeScale();
    el.canvas.textContent = ``;
    el.canvas.classList.toggle(`editing`, editing);
    for (let index = 0; index < model.pages; index += 1) makePage(index, false);
    if (!model.blocks.length && !editing) {
      const hint = document.createElement(`p`);
      hint.className = `hint`;
      hint.textContent = tr(`boardEmpty`);
      el.canvas.appendChild(hint);
    }
    flowInfo.clear();
    const taken = [];
    for (const block of model.blocks) {
      if (block.type !== `table`) continue;
      const node = el.canvas.querySelector(`.block[data-id="${block.id}"]`);
      if (node && node.querySelector(`table.dt`)) applyFlow(block, node, taken);
    }
    const count = el.canvas.querySelectorAll(`.page`).length;
    if (editing && count < Layout.MAX_PAGES) makePage(count, true).classList.add(`newPage`);
    el.canvas.querySelectorAll(`.pageWrap`).forEach((wrap, index) => {
      const label = wrap.querySelector(`.pageLabel`);
      label.textContent = wrap.querySelector(`.page.newPage`) ? tr(`boardNewPage`) : tr(`boardPageLabel`, { n: index + 1, total: count });
    });
    for (const node of el.canvas.querySelectorAll(`.block.textBlock:not(.continuation), .block.tableBlock:not(.continuation), .block.recordBlock`)) {
      if (node.dataset.flow) continue;
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

  // The path of columns that leads from the selected row to the starting item of a choice: `Etage > Batiment`.
  const startPath = (choice) => choice.startSteps.map((step) => step.column).join(` > `);

  // The short name of a way to choose the rows of a table, for the menu (see Query.listChoices): for
  // example `Même Batiment que la ligne sélectionnée`.
  function choiceLabel(choice) {
    if (choice.kind === `all`) return tr(`labAllRows`);
    if (choice.kind === `self`) return choice.startSteps.length ? tr(`boardRowsOnly`, { item: startPath(choice) }) : tr(`labSelfRow`);
    if (choice.advanced) return choiceDetail(choice);
    const column = choice.steps[0].column;
    if (!choice.startSteps.length) return tr(`boardRowsSelected`, { column });
    const last = choice.startSteps[choice.startSteps.length - 1].column;
    return last === column && choice.startSteps.length === 1 ? tr(`boardRowsSame`, { column }) : tr(`boardRowsEqual`, { column, item: startPath(choice) });
  }

  // The full sentence about a choice of rows, shown under the menu.
  function choiceDetail(choice) {
    const linked = context().linked;
    const chain = choice.startSteps.map((step) => `${step.from}.${step.column}`).join(` > `);
    const where = choice.startSteps.length ? tr(`boardWhereItem`, { table: choice.startTable, chain }) : tr(`boardWhereSelected`, { table: linked });
    if (choice.kind === `all`) return tr(`labAllRows`);
    if (choice.kind === `self`) return choice.startSteps.length ? tr(`boardDetailOnly`, { where }) : tr(`labSelfRow`);
    const note = QUALITY_KEYS[choice.quality] ? ` ${tr(QUALITY_KEYS[choice.quality])}` : ``;
    if (choice.steps.length === 1) return tr(`boardDetailPointing`, { column: `${choice.steps[0].from}.${choice.steps[0].column}`, where }) + note;
    return tr(`boardDetailLinked`, { chain: choice.steps.map(describeStep).join(` ; `), where }) + note;
  }

  // True while the settings of the filters and of the sort are shown although nothing is set yet.
  const sectionOpen = { filters: false, sort: false };

  // True when the sort of a table block differs from the one it has without any setting.
  function sortActive(config) {
    return config.mode === `list` ? config.sort.by !== `none` : config.sort.by !== `key` || config.sort.dir !== `asc`;
  }

  // Shows or hides the settings of a section and sets its + or - button.
  function setToggle(button, body, open) {
    body.hidden = !open;
    button.textContent = open ? `\u2212` : `+`;
    button.setAttribute(`aria-expanded`, String(open));
    button.setAttribute(`aria-label`, tr(open ? `boardSectionHide` : `boardSectionShow`));
  }

  // The structure for which the filters and the column lines were built.
  let filtersFor = ``;
  let columnsFor = ``;
  let filterUis = [];
  // True while the "Learn more" panel about the rows of the table is open.
  let explainOpen = false;
  const NUMERIC_FUNCTIONS = [`sum`, `avg`, `min`, `max`];

  // Changes the settings of the selected block (text or table) and draws again.
  function changeConfig(changes) {
    const block = selectedBlock();
    if (block && (block.type === `text` || block.type === `table` || block.type === `record`)) commit(Model.updateBlock(model, block.id, { config: changes }));
  }

  // The paths of the columns that hold numbers, for the table of the selected table block.
  function numericOf(block) {
    const schema = context().schema;
    return schema && block.config.table && schema.tables.has(block.config.table) ? Query.numericPaths(schema, block.config.table) : new Set();
  }

  // The columns of a table block corrected so that each calculation fits its column: a calculation on
  // numbers needs a column of numbers (otherwise the count is used), and a grouped table has a calculation
  // on every column.
  function fitColumns(block, group) {
    const numeric = numericOf(block);
    return block.config.columns.map((column) => {
      let fn = column.fn;
      if (group && !fn) fn = column.path && numeric.has(column.path) ? `sum` : `count`;
      if (NUMERIC_FUNCTIONS.includes(fn) && column.path && !numeric.has(column.path)) fn = group ? `count` : ``;
      return { ...column, fn };
    });
  }

  // Builds the two lines of one column of the table. First line: the calculation, the two decimals
  // buttons and the heading. Second line: the column, then the buttons to move it up or down and to
  // remove it.
  function buildColumnRow(index, group) {
    const row = document.createElement(`div`);
    row.className = `colrow ${group ? `group` : `list`}`;
    row.dataset.index = String(index);
    const path = document.createElement(`select`);
    path.className = `colPath`;
    const fn = document.createElement(`select`);
    fn.className = `colFn`;
    const top = document.createElement(`div`);
    top.className = `colTop`;
    const bottom = document.createElement(`div`);
    bottom.className = `colBottom`;
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
    fn.addEventListener(`change`, () => {
      const block = selectedBlock();
      const current = block ? block.config.columns[index] : null;
      const needsNumbers = NUMERIC_FUNCTIONS.includes(fn.value);
      edit(needsNumbers && current && current.path && !numericOf(block).has(current.path) ? { fn: fn.value, path: `` } : { fn: fn.value });
    });
    label.addEventListener(`input`, () => edit({ label: label.value }));
    const stepDecimals = (delta) => {
      const block = selectedBlock();
      const current = block ? block.config.columns[index] : null;
      if (!current) return;
      const now = Number.isInteger(current.decimals) ? current.decimals : block.config.decimals;
      edit({ decimals: delta > 0 ? (now < 0 ? 2 : Math.min(4, now + 1)) : (now < 0 ? 0 : Math.max(0, now - 1)) });
    };
    top.append(fn, button(`\u2190.0`, `boardDecLess`, () => stepDecimals(-1)), button(`.00\u2192`, `boardDecMore`, () => stepDecimals(1)), label);
    bottom.append(
      path,
      button(`\u2191`, `boardColumnUp`, () => move(-1)),
      button(`\u2193`, `boardColumnDown`, () => move(1)),
      button(`\u00d7`, `boardColumnRemove`, () => {
        const block = selectedBlock();
        if (block) changeConfig({ columns: block.config.columns.filter((_, at) => at !== index) });
      })
    );
    row.append(top, bottom);
    return row;
  }

  // Shows the column lines of the table block, rebuilding them only when their number, the table or the
  // kind of table changes.
  function renderColumnRows(block, choices) {
    const config = block.config;
    const group = config.mode === `group`;
    const key = `${block.id}|${config.table}|${config.mode}|${config.columns.length}`;
    if (key !== columnsFor) {
      columnsFor = key;
      el.columnRows.textContent = ``;
      config.columns.forEach((_, index) => el.columnRows.appendChild(buildColumnRow(index, group)));
    }
    const numeric = numericOf(block);
    const all = FN_ORDER.map((name) => [name, tr(FN_SHORT_KEYS[name])]);
    config.columns.forEach((column, index) => {
      const row = el.columnRows.children[index];
      if (!row) return;
      const fn = column.fn || (group ? `sum` : ``);
      const needsNumbers = NUMERIC_FUNCTIONS.includes(fn);
      const available = group && needsNumbers ? choices.filter((choice) => numeric.has(choice.path)) : choices;
      const first = group && fn === `count` ? tr(`boardCountRows`) : tr(`boardColumnNone`);
      setOptions(row.querySelector(`.colPath`), [[``, first], ...available.map((choice) => [choice.path, choice.label])], column.path);
      const isNumber = column.path && numeric.has(column.path);
      const functions = group ? all : [[``, tr(`fnNoneShort`)], ...all.filter(([name]) => isNumber || !NUMERIC_FUNCTIONS.includes(name))];
      setOptions(row.querySelector(`.colFn`), functions, fn);
      setValue(row.querySelector(`.colLabel`), column.label);
    });
  }

  // Shows the list of the labels of the groups in the order that the table uses, with the buttons that
  // move a label up or down. The labels that the user ordered stay in the list even when the rows now
  // shown do not have them (they are marked and can be removed).
  function renderSortOrder(config, present) {
    const saved = config.sort.order;
    const list = [...saved, ...present.filter((label) => !present.length || !saved.includes(label))];
    const signature = JSON.stringify([list, present]);
    if (el.sortOrder.dataset.signature === signature) return;
    el.sortOrder.dataset.signature = signature;
    el.sortOrder.textContent = ``;
    const save = (order) => changeConfig({ sort: { ...config.sort, order } });
    const move = (index, delta) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return;
      const order = list.slice();
      [order[index], order[target]] = [order[target], order[index]];
      save(order);
    };
    list.forEach((label, index) => {
      const item = document.createElement(`li`);
      const name = document.createElement(`span`);
      name.className = `orderName`;
      const absent = present.length > 0 && !present.includes(label);
      name.textContent = absent ? `${label} ${tr(`sortAbsent`)}` : label;
      item.appendChild(name);
      const button = (text, key, action) => {
        const control = document.createElement(`button`);
        control.type = `button`;
        control.textContent = text;
        control.setAttribute(`aria-label`, `${tr(key)} : ${label}`);
        control.addEventListener(`click`, action);
        return control;
      };
      item.append(button(`\u2191`, `boardColumnUp`, () => move(index, -1)), button(`\u2193`, `boardColumnDown`, () => move(index, 1)));
      if (absent) item.appendChild(button(`\u00d7`, `boardColumnRemove`, () => save(list.filter((_, at) => at !== index))));
      el.sortOrder.appendChild(item);
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

  // The name of a group of tables in the table menu.
  const TABLE_GROUP_KEYS = { own: `boardTablesOwn`, related: `boardTablesRelated`, summary: `boardTablesSummary` };

  // Writes the "Learn more" panel: for each way to choose the rows of the table, how many rows it keeps
  // for the row that is selected now.
  function renderExplain(block) {
    const state = context();
    const config = block.config;
    el.explainBody.textContent = ``;
    if (!config.table || !state.record) return;
    const dataset = currentDataset();
    const lines = Query.explainChoices(state.schema, dataset, state.linked, state.record, config.table).filter((line) => line.choice.kind !== `all`);
    const intro = document.createElement(`p`);
    intro.textContent = tr(`boardExplainIntro`, { table: config.table, total: lines.length && lines[0].total !== null ? lines[0].total : `?`, linked: state.linked, id: state.record.id });
    const list = document.createElement(`ul`);
    for (const line of lines) {
      const item = document.createElement(`li`);
      const name = document.createElement(`strong`);
      name.textContent = choiceLabel(line.choice);
      const count = line.kept === null ? tr(`boardExplainUnknown`) : tr(`boardExplainKept`, { kept: line.kept, total: line.total });
      item.append(name, document.createTextNode(` : ${count}. ${line.choice.advanced ? `` : choiceDetail(line.choice)}`));
      list.appendChild(item);
    }
    const outro = document.createElement(`p`);
    outro.textContent = tr(`boardExplainFixed`);
    el.explainBody.append(intro, list, outro);
  }

  // Fills the settings of a table block and the messages about its content.
  function fillTableSettings(block) {
    const config = block.config;
    const state = context();
    const controls = [el.kind, el.tableSel, el.link, el.group1, el.merge, el.addColumn, el.sortBy, el.sortColumn, el.sortDir, el.total, el.totalRight, el.totalRightFn, el.totalRightLess, el.totalRightMore, el.filterToggle, el.sortToggle, el.moreLinks];
    controls.forEach((control) => { control.disabled = !state.schema; });
    if (!state.schema) {
      el.tableInfo.textContent = tr(`boardTableNotReady`);
      el.tableInfo.className = `warning`;
      return;
    }
    const schema = state.schema;
    const fixed = config.link === `all`;
    const starts = Query.listStarts(schema, state.linked);
    const start = starts.find((item) => item.key === config.start) || starts[0];
    const choices = config.table && schema.tables.has(config.table) ? Fields.sortChoices(Fields.fieldChoices(schema, config.table)) : [];
    const columnItems = [[``, tr(`boardItemNone`)], ...choices.map((choice) => [choice.path, choice.label])];
    setOptions(el.kind, [[`dynamic`, tr(`kindDynamic`)], [`fixed`, tr(`kindFixed`)]], fixed ? `fixed` : `dynamic`);
    const tables = fixed
      ? Query.listAllTables(schema).map((entry) => [entry.table, entry.summary ? `${entry.table} ${tr(`labQualitySummary`)}` : entry.table])
      : Query.listDynamicTables(schema, state.linked).map((entry) => [entry.table, entry.table, tr(TABLE_GROUP_KEYS[entry.group])]);
    setOptions(el.tableSel, [[``, tr(`boardColumnNone`)], ...tables], config.table);
    el.linkRow.hidden = fixed;
    if (!fixed) {
      const rowChoices = config.table && schema.tables.has(config.table) ? Query.listChoices(schema, state.linked, config.table).filter((item) => item.kind !== `all`) : [];
      const chosen = rowChoices.find((item) => item.start === config.start && item.link === config.link);
      const showAdvanced = el.moreLinks.checked || Boolean(chosen && chosen.advanced);
      if (chosen && chosen.advanced) el.moreLinks.checked = true;
      const main = rowChoices.filter((item) => !item.advanced).map((item) => [item.value, choiceLabel(item)]);
      const advanced = showAdvanced ? rowChoices.filter((item) => item.advanced).map((item) => [item.value, choiceDetail(item), tr(`boardAdvancedLinks`)]) : [];
      setOptions(el.link, [[``, tr(`boardColumnNone`)], ...main, ...advanced], chosen ? chosen.value : ``);
      const rowsTip = tr(`tipBoardRows`) + (chosen ? ` ${tr(`boardCurrentChoice`, { detail: choiceDetail(chosen) })}` : ``);
      el.rowsHelp.dataset.tip = rowsTip;
      el.rowsHelp.setAttribute(`aria-label`, rowsTip);
      el.explain.hidden = !explainOpen || !config.table;
      if (explainOpen && config.table) renderExplain(block);
    } else {
      el.explain.hidden = true;
    }
    el.groupRow.hidden = config.mode !== `group`;
    setOptions(el.group1, columnItems, config.groupBy[0] || ``);
    el.merge.checked = config.merge;
    const result = tableResult(block);
    const firstItem = config.groupBy.find(Boolean);
    const itemColumn = firstItem ? schema.tables.get(config.table).columns.find((column) => column.id === firstItem.split(`.`)[0]) : null;
    const byRef = Boolean(itemColumn) && itemColumn.kind === `ref`;
    const sortItems = config.mode === `list`
      ? [[`none`, tr(`sortNone`)], [`column`, tr(`sortByColumn`)]]
      : [[`key`, tr(`sortByKey`)], [`value`, tr(`sortByValue`)], ...(byRef ? [[`ref`, tr(`sortByRef`)]] : []), [`manual`, tr(`sortByManual`)]];
    const sortBy = sortItems.some(([value]) => value === config.sort.by) ? config.sort.by : sortItems[0][0];
    setOptions(el.sortBy, sortItems, sortBy);
    el.sortColumn.hidden = !(config.mode === `list` && sortBy === `column`);
    setOptions(el.sortColumn, [[``, tr(`sortChoose`)], ...choices.map((choice) => [choice.path, choice.label])], config.sort.column);
    setOptions(el.sortDir, [[`asc`, tr(`sortAsc`)], [`desc`, tr(`sortDesc`)]], config.sort.dir);
    el.sortDir.parentElement.hidden = sortBy === `manual`;
    el.sortOrderBox.hidden = !(config.mode === `group` && sortBy === `manual`);
    if (!el.sortOrderBox.hidden) renderSortOrder(config, result.ok && config.mode === `group` ? result.rows.map((row) => row[0]) : []);
    const filtersOpen = sectionOpen.filters || config.filters.length > 0;
    const sortOpen = sectionOpen.sort || sortActive(config);
    setToggle(el.filterToggle, el.filterBody, filtersOpen);
    setToggle(el.sortToggle, el.sortBody, sortOpen);
    el.total.checked = config.total;
    const rightOn = Query.rightTotalPossible(config);
    el.totalRight.disabled = !rightOn;
    el.totalRight.checked = config.totalRight && rightOn;
    el.totalRightRow.hidden = !el.totalRight.checked;
    setOptions(el.totalRightFn, FN_ORDER.map((name) => [name, tr(FN_SHORT_KEYS[name])]), config.totalRightFn);
    if (el.more.dataset.block !== block.id) {
      el.more.dataset.block = block.id;
      el.more.open = filtersOpen || sortOpen;
    }
    renderColumnRows(block, choices);
    renderFilters(block, choices, Fields.fieldChoices(schema, start.table));
    const messages = [];
    if (result.ok) {
      messages.push(tr(`boardTableCounts`, { kept: result.kept, total: result.scanned }));
      result.warnings.forEach((reason) => messages.push(tr(`boardTableFilterIgnored`, { reason })));
      if (result.truncated) messages.push(tr(`boardTableTruncated`, { max: Query.MAX_ROWS }));
    } else if (result.reason !== `choose`) {
      messages.push(reasonText(result));
    }
    const node = el.canvas.querySelector(`.block[data-id="${block.id}"]`);
    const overflow = Boolean(node) && node.classList.contains(`overflowing`);
    const info = flowInfo.get(block.id);
    if (info && info.leftover > 0) messages.push(tr(`boardTableMoreRows`, { n: info.leftover }));
    else if (overflow) messages.push(tr(`boardTableOverflow`));
    if (info && info.pages > 0) messages.push(tr(`boardTablePages`, { n: info.pages + 1 }));
    el.tableInfo.textContent = messages.join(` `);
    el.tableInfo.className = overflow || (result.ok && (result.warnings.length || result.truncated)) || (!result.ok && result.reason !== `choose`) ? `warning` : `hint`;
  }

  // Fills the settings panel with the selected block.
  function fillPanel() {
    const block = selectedBlock();
    if (!block) return;
    setValue(el.title, block.title);
    el.titleRow.hidden = block.type === `text`;
    el.tableBox.hidden = block.type !== `table`;
    if (block.type === `table`) fillTableSettings(block);
    el.textBox.hidden = block.type !== `text`;
    if (block.type === `text`) fillTextSettings(block);
    el.recordBox.hidden = block.type !== `record`;
    if (block.type === `record`) fillRecordSettings(block);
  }

  // Selects a block (or none) and opens or closes its settings.
  function select(id, openPanel) {
    if (id !== selectedId) {
      sectionOpen.filters = false;
      sectionOpen.sort = false;
      explainOpen = false;
    }
    selectedId = id;
    panelOpen = Boolean(id) && openPanel;
    if (!panelOpen) explainOpen = false;
    for (const node of el.canvas.querySelectorAll(`.block`)) node.classList.toggle(`selected`, (node.dataset.parent || node.dataset.id) === id);
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
    else if (finished.kind === `move`) commit(Model.moveBlock(model, finished.id, finished.last.wanted, el.canvas.querySelectorAll(`.page`).length - 1), { focus: true });
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
    if (node.dataset.parent) {
      if (node.dataset.parent !== selectedId) select(node.dataset.parent, panelOpen);
      return;
    }
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
    if (node) select(node.dataset.parent || node.dataset.id, true);
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
  el.remove.addEventListener(`click`, askDelete);
  el.close.addEventListener(`click`, () => select(selectedId, false));
  el.confirmYes.addEventListener(`click`, confirmDelete);
  el.confirmNo.addEventListener(`click`, cancelDelete);


  // The settings of the table block that depend on the table are cleared when the table changes.
  const tableReset = (fixed) => ({ start: ``, link: fixed ? `all` : ``, columns: [], groupBy: [], filters: [], sort: { by: `none`, column: ``, dir: `asc`, order: [] } });
  el.kind.addEventListener(`change`, () => {
    const block = selectedBlock();
    const state = context();
    if (!block) return;
    if (el.kind.value === `fixed`) {
      changeConfig({ start: ``, link: `all` });
      return;
    }
    const pool = Query.listDynamicTables(state.schema, state.linked).map((entry) => entry.table);
    changeConfig(pool.includes(block.config.table) ? { start: ``, link: `` } : { table: ``, ...tableReset(false) });
  });
  el.tableSel.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (block) changeConfig({ table: el.tableSel.value, ...tableReset(block.config.link === `all`) });
  });
  el.link.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (!block) return;
    const [start, link] = el.link.value ? el.link.value.split(`|`) : [``, ``];
    changeConfig(start === block.config.start ? { start, link } : { start, link, filters: [] });
  });
  el.moreLinks.addEventListener(`change`, () => render({ keepFocus: true }));
  Help.setMore(el.rowsHelp, () => {
    explainOpen = true;
    render({ keepFocus: true });
  });
  el.explainClose.addEventListener(`click`, () => {
    explainOpen = false;
    render({ keepFocus: true });
  });
  el.explainHead.addEventListener(`pointerdown`, (event) => {
    if (event.target === el.explainClose) return;
    const box = el.explain.getBoundingClientRect();
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    el.explainHead.setPointerCapture(event.pointerId);
    const move = (next) => {
      el.explain.style.left = `${Math.max(0, Math.min(next.clientX - dx, window.innerWidth - 60))}px`;
      el.explain.style.top = `${Math.max(0, Math.min(next.clientY - dy, window.innerHeight - 40))}px`;
      el.explain.style.right = `auto`;
    };
    const stop = () => {
      el.explainHead.removeEventListener(`pointermove`, move);
      el.explainHead.removeEventListener(`pointerup`, stop);
    };
    el.explainHead.addEventListener(`pointermove`, move);
    el.explainHead.addEventListener(`pointerup`, stop);
  });
  el.group1.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (!block) return;
    const group = Boolean(el.group1.value);
    changeConfig({ groupBy: [el.group1.value], sort: { ...block.config.sort, by: group ? `key` : `none` }, columns: fitColumns(block, group) });
  });
  el.recordAdd.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (block && block.config.items.length < Model.MAX_RECORD_ITEMS) changeConfig({ items: [...block.config.items, { path: ``, label: `` }] });
  });
  el.recordColumns.addEventListener(`change`, () => changeConfig({ columns: Number(el.recordColumns.value) }));
  el.recordSize.addEventListener(`change`, () => changeConfig({ size: el.recordSize.value }));
  el.merge.addEventListener(`change`, () => changeConfig({ merge: el.merge.checked }));
  el.addColumn.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (block && block.config.columns.length < Model.MAX_COLUMNS) changeConfig({ columns: [...block.config.columns, { path: ``, fn: block.config.mode === `group` ? `sum` : ``, label: `` }] });
  });
  const changeSort = () => {
    const block = selectedBlock();
    if (block) changeConfig({ sort: { ...block.config.sort, by: el.sortBy.value, column: el.sortColumn.value, dir: el.sortDir.value } });
  };
  el.sortBy.addEventListener(`change`, changeSort);
  el.sortColumn.addEventListener(`change`, changeSort);
  el.sortDir.addEventListener(`change`, changeSort);
  el.total.addEventListener(`change`, () => changeConfig({ total: el.total.checked }));
  el.totalRight.addEventListener(`change`, () => changeConfig({ totalRight: el.totalRight.checked }));
  el.totalRightFn.addEventListener(`change`, () => changeConfig({ totalRightFn: el.totalRightFn.value }));
  const stepRight = (delta) => {
    const block = selectedBlock();
    if (!block) return;
    const now = Number.isInteger(block.config.totalRightDecimals) ? block.config.totalRightDecimals : block.config.decimals;
    changeConfig({ totalRightDecimals: delta > 0 ? (now < 0 ? 2 : Math.min(4, now + 1)) : (now < 0 ? 0 : Math.max(0, now - 1)) });
  };
  el.totalRightLess.addEventListener(`click`, () => stepRight(-1));
  el.totalRightMore.addEventListener(`click`, () => stepRight(1));
  el.filterToggle.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (!block) return;
    const open = sectionOpen.filters || block.config.filters.length > 0;
    sectionOpen.filters = !open;
    if (open) {
      filtersFor = ``;
      changeConfig({ filters: [] });
    } else {
      render({ keepFocus: true });
    }
  });
  el.sortToggle.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (!block) return;
    const open = sectionOpen.sort || sortActive(block.config);
    sectionOpen.sort = !open;
    if (open) changeConfig({ sort: { by: block.config.mode === `list` ? `none` : `key`, column: ``, dir: `asc`, order: [] } });
    else render({ keepFocus: true });
  });
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
