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
  const ImageCell = window.exportTdbImage;
  const Named = window.exportTdbNamed;
  const Indicator = window.exportTdbIndicator;
  const ChartOption = window.exportTdbChartOption;
  const Echarts = window.exportTdbEcharts;
  const Format = window.exportTdbFormat;
  const IndicatorPanel = window.exportTdbIndicatorPanel;
  const ValuesPanel = window.exportTdbValuesPanel;
  const Help = window.exportTdbHelp;
  const Data = window.exportTdbData;
  const { createDataset } = window.exportTdbDataset;
  const { describeStep } = window.exportTdbSchema;
  const Query = window.exportTdbTableQuery;
  const FilterUi = window.exportTdbFilterUi;
  const { STEP_MM } = Layout;

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const Icons = window.exportTdbIcons;
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
  const CHART_TYPE_KEYS = { bar: `chartBar`, stack: `chartStack`, barh: `chartBarh`, barhStack: `chartBarhStack`, line: `chartLine`, area: `chartArea`, pie: `chartPie`, donut: `chartDonut`, treemap: `chartTreemap`, scatter: `chartScatter` };
  const INDICATOR_COLOR_KEYS = { none: `indColorNone`, green: `indColorGreen`, orange: `indColorOrange`, red: `indColorRed`, blue: `indColorBlue`, grey: `indColorGrey` };
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
    panel: $(`panelBoard`), notice: $(`boardNotice`), edit: $(`boardEdit`), print: $(`boardPrint`), numbers: $(`boardNumbers`), footerText: $(`boardFooter`), tools: $(`boardTools`),
    addMenu: $(`boardAddMenu`), formatButton: $(`boardFormatButton`), orientation: $(`boardOrientation`), marginButton: $(`boardMarginButton`),
    footerButton: $(`boardFooterButton`), menu: $(`boardMenu`), debug: $(`boardDebug`), debugBox: $(`boardDebugBox`), debugText: $(`boardDebugText`), debugClose: $(`boardDebugClose`),
    zoom: $(`boardZoom`), saveState: $(`boardSaveState`), scroll: $(`boardScroll`), canvas: $(`boardCanvas`),
    side: $(`boardPanel`), titleRow: $(`boardTitleRow`), title: $(`boardTitle`), remove: $(`boardDelete`), close: $(`boardClose`), refresh: $(`boardRefresh`),
    textBox: $(`boardTextSettings`), chartBox: $(`boardChartSettings`), chartType: $(`boardChartType`), chartPalette: $(`boardChartPalette`), chartLegend: $(`boardChartLegend`), chartLabels: $(`boardChartLabels`), chartInfo: $(`boardChartInfo`), crossBox: $(`boardCrossBox`), crossMore: $(`boardCrossMore`), colItem: $(`boardColItem`), slice: $(`boardSlice`), colSort: $(`boardColSort`), indicatorBox: $(`boardIndicatorSettings`), indicatorBody: $(`boardIndicatorBody`), valuesBox: $(`boardValuesSettings`), valuesList: $(`boardValuesList`), valuesAdd: $(`boardValuesAdd`), valuesButton: $(`boardValuesButton`), heading: $(`boardPanelHeading`), imageBox: $(`boardImageSettings`), imageColumn: $(`boardImageColumn`), imageRank: $(`boardImageRank`), imageCaption: $(`boardImageCaption`), imageInfo: $(`boardImageInfo`), recordBox: $(`boardRecordSettings`), recordRows: $(`boardRecordRows`), recordAdd: $(`boardRecordAdd`), recordColumns: $(`boardRecordColumns`), recordSize: $(`boardRecordSize`), recordInfo: $(`boardRecordInfo`), source: $(`boardSource`), columnRow: $(`boardColumnRow`), column: $(`boardColumn`),
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
  // True while the settings panel shows the named values instead of a block.
  let valuesOpen = false;
  let zoomIndex = ZOOMS.indexOf(1);
  let drag = null;
  let saveTimer = null;
  // Pixels per millimetre of the page on the screen.
  let mmPx = 1;
  // True while the pages are drawn at their real size for the print window.
  let printing = false;
  const PRINT_MM_PX = 96 / 25.4;
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
    const result = Fields.expandFields(tree, fieldResolver());
    return { nodes: result.nodes, problems: result.problems, empty };
  }

  // The function that reads a field `{name}` or `{Column}` of the selected row: a named value comes first, then a
  // column (also through a reference). Used by the texts and by the notes of the indicators.
  function fieldResolver() {
    const state = context();
    const words = { yes: tr(`wordYes`), no: tr(`wordNo`) };
    const dataset = currentDataset();
    const named = namedValues().byName;
    return (path) => {
      const value = path.includes(`.`) ? null : named.get(path);
      if (value) return value.error ? { ok: false, reason: `named` } : { ok: true, text: value.text };
      return Fields.resolveField(dataset, state.schema, state.linked, state.record, path, words);
    };
  }

  // The text of the note of an indicator with its fields replaced.
  function noteText(block) {
    const state = context();
    if (!block.config.note || !state.schema || !state.record) return block.config.note;
    return Fields.expandFields([{ type: `text`, value: block.config.note }], fieldResolver()).nodes[0].value;
  }

  // The result of the named values for the selected row, kept until the data, the row or the values change.
  let namedMemo = null;
  function namedValues() {
    const state = context();
    if (!state.schema || !state.record) return { byName: new Map(), list: [] };
    const dataset = currentDataset();
    const key = JSON.stringify(model.values);
    if (namedMemo && namedMemo.dataset === dataset && namedMemo.record === state.record && namedMemo.key === key && namedMemo.linked === state.linked) return namedMemo.result;
    const result = Named.evaluateValues(state.schema, dataset, state.linked, state.record, model.values, { yes: tr(`wordYes`), no: tr(`wordNo`) });
    namedMemo = { dataset, record: state.record, key, linked: state.linked, result };
    return result;
  }

  // Loads the tables that the text blocks and the table blocks need, then draws again.
  function requestData() {
    const state = context();
    if (!state.schema || !state.record || loadingData) return;
    const paths = new Set();
    const wanted = new Set();
    for (const block of model.blocks) {
      if (block.type === `text`) Fields.extractFields(sourceText(block)).forEach((path) => paths.add(path));
      if (block.type === `table` || block.type === `chart`) Query.tablesFor(state.schema, state.linked, block.config).forEach((name) => wanted.add(name));
      if (block.type === `record`) Record.recordPaths(block.config).forEach((path) => paths.add(path));
      if (block.type === `indicator`) Fields.extractFields(block.config.note).forEach((path) => paths.add(path));
      if (block.type === `image`) {
        if (block.config.path) paths.add(block.config.path);
        if (block.config.caption) paths.add(block.config.caption);
      }
      if ((block.type === `table` || block.type === `chart`) && explainOpen && block.id === selectedId && block.config.table) Query.tablesForChoices(state.schema, state.linked, block.config.table).forEach((name) => wanted.add(name));
    }
    // A row that the loaded table does not hold yet (added since it was loaded): load the table again, once.
    const loadedLinked = Data.tables().get(state.linked);
    if (loadedLinked && paths.size && !(loadedLinked.id || []).includes(state.record.id) && !reloadedFor.has(state.record.id)) {
      reloadedFor.add(state.record.id);
      Data.drop(state.linked);
    }
    Fields.tablesForPaths(state.schema, state.linked, [...paths]).forEach((name) => wanted.add(name));
    Named.tablesForValues(state.schema, state.linked, model.values).forEach((name) => wanted.add(name));
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

  // The models before the last changes (to undo them) and the ones that were undone (to do them again). Changes made
  // less than HISTORY_MERGE_MS after the previous one (typing a text) make a single step.
  const history = { past: [], future: [], last: 0 };
  const HISTORY_MAX = 100;
  const HISTORY_MERGE_MS = 600;

  // Keeps the model that a change is about to replace.
  function remember(previous) {
    const now = Date.now();
    if (now - history.last > HISTORY_MERGE_MS) {
      history.past.push(previous);
      if (history.past.length > HISTORY_MAX) history.past.shift();
    }
    history.last = now;
    history.future = [];
  }

  // Goes back to the previous model (`direction` -1), or forward to the one that was undone (1).
  function undo(direction) {
    const source = direction < 0 ? history.past : history.future;
    if (!source.length || locked) return;
    (direction < 0 ? history.future : history.past).push(model);
    model = source.pop();
    history.last = 0;
    if (selectedId && !Model.findBlock(model, selectedId)) {
      selectedId = null;
      panelOpen = false;
    }
    render();
    scheduleSave();
  }

  // Replaces the model by a new one, draws it and saves it.
  function commit(next, options = {}) {
    if (next === model) {
      render(options);
      return;
    }
    remember(model);
    model = Model.compactPages(next, flowPages());
    if (selectedId && !Model.findBlock(model, selectedId)) selectedId = null;
    render(options);
    scheduleSave();
  }

  // ------------------------------------------------------------------ Drawing

  // Computes the scale so that the page fills the width of the area, times the zoom.
  function computeScale() {
    if (printing) {
      mmPx = PRINT_MM_PX;
      return;
    }
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

  // The charts drawn by the last drawing, to be drawn again or forgotten at the next one, and the charts waiting for
  // their element to be in the page (their size is known only then).
  let chartInstances = [];
  let chartPending = [];

  // Fills the element of a chart block: its title and the place where the chart is drawn once the page is built, or
  // a hint in the editing mode when there is nothing to draw yet.
  function buildChartBody(node, block) {
    node.classList.add(`chartBlock`);
    node.style.fontSize = `${TABLE_MM * mmPx}px`;
    if (block.title) {
      const title = document.createElement(`div`);
      title.className = `chartTitle`;
      title.textContent = block.title;
      node.appendChild(title);
    }
    const result = tableResult(block);
    const scatter = block.config.chart === `scatter`;
    const wrongMode = scatter ? block.config.mode !== `list` : block.config.mode === `list`;
    const data = scatter ? result.scatter : result.chart;
    const hasData = Boolean(data) && (scatter ? data.series.some((one) => one.points.length) : data.categories.length > 0);
    if (result.ok && !wrongMode && hasData) {
      const plot = document.createElement(`div`);
      plot.className = `chartPlot`;
      node.appendChild(plot);
      chartPending.push({ plot, block, data });
    } else if (editing) {
      const hint = document.createElement(`p`);
      hint.className = `tableHint`;
      hint.textContent = result.ok && wrongMode ? tr(scatter ? `chartScatterNeedsList` : `chartNeedsItem`) : result.ok ? tr(scatter ? `chartScatterNoData` : `chartNoData`) : reasonText(result);
      node.appendChild(hint);
    }
  }

  // Draws the charts of the blocks that are now in the page, in SVG, and forgets the ones of the last drawing.
  function drawCharts() {
    for (const { plot, block, data } of chartPending) {
      const width = plot.clientWidth;
      const height = plot.clientHeight;
      if (width < 30 || height < 30) continue;
      const decimals = block.config.columns.length && Number.isInteger(block.config.columns[0].decimals) ? block.config.columns[0].decimals : block.config.decimals;
      const option = ChartOption.buildOption(block.config, data, { fontSize: Math.max(8, TABLE_MM * mmPx), format: Format.formatNumber, decimals, width, height });
      if (!option) continue;
      const instance = Echarts.init(plot, null, { renderer: `svg`, width, height });
      instance.setOption(option);
      chartInstances.push(instance);
    }
    chartPending = [];
  }

  // Fills the element of an indicator block: its label (the title of the block), its value in bold with a symbol
  // that tells the state, and a short note. The colour follows the thresholds; the text stays dark.
  function buildIndicatorBody(node, block) {
    const config = block.config;
    node.classList.add(`indicatorBlock`);
    node.style.fontSize = `${TEXT_MM[config.size] * mmPx}px`;
    const named = config.value ? namedValues().byName.get(config.value) : null;
    const ok = Boolean(named) && !named.error;
    const color = Indicator.pickColor(config, ok ? named.number : null);
    node.classList.add(`ind-${color}`);
    if (block.title) {
      const label = document.createElement(`div`);
      label.className = `indLabelText`;
      label.textContent = block.title;
      node.appendChild(label);
    }
    const row = document.createElement(`div`);
    row.className = `indValueRow`;
    const value = document.createElement(`span`);
    value.className = `indValueText`;
    value.textContent = ok ? named.text : Named.DASH;
    row.appendChild(value);
    if (Indicator.SYMBOLS[color]) {
      const symbol = document.createElement(`span`);
      symbol.className = `indSymbol`;
      symbol.textContent = Indicator.SYMBOLS[color];
      symbol.setAttribute(`role`, `img`);
      symbol.setAttribute(`aria-label`, tr(INDICATOR_COLOR_KEYS[color]));
      row.appendChild(symbol);
    }
    node.appendChild(row);
    const note = noteText(block);
    if (note) {
      const small = document.createElement(`div`);
      small.className = `indNoteText`;
      small.textContent = note;
      node.appendChild(small);
    }
    if (editing && !config.value) {
      const hint = document.createElement(`p`);
      hint.className = `tableHint`;
      hint.textContent = tr(`indicatorNoValue`);
      node.appendChild(hint);
    }
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

  // Fills the settings of a chart block: the type, the palette, the legend and the labels. The data are the
  // settings of a table (the same panel, filled by fillTableSettings).
  function fillChartSettings(block) {
    const config = block.config;
    setOptions(el.chartType, ChartOption.CHART_TYPES.map((name) => [name, tr(CHART_TYPE_KEYS[name])]), config.chart);
    setOptions(el.chartPalette, ChartOption.PALETTE_KEYS.map((name) => [name, tr(`palette_${name}`)]), config.palette);
    setOptions(el.chartLegend, ChartOption.LEGENDS.map((name) => [name, tr(`legend_${name}`)]), config.legend);
    setOptions(el.chartLabels, ChartOption.LABELS.map((name) => [name, tr(`labels_${name}`)]), config.labels);
    const result = tableResult(block);
    const pie = config.chart === `pie` || config.chart === `donut` || config.chart === `treemap`;
    const scatter = config.chart === `scatter`;
    const messages = [];
    if (scatter) {
      if (config.mode !== `list`) messages.push(tr(`chartScatterNeedsList`));
      else if (!result.ok && result.reason !== `choose`) messages.push(reasonText(result));
      else if (result.ok && !(result.scatter && result.scatter.kept)) messages.push(tr(`chartScatterNoData`));
      else if (result.ok && result.scatter.groups > result.scatter.series.length) messages.push(tr(`chartScatterGroups`, { max: result.scatter.series.length }));
      if (!messages.length) messages.push(tr(`chartScatterHint`));
    } else if (config.mode === `list`) {
      messages.push(tr(`chartNeedsItem`));
    } else if (!result.ok && result.reason !== `choose`) {
      messages.push(reasonText(result));
    } else if (result.ok && !(result.chart && result.chart.categories.length)) {
      messages.push(tr(`chartNoData`));
    }
    if (pie && result.ok && result.chart && result.chart.series.length > 1) messages.push(tr(`chartPieFirst`));
    if (config.labels === `percent` && !pie && !scatter) messages.push(tr(`chartPercentPie`));
    el.chartInfo.textContent = messages.join(` `);
    el.chartInfo.className = messages.length ? `warning` : `hint`;
  }

  // What an image block shows for the selected row: { state, picture, message }. `state` is `choose` (no column
  // yet), `waiting` (the data are loading), `problem` (a message to show), `empty` (no picture at this rank) or
  // `picture` (a picture to load, see ImageCell.pictureAt).
  function imageStatus(block) {
    const config = block.config;
    const state = context();
    if (!config.path) return { state: `choose` };
    if (!state.schema || !state.record) return { state: `waiting` };
    const read = Fields.resolveFieldFull(currentDataset(), state.schema, state.linked, state.record, config.path, { yes: tr(`wordYes`), no: tr(`wordNo`) });
    if (!read.ok) return read.reason === `notloaded` ? { state: `waiting` } : { state: `problem`, message: tr(`imageUnknownColumn`, { column: config.path }) };
    const picture = ImageCell.pictureAt(read.raw, config.rank);
    if (picture.status === `empty`) return { state: `empty`, count: ImageCell.countImages(read.raw) };
    if (picture.status === `rejected`) return { state: `problem`, message: tr(picture.reason === `link` ? `imageRejectedLink` : `imageRejectedFormat`, { text: picture.text }) };
    if (picture.status === `onedrive`) return { state: `problem`, message: tr(`imageOnedrive`) };
    return { state: `picture`, picture };
  }

  // The caption of an image block: the value of its caption column for the selected row, or an empty text.
  function captionText(block) {
    const state = context();
    if (!block.config.caption || !state.schema || !state.record) return ``;
    const read = Fields.resolveField(currentDataset(), state.schema, state.linked, state.record, block.config.caption, { yes: tr(`wordYes`), no: tr(`wordNo`) });
    return read.ok ? read.text.trim() : ``;
  }

  // Loads a picture in an image element: an attachment through the token of Grist, a link through the addresses to
  // try in turn. On failure the element is replaced by `fail()`.
  async function loadPicture(img, picture, fail) {
    let candidates = [];
    if (picture.status === `attachment`) {
      try {
        candidates = [await access.attachmentAddress(picture.id)];
        if (!img.isConnected) return;
      } catch {
        fail(tr(`imageTokenError`));
        return;
      }
    } else {
      candidates = picture.candidates;
    }
    let attempt = 0;
    img.onerror = () => {
      attempt += 1;
      if (attempt < candidates.length) img.src = candidates[attempt];
      else fail(tr(`imageLoadError`));
    };
    img.referrerPolicy = `no-referrer`;
    img.src = candidates[0];
  }

  // Fills the element of an image block: its title, the picture that fills the frame without being deformed (the
  // edges are cut when the proportions differ, the picture stays centred) and a caption, or a message.
  function buildImageBody(node, block) {
    node.classList.add(`imageBlock`);
    node.style.fontSize = `${TABLE_MM * mmPx}px`;
    if (block.title) {
      const title = document.createElement(`div`);
      title.className = `imageTitle`;
      title.textContent = block.title;
      node.appendChild(title);
    }
    const frame = document.createElement(`div`);
    frame.className = `imageFrame`;
    node.appendChild(frame);
    const status = imageStatus(block);
    const message = (text, warning) => {
      frame.textContent = ``;
      const note = document.createElement(`p`);
      note.className = warning ? `imageMessage` : `tableHint`;
      note.textContent = text;
      frame.appendChild(note);
    };
    if (status.state === `picture`) {
      const img = document.createElement(`img`);
      img.className = `imagePicture`;
      img.alt = captionText(block) || block.title || ``;
      frame.appendChild(img);
      loadPicture(img, status.picture, (text) => message(text, true));
    } else if (status.state === `problem`) {
      message(status.message, true);
    } else if (editing) {
      message(status.state === `choose` ? tr(`imageChoose`) : status.state === `waiting` ? tr(`imageWaiting`) : tr(`imageEmpty`, { rank: block.config.rank }), false);
    }
    const caption = captionText(block);
    if (caption) {
      const line = document.createElement(`div`);
      line.className = `imageCaption`;
      line.textContent = caption;
      node.appendChild(line);
    }
  }

  // Fills the settings of an image block: the column, the rank and the caption.
  function fillImageSettings(block) {
    const config = block.config;
    const state = context();
    const choices = state.schema && state.linked && state.schema.tables.has(state.linked) ? Fields.sortChoices(Fields.imageChoices(state.schema, state.linked)) : [];
    setOptions(el.imageColumn, [[``, tr(`boardColumnNone`)], ...choices.map((choice) => [choice.path, choice.label])], config.path);
    const captionChoices = state.schema && state.linked && state.schema.tables.has(state.linked) ? Fields.sortChoices(Fields.fieldChoices(state.schema, state.linked)) : [];
    setOptions(el.imageCaption, [[``, tr(`imageNoCaption`)], ...captionChoices.map((choice) => [choice.path, choice.label])], config.caption);
    setValue(el.imageRank, String(config.rank));
    const status = imageStatus(block);
    const messages = [];
    if (!state.schema) messages.push(tr(`boardTableNotReady`));
    else if (status.state === `empty`) messages.push(tr(status.count ? `imageRankMissing` : `imageEmpty`, { rank: config.rank }));
    else if (status.state === `problem`) messages.push(status.message);
    el.imageInfo.textContent = messages.join(` `);
    el.imageInfo.className = messages.length ? `warning` : `hint`;
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
      (result.slices || [result]).forEach((slice, at) => {
        const part = drawTable(slice);
        if (at) part.classList.add(`sliceNext`);
        node.appendChild(part);
      });
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

  // Builds the element of one block, with its cross (which deletes it) and its three resize handles.
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
    } else if (block.type === `indicator`) {
      buildIndicatorBody(node, block);
    } else if (block.type === `chart`) {
      buildChartBody(node, block);
    } else if (block.type === `image`) {
      buildImageBody(node, block);
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
      const cross = document.createElement(`button`);
      cross.type = `button`;
      cross.className = `cross`;
      cross.textContent = `\u00d7`;
      cross.setAttribute(`aria-label`, tr(`boardDeleteBlock`));
      node.appendChild(cross);
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
    chartInstances.forEach((instance) => instance.dispose());
    chartInstances = [];
    chartPending = [];
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
      if (node && node.querySelectorAll(`table.dt`).length === 1) applyFlow(block, node, taken);
    }
    drawCharts();
    const count = el.canvas.querySelectorAll(`.page`).length;
    if (editing && count < Layout.MAX_PAGES) makePage(count, true).classList.add(`newPage`);
    el.canvas.querySelectorAll(`.pageWrap`).forEach((wrap, index) => {
      const label = wrap.querySelector(`.pageLabel`);
      label.textContent = wrap.querySelector(`.page.newPage`) ? tr(`boardNewPage`) : tr(`boardPageLabel`, { n: index + 1, total: count });
    });
    addFooters();
    for (const node of el.canvas.querySelectorAll(`.block.textBlock:not(.continuation), .block.tableBlock:not(.continuation), .block.recordBlock, .block.indicatorBlock`)) {
      if (node.dataset.flow) continue;
      node.classList.toggle(`overflowing`, node.scrollHeight > node.clientHeight + 2);
    }
    syncTools();
    if (panelOpen || valuesOpen) fillPanel();
    requestData();
    if ((options.focus || hadFocus) && selectedId) {
      const node = el.canvas.querySelector(`.block[data-id="${selectedId}"]`);
      if (node) node.focus({ preventScroll: true });
    }
  }

  // Writes the footer of the pages (the free text on the left, the page number on the right) in the bottom margin of
  // every page, when the page settings ask for it. At least 5 mm are kept for it.
  function addFooters() {
    if (!model.page.numbers && !model.page.footer) return;
    const pages = [...el.canvas.querySelectorAll(`.page:not(.newPage)`)];
    const margin = Math.max(5, Layout.gridOf(model.page).margin);
    pages.forEach((page, index) => {
      const footer = document.createElement(`div`);
      footer.className = `pageFooter`;
      footer.style.left = `${Layout.gridOf(model.page).margin * mmPx}px`;
      footer.style.right = `${Layout.gridOf(model.page).margin * mmPx}px`;
      footer.style.height = `${margin * mmPx}px`;
      footer.style.fontSize = `${Math.min(margin * 0.6, 3.2) * mmPx}px`;
      const text = document.createElement(`span`);
      text.className = `footerText`;
      text.textContent = model.page.footer;
      const number = document.createElement(`span`);
      number.className = `footerNumber`;
      number.textContent = model.page.numbers ? tr(`boardPageNumber`, { n: index + 1, total: pages.length }) : ``;
      footer.append(text, number);
      page.appendChild(footer);
    });
  }

  // Shows or hides the tools and sets the controls to the state of the model.
  function syncTools() {
    el.edit.textContent = editing ? tr(`boardDone`) : tr(`boardEdit`);
    el.edit.disabled = locked;
    el.edit.title = editing ? tr(`boardHelp`) : ``;
    el.tools.hidden = !editing;
    el.valuesButton.hidden = !editing;
    el.debug.hidden = !editing;
    if (!editing) closeMenu(false);
    const showPanel = editing && (valuesOpen || (panelOpen && Boolean(selectedBlock())));
    el.valuesButton.setAttribute(`aria-expanded`, String(valuesOpen));
    el.side.hidden = !showPanel;
    $(`boardLayout`).classList.toggle(`withPanel`, showPanel);
    const landscape = model.page.orientation === `landscape`;
    Icons.setIcon(el.orientation, model.page.orientation);
    el.orientation.dataset.tip = tr(landscape ? `barOrientationLandscape` : `barOrientationPortrait`);
    el.orientation.setAttribute(`aria-label`, el.orientation.dataset.tip);
    el.numbers.setAttribute(`aria-pressed`, String(model.page.numbers));
    el.numbers.classList.toggle(`on`, model.page.numbers);
    el.footerButton.classList.toggle(`on`, Boolean(model.page.footer));
    for (const item of el.menu.querySelectorAll(`[data-format]`)) item.classList.toggle(`current`, item.dataset.format === model.page.format);
    for (const item of el.menu.querySelectorAll(`[data-margin]`)) item.classList.toggle(`current`, Number(item.dataset.margin) === model.page.margin);
    setValue(el.footerText, model.page.footer);
    el.zoom.value = String(zoomIndex);
  }

  // ------------------------------------------------------------------ Menus of the tool bar

  // The button that owns the open menu of the tool bar, if any.
  let menuOwner = null;

  // Closes the open menu, and gives the focus back to its button when asked.
  function closeMenu(giveFocus) {
    if (!menuOwner) return;
    const owner = menuOwner;
    menuOwner = null;
    owner.setAttribute(`aria-expanded`, `false`);
    el.menu.hidden = true;
    if (giveFocus) owner.focus();
  }

  // Opens the menu `name` (types, format, margin or footer) under its button; a second click closes it.
  function openMenu(name, button) {
    if (menuOwner === button) {
      closeMenu(true);
      return;
    }
    closeMenu(false);
    for (const part of el.menu.querySelectorAll(`[data-menu]`)) part.hidden = part.dataset.menu !== name;
    menuOwner = button;
    button.setAttribute(`aria-expanded`, `true`);
    el.menu.hidden = false;
    const base = el.panel.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    const left = Math.max(0, Math.min(box.left - base.left, base.width - el.menu.offsetWidth));
    el.menu.style.left = `${left}px`;
    el.menu.style.top = `${box.bottom - base.top + 4}px`;
    const first = el.menu.querySelector(`[data-menu="${name}"] button, [data-menu="${name}"] input`);
    if (first) first.focus();
  }

  // Builds the lines of the menus that list choices: the types of blocks, the formats and the margins.
  function buildMenus() {
    const make = (parent, items, attribute, icon) => {
      parent.textContent = ``;
      for (const [value, label, iconName] of items) {
        const item = document.createElement(`button`);
        item.type = `button`;
        item.className = `menuItem`;
        item.dataset[attribute] = String(value);
        if (iconName) item.appendChild(Icons.make(iconName));
        const text = document.createElement(`span`);
        text.textContent = label;
        item.appendChild(text);
        parent.appendChild(item);
      }
    };
    make(el.menu.querySelector(`[data-menu="types"]`), Model.TYPES.map((type) => [type, tr(TYPE_KEYS[type]), type]), `type`);
    make(el.menu.querySelector(`[data-menu="format"]`), Object.keys(FORMAT_KEYS).map((key) => [key, tr(FORMAT_KEYS[key])]), `format`);
    make(el.menu.querySelector(`[data-menu="margin"]`), Layout.MARGINS.map((mm) => [mm, tr(`boardMarginValue`, { mm })]), `margin`);
  }

  // ------------------------------------------------------------------ Diagnostic

  // Runs the diagnostic (reads the document again, tests the attachments) and copies its report to the clipboard.
  // When the browser refuses the clipboard, the report is shown in a box where it can be copied by hand.
  async function runDebug() {
    el.saveState.textContent = tr(`debugRunning`);
    el.saveState.className = `hint`;
    const summary = {
      format: model.page.format, orientation: model.page.orientation, margin: model.page.margin, pages: model.pages,
      numbers: model.page.numbers, footer: model.page.footer, blocks: model.blocks.map((block) => ({ type: block.type, page: block.page })),
      values: model.values.length, bytes: JSON.stringify(model).length, editing, locked
    };
    let text;
    try {
      text = await window.exportTdbDebug.diagnose(summary);
    } catch (error) {
      text = `The diagnostic failed: ${String(error && error.message ? error.message : error)}`;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      el.debugText.value = text;
      el.debugBox.hidden = false;
      el.debugText.focus();
      el.debugText.select();
      try {
        copied = document.execCommand(`copy`);
      } catch {
        copied = false;
      }
    }
    if (copied) el.debugBox.hidden = true;
    el.saveState.textContent = tr(copied ? `debugCopied` : `debugFailed`);
    el.saveState.className = copied ? `hint` : `warning`;
  }

  // ------------------------------------------------------------------ Printing

  // Shows a message about the printing in the notice line of the tab.
  function printNotice(text) {
    el.notice.textContent = text;
    el.notice.hidden = false;
  }

  // Prepares the document of the print window, a page of the site (print.html) that the widget fills: the size of the
  // sheet (a small static style sheet per format), a bar with the buttons (hidden when printing) and the sheet that will
  // hold the pages. Returns { sheet, message }.
  function preparePrintWindow(popup) {
    const doc = popup.document;
    doc.title = tr(`printTitle`);
    const sizeSheet = doc.createElement(`link`);
    sizeSheet.rel = `stylesheet`;
    sizeSheet.href = new URL(`print/${model.page.format}-${model.page.orientation}.css`, location.href).href;
    doc.head.appendChild(sizeSheet);
    doc.body.textContent = ``;
    const bar = doc.createElement(`div`);
    bar.className = `printBar`;
    const message = doc.createElement(`p`);
    message.className = `printMessage`;
    message.textContent = tr(`printPreparing`);
    const print = doc.createElement(`button`);
    print.type = `button`;
    print.textContent = tr(`printButton`);
    print.addEventListener(`click`, () => popup.print());
    const close = doc.createElement(`button`);
    close.type = `button`;
    close.textContent = tr(`printClose`);
    close.addEventListener(`click`, () => popup.close());
    bar.append(message, print, close);
    const sheet = doc.createElement(`div`);
    sheet.className = `printSheet`;
    doc.body.append(bar, sheet);
    return { sheet, message };
  }

  // Opens the print window on the page print.html and waits until it is loaded. Must be called from a click.
  // Resolves to the window, or to null when the browser blocks it or the page does not load.
  async function openPrintWindow() {
    const popup = window.open(``, `export_tdb_print`, `popup=yes,width=1100,height=820,resizable=yes,scrollbars=yes`);
    if (!popup) return { popup: null, blocked: true };
    try {
      popup.location.href = new URL(`print.html`, location.href).href;
      const deadline = Date.now() + 10000;
      const loaded = () => {
        try {
          return popup.location.pathname.endsWith(`/print.html`) && popup.document.readyState === `complete` && popup.document.body && popup.document.body.dataset.ready === `1`;
        } catch {
          return false;
        }
      };
      while (!popup.closed && !loaded() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
      if (loaded()) return { popup, blocked: false };
    } catch {
      // The window cannot be used: it is closed below.
    }
    popup.close();
    return { popup: null, blocked: false };
  }

  // Waits until every picture of the print window is loaded (or failed), then opens the print dialog of the browser.
  async function finishPrint(popup, sheet, message, count) {
    const deadline = Date.now() + 15000;
    const ready = () => [...sheet.querySelectorAll(`img`)].every((img) => img.getAttribute(`src`) && img.complete);
    while (!popup.closed && !ready() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    if (popup.closed) return;
    message.textContent = tr(`printReady`, { count });
    popup.focus();
    try {
      popup.print();
    } catch {
      // The browser refuses: the message above tells the keys to use.
    }
  }

  // Draws every page at its real size in a window of its own and opens the print dialog of the browser, where the
  // PDF is saved. The pages are drawn by the same code as the screen, then moved into the window.
  async function printDashboard() {
    const opened = await openPrintWindow();
    const popup = opened.popup;
    if (!popup) {
      printNotice(tr(opened.blocked ? `boardPrintBlocked` : `boardPrintFailed`));
      return;
    }
    let target;
    try {
      target = preparePrintWindow(popup);
    } catch {
      popup.close();
      printNotice(tr(`boardPrintFailed`));
      return;
    }
    const saved = { editing, selectedId };
    printing = true;
    editing = false;
    selectedId = null;
    let count = 0;
    try {
      render();
      const pages = [...el.canvas.querySelectorAll(`.page:not(.newPage)`)];
      const size = Layout.pageSizeMm(model.page.format, model.page.orientation);
      // The charts now belong to the print window: they must not be disposed by the next drawing.
      chartInstances = [];
      for (const page of pages) {
        page.dataset.size = `${model.page.format}-${model.page.orientation}`;
        page.style.width = `${size.w}mm`;
        page.style.height = `${size.h}mm`;
        target.sheet.appendChild(popup.document.adoptNode(page));
      }
      count = pages.length;
    } finally {
      printing = false;
      editing = saved.editing;
      selectedId = saved.selectedId;
      render();
    }
    finishPrint(popup, target.sheet, target.message, count);
  }

  // ------------------------------------------------------------------ Settings panel

  // Sets the value of a field of the panel, unless the user is typing in it.
  function setValue(input, value) {
    if (input.value !== value && document.activeElement !== input) input.value = value;
  }

  // The schema for which the lists of columns of the panel were built.
  let listsNames = ``;
  let listsFor = null;

  // Builds the lists that depend on the document: the text columns and the fields that can be inserted.
  function fillDynamicLists() {
    const state = context();
    const names = model.values.map((item) => item.name).filter(Boolean).join(`|`);
    if (listsFor === state.schema && listsNames === names) return;
    listsFor = state.schema;
    listsNames = names;
    const columns = writableColumns().map((column) => [column.id, column.id]);
    fillSelect(el.column, [[``, tr(`boardColumnNone`)], ...columns], ``);
    const fields = state.schema && state.linked ? Fields.fieldChoices(state.schema, state.linked).map((choice) => [choice.path, choice.label]) : [];
    const valueItems = model.values.filter((item) => item.name).map((item) => [item.name, tr(`valueFieldLabel`, { name: item.name })]);
    fillSelect(el.field, [[``, tr(`boardFieldPlaceholder`)], ...fields, ...valueItems], ``);
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
    if (block && (block.type === `text` || block.type === `table` || block.type === `chart` || block.type === `record` || block.type === `indicator` || block.type === `image`)) commit(Model.updateBlock(model, block.id, { config: changes }));
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
    const group = config.mode !== `list`;
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
      row.hidden = config.mode === `cross` && index > 0;
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
    el.groupRow.hidden = config.mode === `list`;
    setOptions(el.group1, columnItems, config.groupBy[0] || ``);
    el.crossBox.hidden = !config.groupBy[0];
    el.crossMore.hidden = config.mode !== `cross`;
    el.addColumn.hidden = config.mode === `cross` && config.columns.length > 0;
    const scatter = block.type === `chart` && config.chart === `scatter`;
    el.tableBox.classList.toggle(`forScatter`, scatter);
    $(`boardColumnsLabel`).textContent = tr(scatter ? `boardScatterColumns` : config.mode === `cross` ? `boardCellCalc` : `boardColumns`);
    setOptions(el.colItem, [[``, tr(`boardColItemNone`)], ...choices.map((choice) => [choice.path, choice.label])], config.colItem);
    const colColumn = config.colItem ? schema.tables.get(config.table).columns.find((column) => column.id === config.colItem.split(`.`)[0]) : null;
    setOptions(el.colSort, [[`key`, tr(`colSortKey`)], ...(colColumn && colColumn.kind === `ref` ? [[`ref`, tr(`colSortRef`)]] : [])], config.colSort);
    setOptions(el.slice, Model.SLICES.map((count) => [count, count ? tr(`sliceN`, { n: count }) : tr(`sliceAll`)]), config.slice);
    el.merge.checked = config.merge;
    const result = tableResult(block);
    const firstItem = config.groupBy.find(Boolean);
    const itemColumn = firstItem ? schema.tables.get(config.table).columns.find((column) => column.id === firstItem.split(`.`)[0]) : null;
    const byRef = Boolean(itemColumn) && itemColumn.kind === `ref`;
    const sortItems = config.mode === `list`
      ? [[`none`, tr(`sortNone`)], [`column`, tr(`sortByColumn`)]]
      : [[`key`, tr(`sortByKey`)], ...(config.mode === `cross` ? [] : [[`value`, tr(`sortByValue`)]]), ...(byRef ? [[`ref`, tr(`sortByRef`)]] : []), [`manual`, tr(`sortByManual`)]];
    const sortBy = sortItems.some(([value]) => value === config.sort.by) ? config.sort.by : sortItems[0][0];
    setOptions(el.sortBy, sortItems, sortBy);
    el.sortColumn.hidden = !(config.mode === `list` && sortBy === `column`);
    setOptions(el.sortColumn, [[``, tr(`sortChoose`)], ...choices.map((choice) => [choice.path, choice.label])], config.sort.column);
    setOptions(el.sortDir, [[`asc`, tr(`sortAsc`)], [`desc`, tr(`sortDesc`)]], config.sort.dir);
    el.sortDir.parentElement.hidden = sortBy === `manual`;
    el.sortOrderBox.hidden = !(config.mode !== `list` && sortBy === `manual`);
    if (!el.sortOrderBox.hidden) renderSortOrder(config, result.ok && config.mode !== `list` ? result.rows.map((row) => row[0]) : []);
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
    el.valuesBox.hidden = !valuesOpen;
    el.heading.textContent = valuesOpen ? tr(`boardValuesTitle`) : tr(`boardPanelTitle`);
    el.remove.hidden = valuesOpen;
    if (valuesOpen) {
      el.titleRow.hidden = true;
      el.tableBox.hidden = true;
      el.chartBox.hidden = true;
      el.textBox.hidden = true;
      el.recordBox.hidden = true;
      el.imageBox.hidden = true;
      el.indicatorBox.hidden = true;
      el.valuesAdd.disabled = model.values.length >= Model.MAX_VALUES;
      valuesPanel.render();
      return;
    }
    const block = selectedBlock();
    if (!block) return;
    setValue(el.title, block.title);
    el.titleRow.hidden = block.type === `text`;
    const dataBlock = block.type === `table` || block.type === `chart`;
    el.tableBox.hidden = !dataBlock;
    el.tableBox.classList.toggle(`forChart`, block.type === `chart`);
    $(`boardTableHeading`).textContent = tr(block.type === `chart` ? `boardChartDataTitle` : `boardTableTitle`);
    if (dataBlock) fillTableSettings(block);
    el.chartBox.hidden = block.type !== `chart`;
    if (block.type === `chart`) fillChartSettings(block);
    el.textBox.hidden = block.type !== `text`;
    if (block.type === `text`) fillTextSettings(block);
    el.imageBox.hidden = block.type !== `image`;
    if (block.type === `image`) fillImageSettings(block);
    el.recordBox.hidden = block.type !== `record`;
    if (block.type === `record`) fillRecordSettings(block);
    el.indicatorBox.hidden = block.type !== `indicator`;
    if (block.type === `indicator`) indicatorPanel.render();
  }

  // Selects a block (or none) and opens or closes its settings.
  function select(id, openPanel) {
    if (id) valuesOpen = false;
    if (id !== selectedId) {
      sectionOpen.filters = false;
      sectionOpen.sort = false;
      explainOpen = false;
    }
    selectedId = id;
    panelOpen = Boolean(id) && openPanel;
    if (!panelOpen) explainOpen = false;
    for (const node of el.canvas.querySelectorAll(`.block`)) node.classList.toggle(`selected`, (node.dataset.parent || node.dataset.id) === id);
    if (panelOpen || valuesOpen) fillPanel();
    const before = el.scroll.clientWidth;
    syncTools();
    if (el.scroll.clientWidth !== before) render();
  }

  // ------------------------------------------------------------------ Deleting

  // Deletes a block at once (no question: Ctrl+Z brings it back).
  function deleteBlock(id) {
    if (!Model.findBlock(model, id)) return;
    selectedId = null;
    panelOpen = false;
    commit(Model.deleteBlock(model, id));
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
    if (event.target.closest(`.cross`)) return;
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

  // The cross of a block deletes it.
  el.canvas.addEventListener(`click`, (event) => {
    if (!editing || !event.target.closest(`.cross`)) return;
    const node = event.target.closest(`.block`);
    deleteBlock(node.dataset.id);
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
      deleteBlock(block.id);
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
    }
    render();
  }

  // Adds a block of the given type, selects it and opens its settings.
  function addBlock(type) {
    const result = Model.addBlock(model, type);
    if (!result.id) {
      el.notice.textContent = tr(`boardLimit`);
      el.notice.hidden = false;
      return;
    }
    el.notice.hidden = true;
    valuesOpen = false;
    selectedId = result.id;
    panelOpen = true;
    commit(result.model, { focus: true });
    const node = el.canvas.querySelector(`.block[data-id="${result.id}"]`);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: `nearest` });
  }

  // Sets the zoom to a level of the slider (the page width is the level of 100 %).
  function zoomTo(index) {
    zoomIndex = Math.min(ZOOMS.length - 1, Math.max(0, index));
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
    buildMenus();
    fillSelect(el.source, Model.TEXT_SOURCES.map((key) => [key, tr(key === `fixed` ? `boardSourceFixed` : `boardSourceCell`)]), `fixed`);
    fillSelect(el.size, Model.TEXT_SIZES.map((key) => [key, tr(SIZE_KEYS[key])]), `normal`);
    fillSelect(el.align, Model.TEXT_ALIGNS.map((key) => [key, tr(ALIGN_KEYS[key])]), `left`);
    fillSelect(el.fill, Model.FILLS.map((key) => [key, tr(FILL_KEYS[key])]), `none`);
  }

  el.edit.addEventListener(`click`, () => setEditing(!editing));
  el.addMenu.addEventListener(`click`, () => openMenu(`types`, el.addMenu));
  el.formatButton.addEventListener(`click`, () => openMenu(`format`, el.formatButton));
  el.marginButton.addEventListener(`click`, () => openMenu(`margin`, el.marginButton));
  el.footerButton.addEventListener(`click`, () => openMenu(`footer`, el.footerButton));
  el.orientation.addEventListener(`click`, () => commit(Model.setPage(model, { orientation: model.page.orientation === `landscape` ? `portrait` : `landscape` })));
  el.menu.addEventListener(`click`, (event) => {
    const item = event.target.closest(`.menuItem`);
    if (!item) return;
    closeMenu(true);
    if (item.dataset.type) addBlock(item.dataset.type);
    else if (item.dataset.format) commit(Model.setPage(model, { format: item.dataset.format }));
    else if (item.dataset.margin) commit(Model.setPage(model, { margin: Number(item.dataset.margin) }));
  });
  document.addEventListener(`click`, (event) => {
    if (menuOwner && !el.menu.contains(event.target) && !menuOwner.contains(event.target)) closeMenu(false);
  });
  document.addEventListener(`keydown`, (event) => {
    if (event.key === `Escape` && menuOwner) closeMenu(true);
    // Ctrl+Z undoes the last change of the dashboard, Ctrl+Y or Ctrl+Shift+Z does it again (in a field the browser
    // keeps its own undo of the text).
    if (!editing || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== `z` && key !== `y`) return;
    const target = event.target;
    if (target && target.matches && target.matches(`input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable]`)) return;
    event.preventDefault();
    undo(key === `y` || event.shiftKey ? 1 : -1);
  });
  el.footerText.addEventListener(`keydown`, (event) => {
    if (event.key === `Enter`) closeMenu(true);
  });
  el.print.addEventListener(`click`, printDashboard);
  el.numbers.addEventListener(`click`, () => commit(Model.setPage(model, { numbers: !model.page.numbers })));
  el.footerText.addEventListener(`input`, () => commit(Model.setPage(model, { footer: el.footerText.value })));
  el.zoom.addEventListener(`input`, () => zoomTo(Number(el.zoom.value)));
  el.zoom.addEventListener(`dblclick`, () => zoomTo(ZOOMS.indexOf(1)));
  el.debug.addEventListener(`click`, runDebug);
  el.debugClose.addEventListener(`click`, () => {
    el.debugBox.hidden = true;
  });
  el.title.addEventListener(`input`, () => {
    if (selectedId) commit(Model.updateBlock(model, selectedId, { title: el.title.value }));
  });
  el.remove.addEventListener(`click`, () => deleteBlock(selectedId));
  el.close.addEventListener(`click`, () => {
    valuesOpen = false;
    select(selectedId, false);
  });
  el.valuesButton.addEventListener(`click`, () => {
    valuesOpen = !valuesOpen;
    if (valuesOpen) {
      selectedId = null;
      panelOpen = false;
      for (const node of el.canvas.querySelectorAll(`.block.selected`)) node.classList.remove(`selected`);
    }
    render();
  });
  el.valuesAdd.addEventListener(`click`, () => {
    if (model.values.length < Model.MAX_VALUES) commit(Model.setValues(model, [...model.values, { name: ``, kind: model.values.length ? model.values[model.values.length - 1].kind : `calc` }]));
  });


  // The settings of the table block that depend on the table are cleared when the table changes.
  const tableReset = (fixed) => ({ start: ``, link: fixed ? `all` : ``, columns: [], groupBy: [], colItem: ``, filters: [], sort: { by: `none`, column: ``, dir: `asc`, order: [] } });
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
    changeConfig({ groupBy: [el.group1.value], colItem: group ? block.config.colItem : ``, sort: { ...block.config.sort, by: group ? `key` : `none` }, columns: fitColumns(block, group) });
  });
  el.colItem.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (!block) return;
    const columns = el.colItem.value && !block.config.columns.length ? [{ path: ``, fn: `sum`, label: `` }] : block.config.columns;
    changeConfig({ colItem: el.colItem.value, columns });
  });
  el.slice.addEventListener(`change`, () => changeConfig({ slice: Number(el.slice.value) }));
  el.colSort.addEventListener(`change`, () => changeConfig({ colSort: el.colSort.value }));
  el.chartType.addEventListener(`change`, () => {
    const block = selectedBlock();
    // A scatter plot is made from a plain list: the item and the item in columns are taken away.
    if (block && el.chartType.value === `scatter` && block.config.mode !== `list`) {
      changeConfig({ chart: `scatter`, groupBy: [``], colItem: ``, sort: { ...block.config.sort, by: `none` }, columns: fitColumns({ ...block, config: { ...block.config, groupBy: [``], colItem: `` } }, false) });
      return;
    }
    changeConfig({ chart: el.chartType.value });
  });
  el.chartPalette.addEventListener(`change`, () => changeConfig({ palette: el.chartPalette.value }));
  el.chartLegend.addEventListener(`change`, () => changeConfig({ legend: el.chartLegend.value }));
  el.chartLabels.addEventListener(`change`, () => changeConfig({ labels: el.chartLabels.value }));
  el.recordAdd.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (block && block.config.items.length < Model.MAX_RECORD_ITEMS) changeConfig({ items: [...block.config.items, { path: ``, label: `` }] });
  });
  el.recordColumns.addEventListener(`change`, () => changeConfig({ columns: Number(el.recordColumns.value) }));
  el.imageColumn.addEventListener(`change`, () => changeConfig({ path: el.imageColumn.value }));
  el.imageRank.addEventListener(`input`, () => {
    const rank = Number(el.imageRank.value);
    if (Number.isInteger(rank) && rank >= 1 && rank <= Model.MAX_IMAGE_RANK) changeConfig({ rank });
  });
  el.imageRank.addEventListener(`change`, () => {
    const block = selectedBlock();
    if (block && block.type === `image`) el.imageRank.value = String(block.config.rank);
  });
  el.imageCaption.addEventListener(`change`, () => changeConfig({ caption: el.imageCaption.value }));
  el.recordSize.addEventListener(`change`, () => changeConfig({ size: el.recordSize.value }));
  el.merge.addEventListener(`change`, () => changeConfig({ merge: el.merge.checked }));
  el.addColumn.addEventListener(`click`, () => {
    const block = selectedBlock();
    if (block && block.config.columns.length < Model.MAX_COLUMNS) changeConfig({ columns: [...block.config.columns, { path: ``, fn: block.config.mode !== `list` ? `sum` : ``, label: `` }] });
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

  // The page is drawn again when the window changes size.
  window.addEventListener(`resize`, () => render());

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

  const valuesPanel = ValuesPanel.create({
    list: el.valuesList,
    getValues: () => model.values,
    setValues: (list) => commit(Model.setValues(model, list)),
    context,
    results: namedValues,
    linkLabel: choiceLabel,
    Fields,
    Query
  });

  const indicatorPanel = IndicatorPanel.create({
    box: el.indicatorBody,
    getBlock: selectedBlock,
    change: changeConfig,
    names: () => [...new Set(model.values.map((item) => item.name).filter(Boolean))],
    current: () => {
      const block = selectedBlock();
      const named = block && block.config.value ? namedValues().byName.get(block.config.value) : null;
      const ok = Boolean(named) && !named.error;
      return { text: ok ? named.text : ``, error: !ok, color: Indicator.pickColor(block.config, ok ? named.number : null) };
    },
    sizeItems: Model.TEXT_SIZES.map((name) => [name, tr(SIZE_KEYS[name])]),
    maxRules: Model.MAX_RULES
  });

  fillTools();
  render();
  window.exportTdbBoard = { getModel: () => model };
})();
