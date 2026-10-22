// export_tdb explorer (version 0.1): reads the structure of the Grist document, the shape of the
// values and the answers of a few API functions, and shows them as a report that the user copies
// and sends to the developer. It proves what the dashboard widget can rely on before that widget
// is written. It changes nothing in the document, except the write test that the user confirms
// and that puts the original value back.
(function () {
  const { t, applyTranslations } = window.exportTdbI18n;
  const { buildSchema, findDescendants, describeStep } = window.exportTdbSchema;
  const { describeColumn } = window.exportTdbShape;
  const { buildReport } = window.exportTdbReport;

  const VERSION = `0.1.0`;
  // At most this many descendant tables are loaded to measure them and to look at their values.
  const MAX_TABLES = 12;
  const TEST_MARKER = `__export_tdb_test__`;
  const IMAGE_WAIT_MS = 10000;

  const $ = (id) => document.getElementById(id);
  const el = {
    status: $(`status`), error: $(`error`), summary: $(`summary`), linked: $(`linked`), seen: $(`seen`),
    reveal: $(`reveal`), rerun: $(`rerun`), tests: $(`tests`), attachmentTest: $(`attachmentTest`),
    writeColumn: $(`writeColumn`), writePrepare: $(`writePrepare`), confirmBox: $(`writeConfirmBox`),
    writeConfirm: $(`writeConfirm`), writeCancel: $(`writeCancel`), writeProblem: $(`writeProblem`),
    testResults: $(`testResults`), structure: $(`structure`), descendants: $(`descendants`), tableList: $(`tableList`),
    reportBox: $(`reportBox`), copy: $(`copy`), copyState: $(`copyState`), report: $(`report`)
  };

  // What the exploration found so far.
  const state = {
    record: null, rowsSeen: new Set(), running: false, linked: ``, schema: null, descendants: [],
    shapes: [], timings: [], tests: new Map(), metadataOk: false
  };

  // The lab tab reads what the exploration found.
  window.exportTdbContext = { state, explored: () => Boolean(state.schema && state.linked) };

  // ---------------------------------------------------------------- Display

  function setStatus(text) {
    el.status.textContent = text || ``;
  }

  // Shows an error in a red banner, or hides it when the text is empty.
  function showError(text) {
    el.error.textContent = text || ``;
    el.error.hidden = !text;
  }

  // Records the result of a test of the API (a second run of the same test replaces the first).
  function recordTest(name, ok, detail) {
    state.tests.set(name, { name, ok, detail: detail || `` });
    renderTests();
    renderReport();
  }

  // Shows the answers of the tests of the API, one line each.
  function renderTests() {
    el.testResults.textContent = ``;
    for (const test of state.tests.values()) {
      const item = document.createElement(`li`);
      item.className = test.ok ? `ok` : `bad`;
      item.textContent = `${test.name}: ${test.ok ? t(`testOk`) : t(`testFailed`)}${test.detail ? ` - ${test.detail}` : ``}`;
      el.testResults.appendChild(item);
    }
  }

  // Lists of tables and of descendant tables with their paths.
  function renderStructure() {
    el.descendants.textContent = ``;
    if (!state.descendants.length) {
      const none = document.createElement(`li`);
      none.textContent = t(`noDescendants`);
      el.descendants.appendChild(none);
    }
    for (const entry of state.descendants) {
      const item = document.createElement(`li`);
      item.textContent = `${entry.table}: ${entry.paths.map((path) => path.map(describeStep).join(` ; `)).join(` | `)}`;
      el.descendants.appendChild(item);
    }
    el.tableList.textContent = ``;
    for (const id of state.schema.order) {
      const table = state.schema.tables.get(id);
      const item = document.createElement(`li`);
      item.textContent = `${id} (${table.columns.length})`;
      el.tableList.appendChild(item);
    }
  }

  // Shows the linked table and the number of rows seen.
  function renderSummary() {
    el.linked.textContent = t(`linked`, { table: state.linked || `?` });
    el.seen.textContent = t(`rowsSeen`, { count: state.rowsSeen.size });
  }

  // Rebuilds the text of the report from what was found.
  function renderReport() {
    const schema = state.schema;
    el.report.value = buildReport({
      version: VERSION, reveal: el.reveal.checked, linked: state.linked,
      record: state.record ? state.record.id : null, events: state.rowsSeen.size,
      tables: schema ? schema.order.map((id) => schema.tables.get(id)) : [], descendants: state.descendants,
      shapes: state.shapes, timings: state.timings, tests: [...state.tests.values()]
    });
    el.reportBox.hidden = false;
  }

  // The columns of the linked table in which a test of writing is allowed: text, not a formula.
  function fillWriteColumns() {
    el.writeColumn.textContent = ``;
    const table = state.schema && state.schema.tables.get(state.linked);
    const columns = table ? table.columns.filter((c) => c.base === `Text` && !c.isFormula) : [];
    for (const column of columns) {
      const option = document.createElement(`option`);
      option.value = column.id;
      option.textContent = `${column.id} (${column.label})`;
      el.writeColumn.appendChild(option);
    }
    el.writePrepare.disabled = !columns.length;
    if (!columns.length) {
      el.writeProblem.textContent = t(`writeNoColumn`);
      el.writeProblem.hidden = false;
    }
  }

  // ------------------------------------------------------------ Exploration

  // Name of the table of the widget (the table the widget is attached to in Grist).
  async function readLinkedTable() {
    const selected = grist.selectedTable;
    if (!selected || typeof selected.getTableId !== `function`) throw new Error(`grist.selectedTable is not available`);
    return String(await selected.getTableId());
  }

  // Loads one table, measures the time and describes the shape of each column.
  async function loadAndDescribe(table) {
    const started = performance.now();
    const data = await grist.docApi.fetchTable(table.id);
    const ms = performance.now() - started;
    const rows = (data.id || []).length;
    state.timings.push({ table: table.id, rows, columns: table.columns.length, ms });
    for (const column of table.columns) {
      const described = describeColumn(data[column.id], el.reveal.checked);
      state.shapes.push({ table: table.id, column: column.id, type: column.type, shape: described.shape, filled: described.filled, empty: described.empty });
    }
  }

  // The whole exploration: metadata, schema, descendants, values of the linked table and of its
  // descendants, with the times of loading.
  async function explore() {
    if (state.running) return;
    state.running = true;
    showError(``);
    state.shapes = [];
    state.timings = [];
    try {
      state.linked = await readLinkedTable();
      recordTest(`selected table detected`, true, ``);
      setStatus(t(`running`, { table: state.linked }));
      const [tables, columns] = await Promise.all([grist.docApi.fetchTable(`_grist_Tables`), grist.docApi.fetchTable(`_grist_Tables_column`)]);
      state.schema = buildSchema(tables, columns);
      state.metadataOk = true;
      recordTest(`metadata tables read`, true, `${state.schema.order.length} tables`);
      state.descendants = findDescendants(state.schema, state.linked);
      const toLoad = [state.linked, ...state.descendants.map((entry) => entry.table)].slice(0, MAX_TABLES + 1);
      for (const id of toLoad) {
        const table = state.schema.tables.get(id);
        if (!table) continue;
        setStatus(t(`running`, { table: id }));
        await loadAndDescribe(table);
      }
      renderStructure();
      fillWriteColumns();
      renderSummary();
      el.summary.hidden = false;
      el.tests.hidden = false;
      el.structure.hidden = false;
      setStatus(t(`done`));
      window.dispatchEvent(new CustomEvent(`exporttdb:explored`));
    } catch (error) {
      const text = String(error && error.message ? error.message : error);
      if (!state.metadataOk) recordTest(`metadata tables read`, false, text);
      showError(`${t(`failed`, { reason: text })} ${t(`needFull`)}`);
      setStatus(``);
    } finally {
      state.running = false;
      renderReport();
    }
  }

  // --------------------------------------------------------------- Tests

  // First attachment id found in the value of an Attachments cell.
  function firstAttachmentId(value) {
    if (!Array.isArray(value)) return 0;
    const id = value.find((item) => Number.isInteger(item) && item > 0);
    return id || 0;
  }

  // Asks Grist for a download token, builds the address of the first attachment of the selected
  // row and checks that a picture element can load it. The token itself is never shown.
  async function testAttachment() {
    const table = state.schema && state.schema.tables.get(state.linked);
    const columns = table ? table.columns.filter((c) => c.kind === `attachments`) : [];
    const found = state.record ? columns.map((c) => ({ column: c.id, id: firstAttachmentId(state.record[c.id]) })).find((x) => x.id) : null;
    if (!found) {
      recordTest(`attachment token`, false, t(`attachmentNone`));
      return;
    }
    try {
      const info = await grist.docApi.getAccessToken({ readOnly: true });
      const address = `${info.baseUrl}/attachments/${found.id}/download?auth=${info.token}`;
      const host = new URL(info.baseUrl).host;
      const result = await new Promise((resolve) => {
        const picture = new Image();
        picture.referrerPolicy = `no-referrer`;
        const timer = setTimeout(() => resolve(`no answer in ${IMAGE_WAIT_MS / 1000} s`), IMAGE_WAIT_MS);
        picture.onload = () => {
          clearTimeout(timer);
          resolve(`loaded ${picture.naturalWidth}x${picture.naturalHeight}`);
        };
        picture.onerror = () => {
          clearTimeout(timer);
          resolve(`picture element could not load it`);
        };
        picture.src = address;
      });
      recordTest(`attachment token`, result.startsWith(`loaded`), `token ttl ${info.ttlMsecs || `?`} ms, host ${host}, ${result}`);
    } catch (error) {
      recordTest(`attachment token`, false, String(error && error.message ? error.message : error));
    }
  }

  // Value of a cell read again from the document.
  async function readCell(tableId, rowId, colId) {
    const data = await grist.docApi.fetchTable(tableId);
    const index = (data.id || []).indexOf(rowId);
    if (index < 0) throw new Error(`row not found`);
    return data[colId][index];
  }

  // Writes `value` in a cell with one method, then reads it back. Returns true when it is there.
  async function writeAndCheck(method, tableId, rowId, colId, value) {
    if (method === `applyUserActions`) {
      await grist.docApi.applyUserActions([[`UpdateRecord`, tableId, rowId, { [colId]: value }]]);
    } else {
      await grist.getTable(tableId).update({ id: rowId, fields: { [colId]: value } });
    }
    return (await readCell(tableId, rowId, colId)) === value;
  }

  // Test of writing with the two methods of the API: marker, check, then the original value back.
  async function runWriteTest() {
    el.confirmBox.hidden = true;
    el.writeProblem.hidden = true;
    const tableId = state.linked;
    const colId = el.writeColumn.value;
    const rowId = state.record ? state.record.id : 0;
    if (!rowId || !colId) return;
    const original = await readCell(tableId, rowId, colId);
    for (const method of [`applyUserActions`, `getTable().update`]) {
      const name = `write with ${method}`;
      const key = method === `applyUserActions` ? method : `getTable`;
      let written = false;
      try {
        written = await writeAndCheck(key, tableId, rowId, colId, TEST_MARKER);
        recordTest(name, written, written ? `marker written and read back` : `marker not found when read back`);
      } catch (error) {
        recordTest(name, false, String(error && error.message ? error.message : error));
      }
      try {
        const restored = await writeAndCheck(key, tableId, rowId, colId, original);
        if (!restored) throw new Error(`value differs after restoring`);
      } catch {
        el.writeProblem.textContent = t(`writeRestoreFailed`, { value: JSON.stringify(original) });
        el.writeProblem.hidden = false;
        recordTest(`restore after ${method}`, false, `see the message on the page`);
        return;
      }
    }
    recordTest(`restore of the original value`, true, ``);
  }

  // ------------------------------------------------------------------- Start

  // Called by Grist each time the selected row changes.
  function onRecord(record) {
    if (!record) return;
    state.record = record;
    state.rowsSeen.add(record.id);
    window.dispatchEvent(new CustomEvent(`exporttdb:rowchanged`));
    if (state.schema || state.running) {
      renderSummary();
      renderReport();
    }
    if (!state.schema && !state.running) explore();
  }

  applyTranslations(document);
  setStatus(t(`pickRow`));
  el.reveal.addEventListener(`change`, () => explore());
  el.rerun.addEventListener(`click`, () => explore());
  el.attachmentTest.addEventListener(`click`, testAttachment);
  el.writePrepare.addEventListener(`click`, () => {
    el.confirmBox.hidden = false;
  });
  el.writeCancel.addEventListener(`click`, () => {
    el.confirmBox.hidden = true;
  });
  el.writeConfirm.addEventListener(`click`, runWriteTest);
  el.copy.addEventListener(`click`, async () => {
    try {
      await navigator.clipboard.writeText(el.report.value);
      el.copyState.textContent = t(`copied`);
    } catch {
      el.report.select();
      el.copyState.textContent = t(`copyFailed`);
    }
  });

  grist.ready({ requiredAccess: `full` });
  // Raw values (references as row numbers, dates and lists in their encoded form) and every normal
  // column of the table, not only the columns shown in the right panel of the widget.
  grist.onRecord(onRecord, { keepEncoded: true, expandRefs: false, includeColumns: `normal` });
})();
