// Computes what the blocks show: sums, averages and counts of the rows of a table, grouped by one
// or two columns, cross tables with their totals, and the summary line of a table column.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const values = typeof require !== `undefined` ? require(`./values.js`) : root.exportTdbValues;

  const FUNCTIONS = [`sum`, `avg`, `min`, `max`, `count`, `distinct`];

  // Sum, average, minimum, maximum or count of a list of numbers. Empty lists give 0 for a sum or a
  // count and null for the others, so that a missing value is never shown as 0.
  function summarize(numbers, fn) {
    const list = numbers.filter((n) => typeof n === `number` && Number.isFinite(n));
    if (fn === `count`) return list.length;
    if (fn === `distinct`) return new Set(list).size;
    if (!list.length) return fn === `sum` ? 0 : null;
    if (fn === `sum`) return list.reduce((a, b) => a + b, 0);
    if (fn === `avg`) return list.reduce((a, b) => a + b, 0) / list.length;
    if (fn === `min`) return list.reduce((a, b) => (b < a ? b : a));
    if (fn === `max`) return list.reduce((a, b) => (b > a ? b : a));
    return null;
  }

  // Compares two labels: numbers as numbers, texts in the French alphabetical order.
  function compareLabels(a, b) {
    const x = Number(a);
    const y = Number(b);
    if (a !== `` && b !== `` && Number.isFinite(x) && Number.isFinite(y)) return x - y;
    return String(a).localeCompare(String(b), `fr`, { numeric: true, sensitivity: `base` });
  }

  // Key of a row for a grouping: { id, label }. The text of the column is its label; a reference is
  // told apart by the number of its row, so that two rows with the same label stay two groups. A date
  // can be reduced to its year or its month.
  // With `merge` true the rows that have the same label make one group even when they are different rows.
  function keyOf(dataset, resolved, row, bucket, merge) {
    if (bucket === `year` || bucket === `month`) {
      const seconds = values.toSeconds(dataset.valueAt(resolved, row));
      if (seconds === null) return { id: ``, label: `` };
      const date = new Date(seconds * 1000);
      const year = String(date.getUTCFullYear());
      const label = bucket === `year` ? year : `${year}-${String(date.getUTCMonth() + 1).padStart(2, `0`)}`;
      return { id: label, label };
    }
    const label = dataset.textAt(resolved, row);
    if (resolved.column.kind === `ref` && !merge) {
      const raw = dataset.valueAt(resolved, row);
      return { id: raw ? `#${raw}` : ``, label };
    }
    return { id: label, label };
  }

  // The number a measure reads at a row, or null. A measure is { fn, path } ; `count` without a path
  // counts the rows. For `distinct` the text of the value is used.
  function readMeasure(dataset, resolved, measure, row) {
    if (!resolved) return measure.fn === `count` ? 1 : null;
    const raw = dataset.valueAt(resolved, row);
    if (measure.fn === `count`) return values.isEmpty(raw, resolved.column.type) ? null : 1;
    if (measure.fn === `distinct`) {
      if (resolved.column.kind === `ref`) return raw ? `#${raw}` : null;
      const text = dataset.textAt(resolved, row);
      return text === `` ? null : text;
    }
    return values.toNumber(raw);
  }

  // Applies a measure to the rows of a group.
  function measureRows(dataset, resolved, measure, rows) {
    const read = rows.map((row) => readMeasure(dataset, resolved, measure, row));
    if (measure.fn === `distinct`) return new Set(read.filter((v) => v !== null)).size;
    return summarize(read, measure.fn);
  }

  // Resolves the paths of a specification; returns { error } when one cannot be read.
  function resolveAll(dataset, tableId, specs, pathOf) {
    const out = [];
    for (const spec of specs) {
      const path = pathOf(spec);
      if (!path) {
        out.push(null);
        continue;
      }
      const resolved = dataset.resolvePath(tableId, path);
      if (resolved.error) return { error: `${path}: ${resolved.error}` };
      out.push(resolved);
    }
    return { list: out };
  }

  // Groups rows by one or two keys and computes the measures of each group.
  //   spec.groupBy: [{ path, bucket, merge }]  (bucket: year or month for a date; merge: one group for equal labels)
  //   spec.measures: [{ fn, path }]      (fn: sum, avg, min, max, count, distinct)
  //   spec.sort: { by: `key` | `value`, measure: 0, dir: `asc` | `desc`, order: [labels...] }
  //   spec.top: { count, otherLabel }    (keeps the best groups, the others become one group)
  //   spec.emptyLabel: label of the group of rows with an empty key
  // Returns { rows: [{ keys, values, count }], totals: [value per measure over all rows], count } or { error }.
  function groupRows(dataset, tableId, rows, spec) {
    const groups = resolveAll(dataset, tableId, spec.groupBy || [], (g) => g.path);
    if (groups.error) return { error: groups.error };
    const measures = resolveAll(dataset, tableId, spec.measures || [], (m) => m.path);
    if (measures.error) return { error: measures.error };
    const buckets = new Map();
    for (const row of rows) {
      const parts = groups.list.map((resolved, i) => {
        const key = keyOf(dataset, resolved, row, spec.groupBy[i].bucket, spec.groupBy[i].merge);
        return { id: key.id, label: key.label || (spec.emptyLabel || ``) };
      });
      const id = JSON.stringify(parts.map((p) => p.id));
      if (!buckets.has(id)) buckets.set(id, { keys: parts.map((p) => p.label), rows: [] });
      buckets.get(id).rows.push(row);
    }
    let result = [...buckets.entries()].map(([id, bucket]) => ({
      id,
      keys: bucket.keys, count: bucket.rows.length,
      values: (spec.measures || []).map((m, i) => measureRows(dataset, measures.list[i], m, bucket.rows))
    }));
    result = sortGroups(result, spec.sort);
    if (spec.top && spec.top.count > 0 && result.length > spec.top.count) result = keepTop(dataset, rows, result, spec, groups, measures);
    const totals = (spec.measures || []).map((m, i) => measureRows(dataset, measures.list[i], m, rows));
    return { rows: result, totals, count: rows.length };
  }

  // Sorts groups by key (default) or by the value of a measure, or in an imposed order of labels.
  function sortGroups(groups, sort) {
    const options = sort || { by: `key`, dir: `asc` };
    const sign = options.dir === `desc` ? -1 : 1;
    const out = groups.slice();
    if (Array.isArray(options.order) && options.order.length) {
      const rank = (label) => {
        const index = options.order.indexOf(label);
        return index < 0 ? options.order.length : index;
      };
      return out.sort((a, b) => rank(a.keys[0]) - rank(b.keys[0]) || compareLabels(a.keys.join(` `), b.keys.join(` `)));
    }
    if (options.by === `value`) {
      const at = options.measure || 0;
      const num = (g) => (g.values[at] === null ? -Infinity : g.values[at]);
      return out.sort((a, b) => sign * (num(a) - num(b)) || compareLabels(a.keys.join(` `), b.keys.join(` `)));
    }
    return out.sort((a, b) => sign * compareLabels(a.keys.join(` `), b.keys.join(` `)));
  }

  // Keeps the first `top.count` groups and merges the others into one group named `otherLabel`.
  function keepTop(dataset, rows, groups, spec, resolvedGroups, resolvedMeasures) {
    const kept = groups.slice(0, spec.top.count);
    const keptIds = new Set(kept.map((g) => g.id));
    const others = rows.filter((row) => {
      const id = JSON.stringify(resolvedGroups.list.map((r, i) => keyOf(dataset, r, row, spec.groupBy[i].bucket, spec.groupBy[i].merge).id));
      return !keptIds.has(id);
    });
    if (!others.length) return kept;
    const label = spec.top.otherLabel || `Other`;
    kept.push({
      id: `others`, keys: spec.groupBy.map((_, i) => (i === 0 ? label : ``)), count: others.length,
      values: spec.measures.map((m, i) => measureRows(dataset, resolvedMeasures.list[i], m, others))
    });
    return kept;
  }

  // Cross table: the keys of `rowPath` down the side, the keys of `colPath` along the top, one
  // measure in each cell. Returns { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } where
  // totals are the measure applied to all the rows of a line, of a column and of the table.
  function crossTable(dataset, tableId, rows, spec) {
    const resolved = resolveAll(dataset, tableId, [spec.rowPath, spec.colPath], (p) => p);
    if (resolved.error) return { error: resolved.error };
    const measures = resolveAll(dataset, tableId, [spec.measure], (m) => m.path);
    if (measures.error) return { error: measures.error };
    const empty = spec.emptyLabel || ``;
    const cellRows = new Map();
    const rowRows = new Map();
    const colRows = new Map();
    const push = (map, id, label, row) => {
      if (!map.has(id)) map.set(id, { label, rows: [] });
      map.get(id).rows.push(row);
    };
    for (const row of rows) {
      const rowKey = keyOf(dataset, resolved.list[0], row, spec.rowBucket, spec.rowMerge);
      const colKey = keyOf(dataset, resolved.list[1], row, spec.colBucket, spec.colMerge);
      push(cellRows, JSON.stringify([rowKey.id, colKey.id]), ``, row);
      push(rowRows, rowKey.id, rowKey.label || empty, row);
      push(colRows, colKey.id, colKey.label || empty, row);
    }
    const rank = (imposed, label) => {
      const index = Array.isArray(imposed) ? imposed.indexOf(label) : -1;
      return index < 0 ? (Array.isArray(imposed) ? imposed.length : 0) : index;
    };
    const order = (map, imposed) => [...map.entries()].sort((a, b) => rank(imposed, a[1].label) - rank(imposed, b[1].label) || compareLabels(a[1].label, b[1].label));
    const rowList = order(rowRows, spec.rowOrder);
    const colList = order(colRows, spec.colOrder);
    const rowKeys = rowList.map(([, entry]) => entry.label);
    const colKeys = colList.map(([, entry]) => entry.label);
    const apply = (list) => measureRows(dataset, measures.list[0], spec.measure, list);
    const cells = rowList.map(([r]) => colList.map(([c]) => (cellRows.has(JSON.stringify([r, c])) ? apply(cellRows.get(JSON.stringify([r, c])).rows) : null)));
    return {
      rowKeys, colKeys, cells, count: rows.length,
      rowTotals: rowList.map(([, entry]) => apply(entry.rows)), colTotals: colList.map(([, entry]) => apply(entry.rows)), grandTotal: apply(rows)
    };
  }

  // Splits the columns of a cross table into slices of at most `size` columns (the "number of
  // columns" of a table block). Returns a list of { colKeys, cells, colTotals }; an empty table gives one
  // empty slice so that the headings are still drawn.
  function sliceColumns(cross, size) {
    const width = Math.max(1, Math.floor(size) || cross.colKeys.length || 1);
    const slices = [];
    for (let start = 0; start < Math.max(cross.colKeys.length, 1); start += width) {
      slices.push({
        colKeys: cross.colKeys.slice(start, start + width), colTotals: cross.colTotals.slice(start, start + width),
        cells: cross.cells.map((line) => line.slice(start, start + width))
      });
    }
    return slices;
  }

  const api = { FUNCTIONS, summarize, compareLabels, groupRows, crossTable, sliceColumns };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbAggregate = api;
})(typeof window !== `undefined` ? window : globalThis);
