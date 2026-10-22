// Keeps the tables of the document in memory, in columns, and answers the questions that the
// dashboard blocks ask: the value of a column at a row, possibly through references (a path such as
// `Building.Site.Name`), the text shown for a reference, and the rows that point to a given row.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const values = typeof require !== `undefined` ? require(`./values.js`) : root.exportTdbValues;

  // A reference to a reference to ... is followed at most this many times when looking for a label.
  const MAX_LABEL_DEPTH = 3;

  // `schema` comes from buildSchema (schema.js). `fetched` is a Map or an object that gives, for a
  // table name, the table as fetchTable returns it: { id: [...], Column: [...], ... }.
  function createDataset(schema, fetched) {
    const get = (id) => (fetched instanceof Map ? fetched.get(id) : fetched[id]);
    const tables = new Map();
    const inverses = new Map();

    // The table `id` in memory, or null when it was not loaded.
    function table(id) {
      if (tables.has(id)) return tables.get(id);
      const data = get(id);
      const meta = schema.tables.get(id);
      if (!data || !meta) return null;
      const ids = data.id || [];
      const rowOf = new Map();
      ids.forEach((rowId, index) => rowOf.set(rowId, index));
      const loaded = {
        id, meta, ids, count: ids.length,
        column: (name) => data[name] || null,
        rowOfId: (rowId) => (rowOf.has(rowId) ? rowOf.get(rowId) : -1),
        columnMeta: (name) => meta.columns.find((c) => c.id === name) || null
      };
      tables.set(id, loaded);
      return loaded;
    }

    // Text shown for the row `rowId` of the table that the reference column `column` points to: the
    // value of the column that Grist shows for it, or the row number when there is none.
    function refLabel(column, rowId, depth = 0) {
      const target = table(column.target);
      if (!target || !rowId) return ``;
      const index = target.rowOfId(rowId);
      if (index < 0) return ``;
      const visible = column.visibleCol ? target.columnMeta(column.visibleCol) : null;
      const raw = visible && target.column(visible.id) ? target.column(visible.id)[index] : null;
      if (!visible) return String(rowId);
      if (visible.kind === `ref` && depth < MAX_LABEL_DEPTH) return refLabel(visible, raw, depth + 1);
      return values.toText(raw);
    }

    // Reads a path such as `Building.Site.Name` for a table. Every part but the last must be a
    // reference column. Returns { steps, column, table } or { error } with a message.
    function resolvePath(tableId, path) {
      const parts = String(path || ``).split(`.`).filter(Boolean);
      if (!parts.length) return { error: `empty path` };
      let currentId = tableId;
      const steps = [];
      for (let i = 0; i < parts.length; i += 1) {
        const current = table(currentId);
        if (!current) return { error: `table ${currentId} is not loaded` };
        const column = current.columnMeta(parts[i]);
        if (!column || !current.column(column.id)) return { error: `column ${parts[i]} not found in ${currentId}` };
        steps.push({ table: currentId, column });
        if (i === parts.length - 1) return { steps, column, table: currentId };
        if (column.kind !== `ref`) return { error: `${parts[i]} in ${currentId} is not a reference` };
        currentId = column.target;
      }
      return { error: `empty path` };
    }

    // Raw value of a resolved path at the row index `rowIndex` of its first table; null when a
    // reference on the way is empty or broken.
    function valueAt(resolved, rowIndex) {
      let index = rowIndex;
      for (let i = 0; i < resolved.steps.length; i += 1) {
        const step = resolved.steps[i];
        const raw = table(step.table).column(step.column.id)[index];
        if (i === resolved.steps.length - 1) return raw === undefined ? null : raw;
        if (!raw) return null;
        index = table(step.column.target).rowOfId(raw);
        if (index < 0) return null;
      }
      return null;
    }

    // Text of a resolved path at a row: references show their label, lists their items.
    function textAt(resolved, rowIndex) {
      const raw = valueAt(resolved, rowIndex);
      const column = resolved.column;
      if (column.kind === `ref`) return refLabel(column, raw);
      if (column.kind === `reflist`) return values.listItems(raw).map((id) => refLabel(column, id)).filter(Boolean).join(`, `);
      return values.toText(raw);
    }

    // For the column `columnId` of a table that holds references (single or list), the map from the
    // number of a referenced row to the indexes of the rows that point to it. Built once.
    function inverseIndex(tableId, columnId) {
      const key = `${tableId}.${columnId}`;
      if (inverses.has(key)) return inverses.get(key);
      const current = table(tableId);
      const index = new Map();
      const column = current ? current.column(columnId) : null;
      const meta = current ? current.columnMeta(columnId) : null;
      if (column && meta) {
        column.forEach((raw, row) => {
          const targets = meta.kind === `reflist` ? values.listItems(raw) : [raw];
          for (const target of targets) {
            if (!Number.isInteger(target) || target <= 0) continue;
            if (!index.has(target)) index.set(target, []);
            const rows = index.get(target);
            if (rows[rows.length - 1] !== row) rows.push(row);
          }
        });
      }
      inverses.set(key, index);
      return index;
    }

    return { table, refLabel, resolvePath, valueAt, textAt, inverseIndex };
  }

  const api = { createDataset };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbDataset = api;
})(typeof window !== `undefined` ? window : globalThis);
