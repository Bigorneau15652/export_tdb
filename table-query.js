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
  // A scatter chart draws at most this many points and this many series (one colour each).
  const MAX_POINTS = 2000;
  const MAX_SERIES = 10;
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
  // starting item), `steps` (from the table to the starting item) and `advanced` (true for a link that
  // crosses several tables, a list or a summary table). When the same link can be reached from the
  // selected row by a short and by a longer way, only the shortest way is kept. The best choices come
  // first and `all` is last.
  function listChoices(schema, linked, tableId) {
    const rank = { direct: 0, summary: 1, list: 2 };
    const found = [];
    for (const start of listStarts(schema, linked)) {
      if (start.table === tableId) {
        found.push({ value: `${start.key}|self`, start: start.key, link: `self`, kind: `self`, quality: `direct`, startTable: start.table, startSteps: start.steps, steps: [], advanced: false });
      }
      for (const link of listLinks(schema, start.table, tableId)) {
        if (link.key === `self` || link.key === `all`) continue;
        found.push({ value: `${start.key}|${link.key}`, start: start.key, link: link.key, kind: `link`, quality: link.quality, startTable: start.table, startSteps: start.steps, steps: link.steps, advanced: link.steps.length > 1 || link.quality !== `direct` });
      }
    }
    const meaning = (choice) => `${choice.kind}|${choice.link}|${choice.startTable}`;
    const shortest = new Map();
    for (const choice of found) {
      const known = shortest.get(meaning(choice));
      if (known === undefined || choice.startSteps.length < known) shortest.set(meaning(choice), choice.startSteps.length);
    }
    const kept = found.filter((choice) => choice.startSteps.length === shortest.get(meaning(choice)));
    const order = (choice) => [choice.advanced ? 1 : 0, choice.kind === `self` ? 0 : 1, rank[choice.quality] === undefined ? 3 : rank[choice.quality], choice.steps.length, choice.startSteps.length];
    kept.sort((a, b) => {
      const x = order(a);
      const y = order(b);
      for (let index = 0; index < x.length; index += 1) if (x[index] !== y[index]) return x[index] - y[index];
      return 0;
    });
    kept.push({ value: `|all`, start: ``, link: `all`, kind: `all`, quality: `all`, startTable: linked, startSteps: [], steps: [], advanced: false });
    return kept;
  }

  // The tables that a dynamic table can show, in three groups: `own` (the table of the selected row and
  // the tables that point to it), `related` (the tables of the items that the selected row points to, such as
  // its building or its site, and the tables that point to those items) and `summary` (summary tables of
  // the selected row). Each group is in alphabetical order. Returns [{ table, group }].
  function listDynamicTables(schema, linked) {
    const byName = (a, b) => a.table.localeCompare(b.table, `fr`, { sensitivity: `base` });
    const seen = new Set();
    const groups = { own: [], related: [], summary: [] };
    const add = (table, group) => {
      if (seen.has(table) || !schema.tables.has(table)) return;
      seen.add(table);
      groups[group].push({ table, group });
    };
    const own = listTables(schema, linked);
    own.filter((entry) => entry.quality === `direct`).forEach((entry) => add(entry.table, `own`));
    for (const start of listStarts(schema, linked).slice(1)) {
      add(start.table, `related`);
      listTables(schema, start.table).filter((entry) => entry.quality === `direct`).forEach((entry) => add(entry.table, `related`));
    }
    own.filter((entry) => entry.quality === `summary`).forEach((entry) => add(entry.table, `summary`));
    return [...groups.own.sort(byName), ...groups.related.sort(byName), ...groups.summary.sort(byName)];
  }

  // The columns of a table that hold numbers (they can be added up or averaged): numeric columns and
  // columns of type Any, also reached through a reference (`Floor.Area`). Returns a Set of paths.
  function numericPaths(schema, tableId) {
    return new Set(fields.fieldChoices(schema, tableId).filter((choice) => choice.base === `Numeric` || choice.base === `Int` || choice.base === `Any`).map((choice) => choice.path));
  }

  // The names of the tables needed to count the rows of every choice of rows of a table.
  function tablesForChoices(schema, linked, tableId) {
    const found = new Set([linked, tableId]);
    for (const choice of listChoices(schema, linked, tableId)) {
      found.add(choice.startTable);
      choice.startSteps.forEach((step) => found.add(step.to));
      choice.steps.forEach((step) => {
        found.add(step.from);
        found.add(step.to);
      });
    }
    return [...found].filter((name) => schema.tables.has(name));
  }

  // For every choice of rows of a table, how many rows it keeps for the selected row `record`: the
  // explanation shown to the user. Returns [{ choice, kept, total }] (`kept` is null when it cannot be
  // counted yet: a table is not loaded, or the selected row has no starting item).
  function explainChoices(schema, dataset, linked, record, tableId) {
    const total = dataset.table(tableId) ? dataset.table(tableId).count : null;
    return listChoices(schema, linked, tableId).map((choice) => {
      const chosen = record && dataset.table(tableId) ? selectRows(schema, dataset, linked, record, { table: tableId, start: choice.start, link: choice.link }) : { problem: `notloaded` };
      return { choice, kept: chosen.problem ? null : chosen.rows.length, total };
    });
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
      config.colItem,
      ...config.filters.map((filter) => filter.path),
      config.sort.column
    ].filter(Boolean);
    paths.push(...fields.extractFields(config.labelTemplate), ...fields.extractFields(config.labelTemplate2));
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

  // The decimals of a column: its own choice (-1 is automatic) or, when it has none, those of the table.
  function decimalsOf(column, config) {
    return Number.isInteger(column.decimals) && column.decimals >= -1 ? column.decimals : config.decimals;
  }

  // A number as a text with the chosen decimals (counts never have decimals); null gives an empty text.
  function numberText(value, fn, decimals) {
    if (typeof value !== `number` || !Number.isFinite(value)) return ``;
    if (fn === `count` || fn === `distinct`) return format.formatNumber(value, 0);
    return format.formatNumber(value, decimals >= 0 ? decimals : undefined);
  }

  // True when the total on the right needs at least two columns to combine and there are not enough.
  function rightTotalPossible(config) {
    if (config.mode === `cross`) return true;
    return config.columns.filter((column) => column.path || (config.mode === `group` && column.fn === `count`)).length >= 2;
  }

  // One number from the values of a line. Sum, average, minimum and maximum use the numbers; count
  // gives the number of values that are filled and distinct the number of different values.
  // Returns null when there is nothing to combine.
  function combine(items, fn) {
    const filled = items.filter((item) => item !== null && item !== undefined && item !== `` && !(typeof item === `number` && Number.isNaN(item)));
    if (fn === `count`) return filled.length;
    if (fn === `distinct`) return new Set(filled).size;
    const list = filled.filter((item) => typeof item === `number` && Number.isFinite(item));
    if (!list.length) return null;
    if (fn === `avg`) return list.reduce((x, y) => x + y, 0) / list.length;
    if (fn === `min`) return Math.min(...list);
    if (fn === `max`) return Math.max(...list);
    return list.reduce((x, y) => x + y, 0);
  }

  // The text written in the first cell of the total line: the label chosen for the block or, without one, the word Total.
  function totalWord(config, words) {
    return config.totalLabel || words.total;
  }

  // The decimals of the total on the right: its own choice or, when it has none, those of the table.
  function rightDecimals(config) {
    return Number.isInteger(config.totalRightDecimals) && config.totalRightDecimals >= -1 ? config.totalRightDecimals : config.decimals;
  }

  // The composed label of the rows of a block: the model written by the user (`{Number} {Name}`) with each field
  // replaced by the text of that column of the row. Returns { read, unknown } : `read` is a function from a row to a
  // text and `unknown` lists the columns of the model that the table does not have (they give an empty text, so that
  // the table is still drawn); nothing is returned when the block has no model.
  function labelReader(dataset, config, words, text) {
    const template = String(text === undefined ? config.labelTemplate : text || ``).trim();
    if (!template) return {};
    const resolved = new Map();
    const unknown = [];
    for (const path of fields.extractFields(template)) {
      const one = dataset.resolvePath(config.table, path);
      if (one.error) unknown.push(path);
      else resolved.set(path, one);
    }
    const read = (row) => fields.fillTemplate(template, (path) => {
      const one = resolved.get(path);
      return one ? fields.formatValue(one.column, dataset.valueAt(one, row), dataset, words) : ``;
    }).replace(/\s+/g, ` `).trim();
    return { read, unknown };
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
    const label = labelReader(dataset, config, words);
    const shown = order.slice(0, MAX_ROWS);
    const body = shown.map((row) => resolved.map((one, index) => fields.formatValue(one.column, dataset.valueAt(one, row), dataset, words, decimalsOf(columns[index], config))));
    const headers = columns.map((column, index) => ({ text: column.label || pathLabel(dataset, config.table, column.path), numeric: resolved[index].column.base === `Numeric` || resolved[index].column.base === `Int` }));
    let total = null;
    const totalValues = [];
    if (config.total && columns.some((column) => column.fn)) {
      total = columns.map((column, index) => {
        if (!column.fn) return index === 0 && !label.read ? totalWord(config, words) : ``;
        const numbers = rows.map((row) => (column.fn === `distinct` ? dataset.textAt(resolved[index], row) : values.toNumber(dataset.valueAt(resolved[index], row))));
        const value = column.fn === `distinct` ? new Set(numbers.filter((text) => text !== ``)).size : aggregate.summarize(numbers, column.fn);
        totalValues[index] = value;
        return numberText(value, column.fn, decimalsOf(column, config));
      });
    }
    if (config.totalRight && rightTotalPossible(config)) {
      const fn = config.totalRightFn;
      const used = columns.map((column, index) => index).filter((index) => fn === `count` || fn === `distinct` || [`Numeric`, `Int`, `Any`].includes(resolved[index].column.base));
      const read = (row, index) => (fn === `distinct` ? dataset.textAt(resolved[index], row) : values.toNumber(dataset.valueAt(resolved[index], row)));
      headers.push({ text: words.total, numeric: true });
      shown.forEach((row, at) => body[at].push(numberText(combine(used.map((index) => read(row, index)), fn), fn, rightDecimals(config))));
      if (total) total.push(numberText(combine(used.map((index) => totalValues[index]), fn), fn, rightDecimals(config)));
    }
    if (label.read) {
      headers.unshift({ text: ``, numeric: false });
      shown.forEach((row, at) => body[at].unshift(label.read(row)));
      if (total) total.unshift(totalWord(config, words));
    }
    const out = { headers, rows: body, total, truncated: order.length > shown.length, labelProblems: label.unknown || [] };
    if (config.chart === `scatter` && resolved.length >= 2) out.scatter = scatterPoints(dataset, config, columns, resolved, order, words);
    return out;
  }

  // The points of a scatter chart from the rows of a list: the first column gives the horizontal number, the second
  // the vertical one and the third (optional) the series, one colour each. A row without both numbers is left out.
  function scatterPoints(dataset, config, columns, resolved, rows, words) {
    const name = (index) => columns[index].label || pathLabel(dataset, config.table, columns[index].path);
    const groups = new Map();
    let kept = 0;
    for (const row of rows.slice(0, MAX_POINTS)) {
      const x = values.toNumber(dataset.valueAt(resolved[0], row));
      const y = values.toNumber(dataset.valueAt(resolved[1], row));
      if (x === null || y === null) continue;
      const key = resolved.length > 2 ? dataset.textAt(resolved[2], row) || words.empty : ``;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([x, y]);
      kept += 1;
    }
    const series = [...groups.entries()].slice(0, MAX_SERIES).map(([key, points]) => ({ name: key, points }));
    return { xName: name(0), yName: name(1), series, kept, groups: groups.size };
  }

  // The rank of each row of the table that a reference column points to, in the order that the user gave to
  // that table in Grist (its manual order column when Grist sends it, otherwise the order of the rows).
  function targetRanks(target) {
    const manual = target.column(`manualSort`);
    const indexes = target.ids.map((_, index) => index);
    if (Array.isArray(manual)) indexes.sort((a, b) => (Number(manual[a]) - Number(manual[b])) || (a - b));
    const ranks = new Map();
    indexes.forEach((index, rank) => ranks.set(target.ids[index], rank));
    return ranks;
  }

  // A function that gives a row of the table of the block the rank of its first group in the order of the
  // table that the first column of the item points to, or null when the item does not start with a
  // reference column or that table is not loaded.
  function refRankOf(dataset, tableId, path) {
    if (!path) return null;
    const first = dataset.resolvePath(tableId, path.split(`.`)[0]);
    if (first.error || first.column.kind !== `ref`) return null;
    const target = dataset.table(first.column.target);
    if (!target) return null;
    const ranks = targetRanks(target);
    return (row) => {
      const raw = dataset.valueAt(first, row);
      return ranks.has(raw) ? ranks.get(raw) : null;
    };
  }

  // The sort of a grouped table for the aggregation: by label, by value, in the order of the table of the
  // item (`ref`) or in the list of labels that the user gave (`manual`).
  function groupSort(dataset, config) {
    const { by, dir, order } = config.sort;
    if (by === `value`) return { by: `value`, measure: 0, dir };
    if (by === `manual`) return { by: `key`, dir: `asc`, order };
    if (by === `ref`) {
      const rankOf = refRankOf(dataset, config.table, config.groupBy.find(Boolean));
      if (rankOf) return { by: `ref`, dir, rankOf };
    }
    return { by: `key`, dir };
  }

  // The imposed order of the labels of an item of a cross table, or nothing when the usual order (by label, ascending)
  // is wanted: the labels in the order of the table that the item points to (`ref`), in the list that the user gave
  // (`manual`), or by label descending.
  function crossOrder(dataset, tableId, rows, path, by, dir, manual, words, labelOf) {
    if (by === `manual`) return manual;
    const resolved = dataset.resolvePath(tableId, path);
    if (resolved.error) return undefined;
    const rankOf = by === `ref` ? refRankOf(dataset, tableId, path) : null;
    if (!rankOf && dir !== `desc`) return undefined;
    const ranks = new Map();
    for (const row of rows) {
      const label = (labelOf ? labelOf(row) : ``) || dataset.textAt(resolved, row) || words.empty;
      const rank = rankOf ? rankOf(row) : null;
      const value = rank === null ? Infinity : rank;
      ranks.set(label, ranks.has(label) ? Math.min(ranks.get(label), value) : value);
    }
    const sign = dir === `desc` ? -1 : 1;
    return [...ranks.keys()].sort((a, b) => sign * (ranks.get(a) === ranks.get(b) ? 0 : ranks.get(a) < ranks.get(b) ? -1 : 1) || sign * aggregate.compareLabels(a, b));
  }

  // The result of a cross table: the item of the lines down the side, the item of the columns along the top and one
  // calculation (the first column of the settings) in each cell. The columns are cut into slices of `config.slice`
  // columns (all of them when it is 0). Each slice is a table of its own with its heading line, its total line below
  // and, when asked, a total on the right that combines the columns of that slice. Returns { headers, rows, total,
  // slices, truncated } where the first slice is also given as headers, rows and total.
  function crossResult(dataset, config, rows, words) {
    const column = config.columns.find((item) => item.path || item.fn === `count`);
    const measure = { fn: column.fn || `sum`, path: column.path || undefined };
    const decimals = decimalsOf(column, config);
    const rowPath = config.groupBy.find(Boolean);
    const label = labelReader(dataset, config, words);
    const rowOrder = crossOrder(dataset, config.table, rows, rowPath, config.sort.by, config.sort.dir, config.sort.order, words, label.read);
    const colOrder = crossOrder(dataset, config.table, rows, config.colItem, config.colSort, `asc`, [], words);
    const cross = aggregate.crossTable(dataset, config.table, rows, { rowPath, colPath: config.colItem, measure, rowMerge: config.merge, colMerge: config.merge, rowLabelOf: label.read, emptyLabel: words.empty, rowOrder, colOrder });
    if (cross.error) return { error: cross.error };
    const shownKeys = cross.rowKeys.slice(0, MAX_ROWS);
    const fn = config.totalRightFn;
    const right = config.totalRight;
    const slices = aggregate.sliceColumns(cross, config.slice || cross.colKeys.length).map((slice) => {
      const headers = [{ text: pathLabel(dataset, config.table, rowPath), numeric: false }, ...slice.colKeys.map((key) => ({ text: key, numeric: true }))];
      if (right) headers.push({ text: words.total, numeric: true });
      const body = shownKeys.map((key, at) => {
        const line = [key, ...slice.cells[at].map((value) => numberText(value, measure.fn, decimals))];
        if (right) line.push(numberText(combine(slice.cells[at], fn), fn, rightDecimals(config)));
        return line;
      });
      let total = null;
      if (config.total) {
        total = [totalWord(config, words), ...slice.colTotals.map((value) => numberText(value, measure.fn, decimals))];
        if (right) total.push(numberText(combine(slice.colTotals, fn), fn, rightDecimals(config)));
      }
      return { headers, rows: body, total };
    });
    const chart = { categories: shownKeys, series: cross.colKeys.map((name, col) => ({ name, values: shownKeys.map((_, row) => cross.cells[row][col]) })) };
    return { headers: slices[0].headers, rows: slices[0].rows, total: slices[0].total, slices, chart, truncated: cross.rowKeys.length > shownKeys.length, labelProblems: label.unknown || [] };
  }

  // The heading of a measure of a grouped table: the name of the column alone for a sum (the usual calculation), then
  // `Average (Column)` and so on; a count without a column is just the word Count.
  function headerName(measure, dataset, config, words) {
    if (!measure.path) return words[measure.fn];
    const name = pathLabel(dataset, config.table, measure.path);
    return measure.fn === `sum` ? name : `${words[measure.fn]} (${name})`;
  }

  // The result of a grouping: one line per group with the keys and the measures.
  function groupResult(dataset, config, rows, words) {
    const measures = config.columns.filter((column) => column.path || column.fn === `count`).map((column) => ({ fn: column.fn || `sum`, path: column.path || undefined, label: column.label, decimals: decimalsOf(column, config) }));
    const label = labelReader(dataset, config, words);
    const label2 = labelReader(dataset, config, words, config.labelTemplate2);
    const readers = [label.read, label2.read];
    const groupBy = config.groupBy.filter(Boolean).map((path, at) => ({ path, merge: config.merge, ...(readers[at] ? { labelOf: readers[at] } : {}) }));
    const sort = groupSort(dataset, config);
    const result = aggregate.groupRows(dataset, config.table, rows, { groupBy, measures, sort, emptyLabel: words.empty });
    if (result.error) return { error: result.error };
    const headers = [
      ...groupBy.map((group) => ({ text: pathLabel(dataset, config.table, group.path), numeric: false })),
      ...measures.map((measure) => ({ text: measure.label || headerName(measure, dataset, config, words), numeric: true }))
    ];
    // The name of a series of a chart: the name of the column alone for a sum, then `Column (average)` and so on.
    const seriesName = (measure, at) => {
      if (measure.label) return measure.label;
      if (!measure.path) return words[measure.fn];
      const name = pathLabel(dataset, config.table, measure.path);
      return measure.fn === `sum` ? name : `${name} (${String(words[measure.fn]).toLowerCase()})`;
    };
    const shown = result.rows.slice(0, MAX_ROWS);
    // With two items the lines are nested: a line for each value of the first item (with its subtotal when asked), then
    // the lines of that value, which only write the second item. The lines of one value are put side by side, in the
    // order in which the values first appear. The two columns of items become one.
    const nested = groupBy.length > 1;
    let lines = shown.map((row) => ({ kind: `row`, group: -1, keys: row.keys, values: row.values }));
    if (nested) {
      let sumOf = null;
      if (config.subtotals) {
        const sums = aggregate.groupRows(dataset, config.table, rows, { groupBy: [groupBy[0]], measures, sort: { by: `key`, dir: `asc` }, emptyLabel: words.empty });
        if (sums.error) return { error: sums.error };
        sumOf = new Map(sums.rows.map((row) => [row.keys[0], row.values]));
      }
      const order = [];
      const byKey = new Map();
      for (const line of lines) {
        if (!byKey.has(line.keys[0])) {
          byKey.set(line.keys[0], []);
          order.push(line.keys[0]);
        }
        byKey.get(line.keys[0]).push(line);
      }
      lines = order.flatMap((key, at) => [
        { kind: `group`, group: at, keys: [key], values: sumOf ? sumOf.get(key) || measures.map(() => null) : measures.map(() => null) },
        ...byKey.get(key).map((line) => ({ kind: `row`, group: at, keys: [line.keys[1]], values: line.values }))
      ]);
      headers.splice(1, 1);
    }
    const body = lines.map((line) => [...line.keys, ...line.values.map((value, index) => numberText(value, measures[index].fn, measures[index].decimals))]);
    const total = config.total ? [totalWord(config, words), ...(nested ? [] : groupBy.slice(1).map(() => ``)), ...result.totals.map((value, index) => numberText(value, measures[index].fn, measures[index].decimals))] : null;
    if (config.totalRight && rightTotalPossible(config)) {
      const fn = config.totalRightFn;
      headers.push({ text: words.total, numeric: true });
      lines.forEach((line, at) => body[at].push(numberText(combine(line.values, fn), fn, rightDecimals(config))));
      if (total) total.push(numberText(combine(result.totals, fn), fn, rightDecimals(config)));
    }
    const chart = {
      categories: shown.map((row) => row.keys[0]),
      series: measures.map((measure, at) => ({ name: seriesName(measure, at), values: shown.map((row) => row.values[at]) }))
    };
    return { headers, rows: body, kinds: lines.map((line) => line.kind), groups: lines.map((line) => line.group), total, chart, truncated: result.rows.length > shown.length, labelProblems: [...(label.unknown || []), ...(groupBy.length > 1 ? label2.unknown || [] : [])] };
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
    const outcome = config.mode === `list` ? listResult(dataset, config, filtered.rows, words) : config.mode === `cross` ? crossResult(dataset, config, filtered.rows, words) : groupResult(dataset, config, filtered.rows, words);
    if (outcome.error) return { ok: false, reason: `error`, detail: outcome.error };
    return { ok: true, ...outcome, kept: filtered.rows.length, scanned: chosen.rows.length, warnings: filtered.errors };
  }

  // The result of a named value of the kind calculation, for the selected row `record` of the table `linked`:
  // one number from the rows of a table (chosen like those of a table block) with a function (sum, average,
  // minimum, maximum, count or number of different values) on a column. `calc` holds table, start, link, filters,
  // fn and path. Returns { ok: true, number, kept } or { ok: false, reason } (`choose`, `start`, `nostart`, `link`,
  // `notloaded` or `error`).
  function runValue(schema, dataset, linked, record, calc) {
    if (!record || !calc.table || !calc.link || !schema.tables.has(calc.table)) return { ok: false, reason: `choose` };
    if (!dataset.table(calc.table)) return { ok: false, reason: `notloaded` };
    if (!calc.path && calc.fn !== `count`) return { ok: false, reason: `choose` };
    const chosen = selectRows(schema, dataset, linked, record, calc);
    if (chosen.problem) return { ok: false, reason: chosen.problem };
    const context = { dataset, linked: chosen.start.table, selectedId: chosen.startId };
    const filtered = rowset.applyFilters(chosen.rows, calc.table, calc.filters.map(toRowsetFilter), context);
    const grouped = aggregate.groupRows(dataset, calc.table, filtered.rows, { groupBy: [], measures: [{ fn: calc.fn, path: calc.path || undefined }], emptyLabel: `` });
    if (grouped.error) return { ok: false, reason: `error`, detail: grouped.error };
    return { ok: true, number: grouped.totals[0], kept: filtered.rows.length };
  }

  const api = { MAX_ROWS, runValue, chainKey, listStarts, listTables, listLinks, listAllTables, listChoices, listDynamicTables, numericPaths, tablesForChoices, explainChoices, tablesFor, rightTotalPossible, runTable };
  if (isNode) module.exports = api;
  else root.exportTdbTableQuery = api;
})(typeof window !== `undefined` ? window : globalThis);
