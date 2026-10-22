// Query lab (version 0.2): lets the maintainer try the calculations of the future widget on the real
// data of the document: rows that belong to the selected row, filters, grouping, sums. It shows the
// result as a table so that the figures can be compared with ones already known. Nothing is
// written in the document. The calculations are done by the pure modules (rowset.js, aggregate.js).
(function () {
  const { t } = window.exportTdbI18n;
  const { createDataset } = window.exportTdbDataset;
  const { findDescendants, describeStep } = window.exportTdbSchema;
  const { rowsInContext, allRows, applyFilters } = window.exportTdbRowset;
  const { groupRows } = window.exportTdbAggregate;
  const { formatNumber } = window.exportTdbFormat;

  // A table loaded for a calculation is kept here until the user reloads the data.
  const cache = new Map();
  // Tables reached through references are loaded at most this many levels away from the table of the query.
  const REF_DEPTH = 2;
  const MAX_LOADED = 16;
  const FUNCTIONS = [[`sum`, `fnSum`], [`avg`, `fnAvg`], [`min`, `fnMin`], [`max`, `fnMax`], [`count`, `fnCount`], [`distinct`, `fnDistinct`]];
  const OPERATORS = [
    [`eq`, `opEq`], [`ne`, `opNe`], [`gt`, `opGt`], [`ge`, `opGe`], [`lt`, `opLt`], [`le`, `opLe`],
    [`contains`, `opContains`], [`empty`, `opEmpty`], [`notEmpty`, `opNotEmpty`], [`true`, `opTrue`], [`false`, `opFalse`]
  ];
  const NO_VALUE = new Set([`empty`, `notEmpty`, `true`, `false`]);

  const $ = (id) => document.getElementById(id);
  const el = {
    tabExplorer: $(`tabExplorer`), tabLab: $(`tabLab`), panelExplorer: $(`panelExplorer`), panelLab: $(`panelLab`),
    message: $(`labMessage`), form: $(`labForm`), table: $(`labTable`), path: $(`labPath`), group: $(`labGroup`),
    group2: $(`labGroup2`), fn: $(`labFn`), column: $(`labColumn`), sort: $(`labSort`), run: $(`labRun`),
    refresh: $(`labRefresh`), info: $(`labInfo`), warnings: $(`labWarnings`), result: $(`labResult`), copy: $(`labCopy`)
  };
  const filters = [{ box: $(`labFilter1`) }, { box: $(`labFilter2`) }];
  let lastText = ``;

  // ------------------------------------------------------------------ Tabs

  // Shows the explorer or the lab.
  function showTab(name) {
    const lab = name === `lab`;
    el.panelExplorer.hidden = lab;
    el.panelLab.hidden = !lab;
    el.tabExplorer.setAttribute(`aria-selected`, String(!lab));
    el.tabLab.setAttribute(`aria-selected`, String(lab));
    if (lab) prepare();
  }

  // ------------------------------------------------------------------ Form

  // Builds a list of options in a select element. `items` are [value, label] pairs.
  function fillSelect(select, items, keep) {
    const previous = select.value;
    select.textContent = ``;
    for (const [value, label] of items) {
      const option = document.createElement(`option`);
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    if (keep && items.some(([value]) => value === previous)) select.value = previous;
  }

  const state = () => window.exportTdbContext.state;

  // Columns of a table that can be chosen: its own columns and, for each reference column, the
  // columns of the table it points to (one level), written as `Reference.Column`.
  function columnChoices(tableId) {
    const schema = state().schema;
    const table = schema.tables.get(tableId);
    const out = [];
    for (const column of table.columns) {
      out.push({ path: column.id, label: `${column.id}`, column, numeric: /^(Numeric|Int)$/.test(column.base) });
      if (column.kind === `ref` && schema.tables.has(column.target)) {
        for (const inner of schema.tables.get(column.target).columns) {
          if (inner.kind === `reflist` || inner.kind === `attachments`) continue;
          out.push({ path: `${column.id}.${inner.id}`, label: `${column.id} > ${inner.id}`, column: inner, numeric: /^(Numeric|Int)$/.test(inner.base) });
        }
      }
    }
    return out;
  }

  // The linked table and the tables that descend from it, with their chains.
  function tableChoices() {
    const s = state();
    return [[s.linked, s.linked], ...s.descendants.map((entry) => [entry.table, entry.table])];
  }

  // Fills the lists that depend on the chosen table.
  function fillForTable() {
    const s = state();
    const tableId = el.table.value;
    const entry = s.descendants.find((d) => d.table === tableId);
    const paths = entry ? entry.paths.map((path, index) => [String(index), path.map(describeStep).join(` ; `)]) : [];
    fillSelect(el.path, [[`all`, t(`labAllRows`)], ...paths], false);
    if (entry) el.path.value = `0`;
    if (tableId === s.linked) el.path.value = `all`;
    const choices = columnChoices(tableId);
    fillSelect(el.group, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])], false);
    fillSelect(el.group2, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])], false);
    fillSelect(el.column, [[``, t(`labNone`)], ...choices.filter((c) => c.numeric).map((c) => [c.path, c.label]), ...choices.filter((c) => !c.numeric).map((c) => [c.path, c.label])], false);
    for (const filter of filters) fillFilter(filter, choices);
  }

  // Builds the controls of one filter: column, operator, source and value.
  function fillFilter(filter, choices) {
    const box = filter.box;
    box.textContent = ``;
    const legend = document.createElement(`legend`);
    legend.textContent = t(`labFilter`);
    box.appendChild(legend);
    const make = (tag) => box.appendChild(document.createElement(tag));
    filter.column = make(`select`);
    fillSelect(filter.column, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])], false);
    filter.op = make(`select`);
    fillSelect(filter.op, OPERATORS.map(([value, key]) => [value, t(key)]), false);
    filter.source = make(`select`);
    fillSelect(filter.source, [[`const`, t(`sourceConst`)], [`field`, t(`sourceField`)], [`id`, t(`sourceId`)]], false);
    filter.value = make(`input`);
    filter.value.type = `text`;
    filter.value.setAttribute(`aria-label`, t(`labValue`));
    filter.field = make(`select`);
    const linkedChoices = columnChoices(state().linked);
    fillSelect(filter.field, linkedChoices.map((c) => [c.path, c.label]), false);
    filter.field.setAttribute(`aria-label`, t(`labField`));
    const sync = () => {
      const needsValue = !NO_VALUE.has(filter.op.value);
      filter.source.hidden = !needsValue;
      filter.value.hidden = !needsValue || filter.source.value !== `const`;
      filter.field.hidden = !needsValue || filter.source.value !== `field`;
    };
    filter.op.addEventListener(`change`, sync);
    filter.source.addEventListener(`change`, sync);
    sync();
  }

  // Reads one filter of the form, or null when no column is chosen.
  function readFilter(filter) {
    if (!filter.column || !filter.column.value) return null;
    const op = filter.op.value;
    if (NO_VALUE.has(op)) return { path: filter.column.value, op };
    let value;
    if (filter.source.value === `id`) value = { kind: `id` };
    else if (filter.source.value === `field`) value = { kind: `field`, path: filter.field.value };
    else {
      const text = filter.value.value.trim();
      value = { kind: `const`, value: text !== `` && Number.isFinite(Number(text.replace(`,`, `.`))) ? Number(text.replace(`,`, `.`)) : text };
    }
    return { path: filter.column.value, op, value };
  }

  // Makes the form ready once the exploration has run.
  function prepare() {
    const context = window.exportTdbContext;
    if (!context || !context.explored()) {
      el.message.textContent = t(`labNeedExplore`);
      el.form.hidden = true;
      return;
    }
    el.message.textContent = ``;
    el.form.hidden = false;
    const previous = el.table.value;
    fillSelect(el.table, tableChoices(), false);
    if (tableChoices().some(([value]) => value === previous)) el.table.value = previous;
    fillSelect(el.fn, FUNCTIONS.map(([value, key]) => [value, t(key)]), true);
    fillSelect(el.sort, [[`key`, t(`labSortKey`)], [`value`, t(`labSortValue`)]], true);
    fillForTable();
  }

  // ------------------------------------------------------------------ Data

  // Names of the tables a calculation needs: the table, the linked table, the tables of the chain and
  // the tables that references lead to, a few levels away.
  function neededTables(tableId, chain) {
    const s = state();
    const names = new Set([tableId, s.linked]);
    for (const step of chain || []) {
      names.add(step.from);
      names.add(step.to);
    }
    let frontier = [tableId, s.linked];
    for (let level = 0; level < REF_DEPTH; level += 1) {
      const next = [];
      for (const id of frontier) {
        const table = s.schema.tables.get(id);
        if (!table) continue;
        for (const column of table.columns) {
          if (column.kind === `ref` && s.schema.tables.has(column.target) && !names.has(column.target)) {
            names.add(column.target);
            next.push(column.target);
          }
        }
      }
      frontier = next;
    }
    return [...names].slice(0, MAX_LOADED);
  }

  // Loads the tables that are not in the cache yet. Returns the time spent and the number loaded.
  async function ensureLoaded(names) {
    const started = performance.now();
    let loaded = 0;
    for (const name of names) {
      if (cache.has(name)) continue;
      el.info.textContent = t(`labLoading`, { table: name });
      cache.set(name, await grist.docApi.fetchTable(name));
      loaded += 1;
    }
    return { ms: performance.now() - started, loaded };
  }

  // ----------------------------------------------------------------- Result

  // Writes the result as a table and keeps a copy as text.
  function renderResult(spec, result, labels) {
    el.result.textContent = ``;
    const lines = [];
    const head = document.createElement(`tr`);
    const names = [...labels.keys, labels.measure];
    names.forEach((name, index) => {
      const cell = document.createElement(`th`);
      cell.textContent = name;
      if (index === names.length - 1) cell.className = `num`;
      head.appendChild(cell);
    });
    el.result.appendChild(head);
    lines.push(names.join(`\t`));
    const add = (keys, value, total) => {
      const row = document.createElement(`tr`);
      if (total) row.className = `total`;
      keys.forEach((text) => {
        const cell = document.createElement(`td`);
        cell.textContent = text;
        row.appendChild(cell);
      });
      const cell = document.createElement(`td`);
      cell.className = `num`;
      cell.textContent = formatNumber(value);
      row.appendChild(cell);
      el.result.appendChild(row);
      lines.push([...keys, formatNumber(value)].join(`\t`));
    };
    for (const row of result.rows) add(row.keys, row.values[0], false);
    add([t(`labTotal`), ...spec.groupBy.slice(1).map(() => ``)], result.totals[0], true);
    lastText = lines.join(`\n`);
    el.copy.hidden = false;
  }

  // Runs the calculation described by the form.
  async function run() {
    const s = state();
    el.warnings.hidden = true;
    el.warnings.textContent = ``;
    try {
      const tableId = el.table.value;
      const entry = s.descendants.find((d) => d.table === tableId);
      const chain = el.path.value !== `all` && entry ? entry.paths[Number(el.path.value)] : null;
      const loadedInfo = await ensureLoaded(neededTables(tableId, chain));
      const dataset = createDataset(s.schema, cache);
      const started = performance.now();
      const total = dataset.table(tableId).count;
      let rows = chain ? rowsInContext(dataset, chain, s.record.id) : allRows(dataset, tableId);
      const context = { dataset, linked: s.linked, selectedId: s.record.id };
      const wanted = filters.map(readFilter).filter(Boolean);
      const filtered = applyFilters(rows, tableId, wanted, context);
      rows = filtered.rows;
      const problems = filtered.errors.map((reason) => t(`labFilterIgnored`, { reason }));
      const groupBy = [el.group.value, el.group2.value].filter(Boolean).map((path) => ({ path }));
      const measure = { fn: el.fn.value, path: el.column.value || undefined };
      const spec = { groupBy, measures: [measure], sort: { by: el.sort.value, dir: el.sort.value === `value` ? `desc` : `asc` }, emptyLabel: `(vide)` };
      const result = groupRows(dataset, tableId, rows, spec);
      if (result.error) throw new Error(result.error);
      const fnLabel = t(FUNCTIONS.find(([value]) => value === measure.fn)[1]);
      renderResult(spec, result, { keys: groupBy.map((g) => g.path), measure: `${fnLabel}${measure.path ? ` (${measure.path})` : ``}` });
      el.info.textContent = `${t(`labResultRows`, { kept: rows.length, total })} ${t(`labLoaded`, { ms: Math.round(loadedInfo.ms), count: loadedInfo.loaded })} ${t(`labComputed`, { ms: Math.round(performance.now() - started) })}`;
      if (problems.length) {
        el.warnings.textContent = problems.join(` `);
        el.warnings.hidden = false;
      }
    } catch (error) {
      el.result.textContent = ``;
      el.copy.hidden = true;
      el.info.textContent = t(`labError`, { reason: String(error && error.message ? error.message : error) });
    }
  }

  // ------------------------------------------------------------------ Start

  el.tabExplorer.addEventListener(`click`, () => showTab(`explorer`));
  el.tabLab.addEventListener(`click`, () => showTab(`lab`));
  el.table.addEventListener(`change`, fillForTable);
  el.run.addEventListener(`click`, run);
  el.refresh.addEventListener(`click`, () => {
    cache.clear();
    el.info.textContent = ``;
  });
  el.copy.addEventListener(`click`, async () => {
    try {
      await navigator.clipboard.writeText(lastText);
    } catch {
      el.info.textContent = t(`copyFailed`);
    }
  });
  window.addEventListener(`exporttdb:explored`, () => {
    if (!el.panelLab.hidden) prepare();
  });
})();
