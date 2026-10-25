// export_tdb context: reads the structure of the Grist document (schema, linked table, selected row) and keeps
// what the dashboard needs, and builds the diagnostic report that the debug button copies to the clipboard. It
// changes nothing in the document.
(function () {
  const { t, applyTranslations } = window.exportTdbI18n;
  const { buildSchema, findDescendants } = window.exportTdbSchema;
  const { describeColumn, describeValue } = window.exportTdbShape;
  const { buildReport } = window.exportTdbReport;

  const VERSION = `0.11.1`;
  // At most this many descendant tables are loaded to measure them and to look at their values.
  const MAX_TABLES = 12;
  const IMAGE_WAIT_MS = 10000;

  const $ = (id) => document.getElementById(id);
  const el = { status: $(`status`), error: $(`error`) };

  // What the exploration found so far.
  const state = {
    record: null, rowsSeen: new Set(), running: false, linked: ``, schema: null, descendants: [],
    shapes: [], timings: [], tests: new Map(), metadataOk: false
  };

  // The dashboard reads what the exploration found.
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
  }

  // The shape of each value that Grist gave with the selected row, to see what a widget really receives.
  function recordShapes() {
    const table = state.schema && state.schema.tables.get(state.linked);
    if (!table || !state.record) return [];
    return table.columns.map((column) => ({ column: column.id, type: column.type, shape: describeValue(state.record[column.id], false) }));
  }

  // The text of the report from what was found. `dashboard` (optional) describes the dashboard: see buildReport.
  function reportText(dashboard) {
    const schema = state.schema;
    return buildReport({
      version: VERSION, reveal: false, linked: state.linked,
      record: state.record ? state.record.id : null, events: state.rowsSeen.size,
      tables: schema ? schema.order.map((id) => schema.tables.get(id)) : [], descendants: state.descendants,
      shapes: state.shapes, timings: state.timings, tests: [...state.tests.values()],
      recordShapes: recordShapes(), dashboard
    });
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
    state.timings.push({ table: table.id, rows, columns: table.columns.length, ms, manualSort: data.manualSort !== undefined });
    for (const column of table.columns) {
      const described = describeColumn(data[column.id], false);
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
      setStatus(t(`done`));
      window.dispatchEvent(new CustomEvent(`exporttdb:explored`));
    } catch (error) {
      const text = String(error && error.message ? error.message : error);
      if (!state.metadataOk) recordTest(`metadata tables read`, false, text);
      showError(`${t(`failed`, { reason: text })} ${t(`needFull`)}`);
      setStatus(``);
    } finally {
      state.running = false;
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

  // The diagnostic report, after a new reading of the document and a test of the attachments (nothing is written in
  // the document). `dashboard` describes the dashboard, see buildReport. Resolves to the text of the report.
  async function diagnose(dashboard) {
    state.tests.delete(`attachment token`);
    await explore();
    await testAttachment();
    return reportText(dashboard);
  }

  window.exportTdbDebug = { diagnose };

  // ------------------------------------------------------------------- Start

  // Called by Grist each time the selected row changes.
  function onRecord(record) {
    if (!record) return;
    state.record = record;
    state.rowsSeen.add(record.id);
    window.dispatchEvent(new CustomEvent(`exporttdb:rowchanged`));
    if (!state.schema && !state.running) explore();
  }

  applyTranslations(document);
  setStatus(t(`pickRow`));
  grist.ready({ requiredAccess: `full` });
  // Raw values (references as row numbers, dates and lists in their encoded form) and every normal
  // column of the table, not only the columns shown in the right panel of the widget.
  grist.onRecord(onRecord, { keepEncoded: true, expandRefs: false, includeColumns: `normal` });
})();
