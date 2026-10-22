// Computes the content of a table block: which rows belong to the selected row (by the starting row,
// the table and the link chosen in the block), which pass the filters, then either a list of the rows
// with chosen columns (mode `list`) or one line per group with measures (mode `group`), sorted, with
// an optional total line. It returns texts ready to draw. This file has no access to the page or to
// Grist: it is pure logic, tested with Node.
(function (root) {
  const isNode = typeof module !== `undefined` && module.exports;
  const need = (name, file) => (isNode ? require(file) : root[name]);
  const schemaTools = need(`exportTdbSchema`, `./schema.js`);
  const rowset = need(`exportTdbRowset`, `./rowset.js`);
  const aggregate = need(`exportTdbAggregate`, `./aggregate.js`);
  const fields = need(`exportTdbFields`, `./fields.js`);
  const format = need(`exportTdbFormat`, `./format.js`);
  const values = need(`exportTdbValues`, `./values.js`);

  // The most rows that a block computes (the page could not show more anyway).
  const MAX_ROWS = 2000;
  const NO_VALUE = new Set([`empty`, `notEmpty`, `true`, `false`]);

  // Key of a chain of steps going down from a table: `Table.Column>Table.Column`.
  const chainKey = (steps) => steps.map((step) => `${step.from}.${step.column}`).join(`>`);

  // The starting rows that can be chosen: the selected row itself (key empty) and the items it points
  // to through up to two single references. Returns [{ key, table, steps }], `key` being `A.B`.
  function listStarts(schema, linked) {
    const starts = [{ key: ``, table: linked, steps: [] }];
    for (const entry of schemaTools.findAncestors(schema, linked)) {
      starts.push({ key: entry.steps.map((step) => step.column).join(`.`), table: entry.table, steps: entry.steps });
    }
    return starts;
  }

  // The tables that can be calculated from a starting table, best links first: the starting table
  // itself and the tables that descend from it. Returns [{ table, quality }].
  function listTables(schema, startTable) {
    const ranked = schemaTools.rankDescendants(schema, schemaTools.findDescendants(schema, startTable));
    return [{ table: startTable, quality: `direct` }, ...ranked.map((entry) => ({ table: entry.table, quality: entry.quality }))];
  }

  // The links between a table and a starting table: [{ key, steps, quality, label }] with the key
  // `self` (the starting row alone, when the table is the starting table) and `all` at the ends.
  function listLinks(schema, startTable, tableId) {
    const links = [];
    if (tableId === startTable) links.push({ key: `self`, steps: [], quality: `direct` });
    const entry = schemaTools.rankDescendants(schema, schemaTools.findDescendants(schema, startTable)).find((item) => item.table === tableId);
    for (const path of entry ? entry.paths : []) {
      links.push({ key: chainKey(path), steps: path, quality: schemaTools.pathQuality(schema, path) });
    }
    links.push({ key: `all`, steps: [], quality: `all` });
    return links;
  }

  // Every table of the document that a block can show, the ordinary tables first (alphabetical order),
  // then the summary tables. Returns [{ table, summary }].
  function listAllTables(schema) {
    const all = schema.order.map((id) => ({ table: id, summary: Boolean(schema.tables.get(id).summary) }));
    return all.sort((a, b) => Number(a.summary) - Number(b.summary) || a.table.localeCompare(b.table, `fr`, { sensitivity: `base` }));
  }

  // The ways to choose the rows of a table: the selected row alone, the rows that point to the selected
  // row or to an item that it points to (a building, a site...), and all the rows. Each choice holds
  // `value` (`start|link`, to keep in a menu), `start` and `link` (the settings of the block), `kind`
  // (`self`, `link` or `all`), `quality`, `startTable`, `startSteps` (from the selected row to the
  // starting item) and `steps` (from the table to the starting item). The best choices come first.
  function listChoices(schema, linked, tableId) {
    const rank = { direct: 0, summary: 1, list: 2 };
    const found = [];
    for (const start of listStarts(schema, linked)) {
      if (start.table === tableId) {
        found.push({ value: `${start.key}|self`, start: start.key, link: `self`, kind: `self`, quality: `direct`, startTable: start.table, startSteps: start.steps, steps: [] });
      }
      for (const link of listLinks(schema, start.table, tableId)) {
        if (link.key === `self` || link.key === `all`) continue;
        found.push({ value: `${start.key}|${link.key}`, start: start.key, link: link.key, kind: `link`, quality: link.quality, startTable: start.table, startSteps: start.steps, steps: link.steps });
      }
    }
    const order = (choice) => [choice.kind === `self` ? 0 : 1, rank[choice.quality] === undefined ? 3 : rank[choice.quality], choice.steps.length, choice.startSteps.length];
    found.sort((a, b) => {
      const x = order(a);
      const y = order(b);
      for (let index = 0; index < x.length; index += 1) if (x[index] !== y[index]) return x[index] - y[index];
      return 0;
    });
    found.push({ value: `|all`, start: ``, link: `all`, kind: `all`, quality: `all`, startTable: linked, startSteps: [], steps: [] });
    return found;
  }

  // Names of the tables that a block needs: the table of the row, the tables of the starting row and of
  // the link, the table of the block and the tables that its columns, groups and filters cross.
  function tablesFor(schema, linked, config) {
    const found = new Set();
    if (!config.table || !schema.tables.has(config.table)) return [];
    found.add(linked);
    found.add(config.table);
    const start = listStarts(schema, linked).find((item) => item.key === config.start);
    if (start) {
      found.add(start.table);
      start.steps.forEach((step) => found.add(step.to));
    }
    if (start && config.link && config.link !== `all` && config.link !== `self`) {
      const link = listLinks(schema, start.table, config.table).find((item) => item.key === config.link);
      if (link) link.steps.forEach((step) => { found.add(step.from); found.add(step.to); });
    }
    const paths = [
      ...config.columns.map((column) => column.path),
      ...config.groupBy,
      ...config.filters.map((filter) => filter.path),
      config.sort.column
    ].filter(Boolean);
    fields.tablesForPaths(schema, config.table, paths).forEach((name) => found.add(name));
    return [...found].filter((name) => schema.tables.has(name));
  }

  // A filter of the block as the rowset module wants it (the values typed as numbers become numbers).
  function toRowsetFilter(filter) {
    if (NO_VALUE.has(filter.op) || !filter.value) return { path: filter.path, op: filter.op };
    return { path: filter.path, op: filter.op, value: filter.value };
  }

  // The default title of a column: the label of the last column of its path, in the table that holds it.
  function pathLabel(dataset, tableId, path) {
    const resolved = dataset.resolvePath(tableId, path);
    return resolved.error ? path : resolved.column.label || resolved.column.id;
  }

  // A number as a text with the chosen decimals (counts never have decimals); null gives an empty text.
  function numberText(value, fn, decimals) {
    if (typeof value !== `number` || !Number.isFinite(value)) return ``;
    if (fn === `count` || fn === `distinct`) return format.formatNumber(value, 0);
    return format.formatNumber(value, decimals >= 0 ? decimals : undefined);
  }

  // The rows of the block: all the rows, the starting row alone, or the rows linked to the starting row.
  function selectRows(schema, dataset, linked, record, config) {
    const start = listStarts(schema, linked).find((item) => item.key === config.start);
    if (!start) return { problem: `start` };
    if (!dataset.table(start.table)) return { problem: `notloaded` };
    const startId = start.steps.length ? rowset.contextRowId(dataset, start.steps, record.id) : record.id;
    if (!startId) return { problem: `nostart`, start };
    const table = dataset.table(config.table);
    if (config.link === `all`) return { rows: rowset.allRows(dataset, config.table), start, startId };
    if (config.link === `self`) {
      const index = config.table === start.table ? table.rowOfId(startId) : -1;
      return index >= 0 ? { rows: [index], start, startId } : { problem: `link` };
    }
    const link = listLinks(schema, start.table, config.table).find((item) => item.key === config.link);
    if (!link || !link.steps.length) return { problem: `link` };
    if (link.steps.some((step) => !dataset.table(step.from))) return { problem: `notloaded` };
    return { rows: rowset.rowsInContext(dataset, link.steps, startId), start, startId };
  }

  // The result of a list: one line per row with the chosen columns.
  function listResult(dataset, config, rows, words) {
    const columns = config.columns.filter((column) => column.path);
    const resolved = [];
    for (const column of columns) {
      const one = dataset.resolvePath(config.table, column.path);
      if (one.error) return { error: `${column.path}: ${one.error}` };
      resolved.push(one);
    }
    let order = rows;
    if (config.sort.by === `column` && config.sort.column) {
      const key = dataset.resolvePath(config.table, config.sort.column);
      if (key.error) return { error: `${config.sort.column}: ${key.error}` };
      const sign = config.sort.dir === `desc` ? -1 : 1;
      const read = (row) => {
        const raw = dataset.valueAt(key, row);
        const number = key.column.kind === `plain` ? values.toNumber(raw) : null;
        return number === null ? dataset.textAt(key, row) : number;
      };
      order = rows.slice().sort((a, b) => {
        const x = read(a);
        const y = read(b);
        if (typeof x === `number` && typeof y === `number`) return sign * (x - y);
        return sign * aggregate.compareLabels(String(x), String(y));
      });
    }
    const shown = order.slice(0, MAX_ROWS);
    const body = shown.map((row) => resolved.map((one) => fields.formatValue(one.column, dataset.valueAt(one, row), dataset, words, config.decimals)));
    const headers = columns.map((column, index) => ({ text: column.label || pathLabel(dataset, config.table, column.path), numeric: resolved[index].column.base === `Numeric` || resolved[index].column.base === `Int` }));
    let total = null;
    if (config.total && columns.some((column) => column.fn)) {
      total = columns.map((column, index) => {
        if (!column.fn) return index === 0 ? words.total : ``;
        const numbers = rows.map((row) => (column.fn === `distinct` ? dataset.textAt(resolved[index], row) : values.toNumber(dataset.valueAt(resolved[index], row))));
        const value = column.fn === `distinct` ? new Set(numbers.filter((text) => text !== ``)).size : aggregate.summarize(numbers, column.fn);
        return numberText(value, column.fn, config.decimals);
      });
    }
    return { headers, rows: body, total, truncated: order.length > shown.length };
  }

  // The result of a grouping: one line per group with the keys and the measures.
  function groupResult(dataset, config, rows, words) {
    const measures = config.columns.filter((column) => column.path || column.fn === `count`).map((column) => ({ fn: column.fn || `sum`, path: column.path || undefined, label: column.label }));
    const groupBy = config.groupBy.filter(Boolean).map((path) => ({ path, merge: config.merge }));
    const sort = config.sort.by === `value` ? { by: `value`, measure: 0, dir: config.sort.dir } : { by: `key`, dir: config.sort.dir };
    const result = aggregate.groupRows(dataset, config.table, rows, { groupBy, measures, sort, emptyLabel: words.empty });
    if (result.error) return { error: result.error };
    const headers = [
      ...groupBy.map((group) => ({ text: pathLabel(dataset, config.table, group.path), numeric: false })),
      ...measures.map((measure) => ({ text: measure.label || `${words[measure.fn]}${measure.path ? ` (${pathLabel(dataset, config.table, measure.path)})` : ``}`, numeric: true }))
    ];
    const shown = result.rows.slice(0, MAX_ROWS);
    const body = shown.map((row) => [...row.keys, ...row.values.map((value, index) => numberText(value, measures[index].fn, config.decimals))]);
    const total = config.total ? [words.total, ...groupBy.slice(1).map(() => ``), ...result.totals.map((value, index) => numberText(value, measures[index].fn, config.decimals))] : null;
    return { headers, rows: body, total, truncated: result.rows.length > shown.length };
  }

  // Computes a table block for the selected row `record` of the table `linked`. `config` is the cleaned
  // configuration of the block and `words` holds the texts that the tables use (the names of the
  // functions, `total` and `empty`). Returns { ok: true, headers, rows, total, kept, truncated, warnings }
  // or { ok: false, reason, detail } with the reason `choose` (nothing chosen yet), `start`, `nostart`,
  // `link`, `notloaded`, `columns` (no column chosen) or `error`.
  function runTable(schema, dataset, linked, record, config, words) {
    if (!record || !config.table || !config.link || !schema.tables.has(config.table)) return { ok: false, reason: `choose` };
    if (!dataset.table(config.table)) return { ok: false, reason: `notloaded` };
    if (config.mode === `list` ? !config.columns.some((column) => column.path) : (!config.groupBy.some(Boolean) || !config.columns.some((column) => column.path || column.fn === `count`))) {
      return { ok: false, reason: config.mode === `list` ? `columns` : `groups` };
    }
    const chosen = selectRows(schema, dataset, linked, record, config);
    if (chosen.problem) return { ok: false, reason: chosen.problem };
    const context = { dataset, linked: chosen.start.table, selectedId: chosen.startId };
    const filtered = rowset.applyFilters(chosen.rows, config.table, config.filters.map(toRowsetFilter), context);
    const outcome = config.mode === `list` ? listResult(dataset, config, filtered.rows, words) : groupResult(dataset, config, filtered.rows, words);
    if (outcome.error) return { ok: false, reason: `error`, detail: outcome.error };
    return { ok: true, ...outcome, kept: filtered.rows.length, scanned: chosen.rows.length, warnings: filtered.errors };
  }

  const api = { MAX_ROWS, chainKey, listStarts, listTables, listLinks, listAllTables, listChoices, tablesFor, runTable };
  if (isNode) module.exports = api;
  else root.exportTdbTableQuery = api;
})(typeof window !== `undefined` ? window : globalThis);
