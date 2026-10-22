// Finds the rows of a table that belong to the selected row of the linked table, by following a
// chain of references upwards, and keeps only the rows that pass the filters of a block.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const values = typeof require !== `undefined` ? require(`./values.js`) : root.exportTdbValues;

  // Rows (indexes) of the first table of `chain` that belong to the row `selectedId` of the last one.
  // `chain` is a path from findDescendants (schema.js): a list of steps { from, column, to } that goes
  // from the table of the block up to the linked table. A step passes when the column of a row
  // points to a row that was reached by the next step.
  function rowsInContext(dataset, chain, selectedId) {
    let reached = new Set([selectedId]);
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const step = chain[i];
      const inverse = dataset.inverseIndex(step.from, step.column);
      const next = new Set();
      for (const id of reached) {
        const rows = inverse.get(id);
        if (!rows) continue;
        const table = dataset.table(step.from);
        for (const row of rows) next.add(table.ids[row]);
      }
      reached = next;
    }
    const first = dataset.table(chain[0].from);
    return [...reached].map((id) => first.rowOfId(id)).filter((row) => row >= 0).sort((a, b) => a - b);
  }

  // Every row of a table (a block that uses the whole table, with no link to the selected row).
  function allRows(dataset, tableId) {
    const table = dataset.table(tableId);
    return table ? Array.from({ length: table.count }, (_, index) => index) : [];
  }

  // Operators of a filter that compare two values.
  const COMPARE = {
    eq: (a, b) => a === b, ne: (a, b) => a !== b,
    gt: (a, b) => a !== null && b !== null && a > b, ge: (a, b) => a !== null && b !== null && a >= b,
    lt: (a, b) => a !== null && b !== null && a < b, le: (a, b) => a !== null && b !== null && a <= b
  };

  // Value that a filter compares with. `source` is { kind: `const`, value }, { kind: `field`, path } (a
  // column of the selected row of the linked table) or { kind: `id` } (the number of the selected row).
  function targetValue(source, context) {
    if (!source) return null;
    if (source.kind === `const`) return source.value === undefined ? null : source.value;
    if (source.kind === `id`) return context.selectedId;
    if (source.kind === `field`) {
      const resolved = context.dataset.resolvePath(context.linked, source.path);
      if (resolved.error) return null;
      return context.dataset.valueAt(resolved, context.dataset.table(context.linked).rowOfId(context.selectedId));
    }
    return null;
  }

  // A value made comparable: a number stays a number, a boolean stays one, anything else is text.
  function comparable(raw, label) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === `number` || typeof raw === `boolean`) return raw;
    return values.toText(raw, label);
  }

  // Keeps the rows that pass every filter (they are combined with AND). A filter is
  // { path, op, value }. `op` is eq, ne, gt, ge, lt, le, in, contains, empty, notEmpty, true or false.
  // `context` is { dataset, linked, selectedId }. Returns { rows, errors } where errors lists the
  // filters that could not be read (the block then keeps all rows for them and says so).
  function applyFilters(rows, tableId, filters, context) {
    const errors = [];
    let kept = rows;
    for (const filter of filters || []) {
      const resolved = context.dataset.resolvePath(tableId, filter.path);
      if (resolved.error) {
        errors.push(`${filter.path}: ${resolved.error}`);
        continue;
      }
      const column = resolved.column;
      const read = (row) => comparable(context.dataset.valueAt(resolved, row), null);
      const type = column.type;
      if (filter.op === `empty`) kept = kept.filter((row) => values.isEmpty(context.dataset.valueAt(resolved, row), type));
      else if (filter.op === `notEmpty`) kept = kept.filter((row) => !values.isEmpty(context.dataset.valueAt(resolved, row), type));
      else if (filter.op === `true`) kept = kept.filter((row) => context.dataset.valueAt(resolved, row) === true);
      else if (filter.op === `false`) kept = kept.filter((row) => context.dataset.valueAt(resolved, row) !== true);
      else if (filter.op === `in`) {
        const wanted = new Set((filter.value && Array.isArray(filter.value.values) ? filter.value.values : []).map((item) => String(item)));
        kept = kept.filter((row) => wanted.has(column.kind === `ref` ? context.dataset.textAt(resolved, row) : String(read(row))));
      } else if (filter.op === `contains`) {
        const needle = String(targetValue(filter.value, context) || ``).toLowerCase();
        kept = kept.filter((row) => context.dataset.textAt(resolved, row).toLowerCase().includes(needle));
      } else if (COMPARE[filter.op]) {
        const target = comparable(targetValue(filter.value, context), null);
        const compare = COMPARE[filter.op];
        const useLabel = column.kind === `ref` && typeof target === `string`;
        kept = kept.filter((row) => compare(useLabel ? context.dataset.textAt(resolved, row) : read(row), target));
      } else errors.push(`${filter.path}: unknown operator ${filter.op}`);
    }
    return { rows: kept, errors };
  }

  const api = { rowsInContext, allRows, applyFilters };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbRowset = api;
})(typeof window !== `undefined` ? window : globalThis);
