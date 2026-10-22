// Query lab (version 0.2): lets the maintainer try the calculations of the future widget on the real
// data of the document. The user chooses a starting row (the selected row, or a parent of it such
// as the building of a selected room), a table that belongs to that row, and a calculation. The result
// follows the selected row. Nothing is written in the document. The calculations are done by the pure
// modules (rowset.js, aggregate.js).
(function () {
  const { t } = window.exportTdbI18n;
  const { createDataset } = window.exportTdbDataset;
  const { findDescendants, findAncestors, rankDescendants, pathQuality, describeStep } = window.exportTdbSchema;
  const { rowsInContext, contextRowId, allRows, applyFilters } = window.exportTdbRowset;
  const { groupRows } = window.exportTdbAggregate;
  const { formatNumber } = window.exportTdbFormat;

  // A table loaded for a calculation is kept here until the user reloads the data.
  const cache = new Map();
  // Tables reached through references are loaded at most this many levels away from the table of the query.
  const REF_DEPTH = 2;
  const MAX_LOADED = 18;
  const FUNCTIONS = [[`sum`, `fnSum`], [`avg`, `fnAvg`], [`min`, `fnMin`], [`max`, `fnMax`], [`count`, `fnCount`], [`distinct`, `fnDistinct`]];
  const OPERATORS = [
    [`eq`, `opEq`], [`ne`, `opNe`], [`gt`, `opGt`], [`ge`, `opGe`], [`lt`, `opLt`], [`le`, `opLe`],
    [`contains`, `opContains`], [`empty`, `opEmpty`], [`notEmpty`, `opNotEmpty`], [`true`, `opTrue`], [`false`, `opFalse`]
  ];
  const NO_VALUE = new Set([`empty`, `notEmpty`, `true`, `false`]);
  const QUALITY_KEYS = { summary: `labQualitySummary`, list: `labQualityList` };

  const $ = (id) => document.getElementById(id);
  const el = {
    tabExplorer: $(`tabExplorer`), tabLab: $(`tabLab`), panelExplorer: $(`panelExplorer`), panelLab: $(`panelLab`),
    message: $(`labMessage`), form: $(`labForm`), start: $(`labStart`), startInfo: $(`labStartInfo`), table: $(`labTable`),
    path: $(`labPath`), group: $(`labGroup`), group2: $(`labGroup2`), merge: $(`labMerge`), fn: $(`labFn`),
    column: $(`labColumn`), sort: $(`labSort`), run: $(`labRun`), refresh: $(`labRefresh`), auto: $(`labAuto`),
    info: $(`labInfo`), warnings: $(`labWarnings`), result: $(`labResult`), copy: $(`labCopy`)
  };
  const filters = [{ box: $(`labFilter1`) }, { box: $(`labFilter2`) }];
  let lastText = ``;
  let hasRun = false;
  let running = false;
  let again = false;
  let ancestors = [];
  let descendants = [];

  const state = () => window.exportTdbContext.state;

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

  // The starting row chosen in the form: { table, steps } where steps lead from the selected row to it.
  function currentStart() {
    const s = state();
    if (el.start.value === `self` || !ancestors[Number(el.start.value)]) return { table: s.linked, steps: [] };
    const entry = ancestors[Number(el.start.value)];
    return { table: entry.table, steps: entry.steps };
  }

  // Columns of a table that can be chosen: its own columns and, for each reference column, the
  // columns of the table it points to (one level), written as `Reference > Column`.
  function columnChoices(tableId) {
    const schema = state().schema;
    const table = schema.tables.get(tableId);
    const out = [];
    for (const column of table.columns) {
      out.push({ path: column.id, label: `${column.id}`, numeric: /^(Numeric|Int)$/.test(column.base) });
      if (column.kind === `ref` && schema.tables.has(column.target)) {
        for (const inner of schema.tables.get(column.target).columns) {
          if (inner.kind === `reflist` || inner.kind === `attachments`) continue;
          out.push({ path: `${column.id}.${inner.id}`, label: `${column.id} > ${inner.id}`, numeric: /^(Numeric|Int)$/.test(inner.base) });
        }
      }
    }
    return out;
  }

  // Text of a chain of references, with a note when it is not a plain chain of single references.
  function pathLabel(schema, path) {
    const quality = pathQuality(schema, path);
    const note = QUALITY_KEYS[quality] ? ` ${t(QUALITY_KEYS[quality])}` : ``;
    return `${path.map(describeStep).join(` ; `)}${note}`;
  }

  // Fills the list of starting rows: the selected row and the tables it points to.
  function fillStart() {
    const s = state();
    ancestors = findAncestors(s.schema, s.linked);
    const items = [[`self`, t(`labStartSelected`, { table: s.linked })]];
    ancestors.forEach((entry, index) => {
      items.push([String(index), t(`labStartParent`, { table: entry.table, chain: entry.steps.map((st) => `${st.from}.${st.column}`).join(` > `) })]);
    });
    fillSelect(el.start, items, true);
  }

  // Fills the lists that depend on the starting row: the tables that belong to it and the filters.
  function fillForStart() {
    const s = state();
    const start = currentStart();
    descendants = rankDescendants(s.schema, findDescendants(s.schema, start.table));
    const suffix = (entry) => (QUALITY_KEYS[entry.quality] ? ` ${t(QUALITY_KEYS[entry.quality])}` : ``);
    const previous = el.table.value;
    fillSelect(el.table, [[start.table, t(`labTableStart`, { table: start.table })], ...descendants.map((d) => [d.table, `${d.table}${suffix(d)}`])], false);
    if ([...el.table.options].some((o) => o.value === previous)) el.table.value = previous;
    fillForTable();
  }

  // Fills the lists that depend on the table: the link, the columns and the filters.
  function fillForTable() {
    const s = state();
    const start = currentStart();
    const tableId = el.table.value;
    const entry = descendants.find((d) => d.table === tableId);
    const paths = entry ? entry.paths.map((path, index) => [String(index), pathLabel(s.schema, path)]) : [[`self`, t(`labSelfRow`)]];
    fillSelect(el.path, [...paths, [`all`, t(`labAllRows`)]], false);
    const choices = columnChoices(tableId);
    fillSelect(el.group, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])], false);
    fillSelect(el.group2, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])], false);
    fillSelect(el.column, [[``, t(`labNone`)], ...choices.filter((c) => c.numeric).map((c) => [c.path, c.label]), ...choices.filter((c) => !c.numeric).map((c) => [c.path, c.label])], false);
    for (const filter of filters) fillFilter(filter, choices, columnChoices(start.table));
  }

  // Builds the controls of one filter: column, operator, source and value.
  function fillFilter(filter, choices, startChoices) {
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
    fillSelect(filter.field, startChoices.map((c) => [c.path, c.label]), false);
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
    fillStart();
    fillSelect(el.fn, FUNCTIONS.map(([value, key]) => [value, t(key)]), true);
    fillSelect(el.sort, [[`key`, t(`labSortKey`)], [`value`, t(`labSortValue`)]], true);
    fillForStart();
  }

  // ------------------------------------------------------------------ Data

  // Names of the tables a calculation needs: the table, the linked table, the tables of the chains and
  // the tables that references lead to, a few levels away.
  function neededTables(tableId, chain, start) {
    const s = state();
    const names = new Set([tableId, s.linked, start.table]);
    for (const step of [...(chain || []), ...start.steps]) {
      names.add(step.from);
      names.add(step.to);
    }
    let frontier = [tableId, s.linked, start.table];
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

  // Describes the starting row so that the user sees which row the result is about.
  function describeStart(dataset, start, startId) {
    if (!start.steps.length) return t(`labStartInfoSelf`, { table: start.table, id: startId });
    const last = start.steps[start.steps.length - 1];
    const column = dataset.table(last.from).columnMeta(last.column);
    const label = column ? dataset.refLabel(column, startId) : ``;
    return t(`labStartInfoParent`, { table: start.table, id: startId, label: label || `?` });
  }

  // Runs the calculation described by the form.
  async function run() {
    if (running) {
      again = true;
      return;
    }
    running = true;
    const s = state();
    el.warnings.hidden = true;
    el.warnings.textContent = ``;
    try {
      const start = currentStart();
      const tableId = el.table.value;
      const entry = descendants.find((d) => d.table === tableId);
      const choice = el.path.value;
      const chain = choice !== `all` && choice !== `self` && entry ? entry.paths[Number(choice)] : null;
      const loadedInfo = await ensureLoaded(neededTables(tableId, chain, start));
      const dataset = createDataset(s.schema, cache);
      const startId = start.steps.length ? contextRowId(dataset, start.steps, s.record.id) : s.record.id;
      el.startInfo.textContent = startId ? describeStart(dataset, start, startId) : t(`labStartNone`);
      const started = performance.now();
      const total = dataset.table(tableId).count;
      let rows;
      if (choice === `all`) rows = allRows(dataset, tableId);
      else if (choice === `self`) rows = dataset.table(tableId).rowOfId(startId) >= 0 ? [dataset.table(tableId).rowOfId(startId)] : [];
      else rows = startId && chain ? rowsInContext(dataset, chain, startId) : [];
      const context = { dataset, linked: start.table, selectedId: startId };
      const wanted = filters.map(readFilter).filter(Boolean);
      const filtered = applyFilters(rows, tableId, wanted, context);
      rows = filtered.rows;
      const problems = filtered.errors.map((reason) => t(`labFilterIgnored`, { reason }));
      const merge = el.merge.checked;
      const groupBy = [el.group.value, el.group2.value].filter(Boolean).map((path) => ({ path, merge }));
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
      hasRun = true;
    } catch (error) {
      el.result.textContent = ``;
      el.copy.hidden = true;
      el.info.textContent = t(`labError`, { reason: String(error && error.message ? error.message : error) });
    } finally {
      running = false;
      if (again) {
        again = false;
        run();
      }
    }
  }

  // ------------------------------------------------------------------ Start

  el.tabExplorer.addEventListener(`click`, () => showTab(`explorer`));
  el.tabLab.addEventListener(`click`, () => showTab(`lab`));
  el.start.addEventListener(`change`, () => {
    fillForStart();
    hasRun = false;
    el.startInfo.textContent = ``;
  });
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
  // The result follows the selected row: it is calculated again when the row changes.
  window.addEventListener(`exporttdb:rowchanged`, () => {
    if (!el.panelLab.hidden && hasRun && el.auto.checked) run();
  });
})();
