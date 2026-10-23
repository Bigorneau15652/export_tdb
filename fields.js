// Fields of a text: `{Column}` or `{Reference.Column}` are replaced by the value of the selected row.
// Fields are replaced only inside the plain text of the Markdown tree, never before reading the
// Markdown, so a value that contains Markdown signs can never change the layout or make a link. This
// file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const isNode = typeof module !== `undefined` && module.exports;
  const values = isNode ? require(`./values.js`) : root.exportTdbValues;
  const format = isNode ? require(`./format.js`) : root.exportTdbFormat;

  const FIELD = /\{([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\}/g;
  const MAX_PATH_PARTS = 4;
  const LABEL_DEPTH = 3;

  // The distinct paths written between braces in a text, in order of appearance.
  function extractFields(text) {
    const found = [];
    for (const match of String(text || ``).matchAll(FIELD)) {
      if (!found.includes(match[1]) && match[1].split(`.`).length <= MAX_PATH_PARTS) found.push(match[1]);
    }
    return found;
  }

  // The columns of a table that can be put in a text: its own columns and, for each reference column,
  // the columns of the table it points to, written `Reference.Column`. Returns [{ path, label, base }].
  function fieldChoices(schema, tableId) {
    const table = schema.tables.get(tableId);
    const out = [];
    if (!table) return out;
    for (const column of table.columns) {
      if (column.kind === `attachments`) continue;
      out.push({ path: column.id, label: column.id, base: column.base });
      if (column.kind === `ref` && schema.tables.has(column.target)) {
        for (const inner of schema.tables.get(column.target).columns) {
          if (inner.kind === `reflist` || inner.kind === `attachments`) continue;
          out.push({ path: `${column.id}.${inner.id}`, label: `${column.id} > ${inner.id}`, base: inner.base });
        }
      }
    }
    return out;
  }

  // The choices of `fieldChoices` in the order of the menus: first the own columns of the table in
  // alphabetical order, then the columns of the linked tables (`Reference > Column`), also in
  // alphabetical order. Numbers inside names are compared as numbers.
  function sortChoices(choices) {
    const compare = (a, b) => a.label.localeCompare(b.label, `fr`, { numeric: true, sensitivity: `base` });
    const own = choices.filter((choice) => !choice.path.includes(`.`)).sort(compare);
    const linked = choices.filter((choice) => choice.path.includes(`.`)).sort(compare);
    return [...own, ...linked];
  }

  // The reference column `column` and the tables that its label needs: the table it points to and,
  // when the column shown there is itself a reference, the table of that one, a few levels deep.
  function labelTables(schema, column, found) {
    let current = column;
    for (let depth = 0; depth < LABEL_DEPTH && current && (current.kind === `ref` || current.kind === `reflist`); depth += 1) {
      found.add(current.target);
      const target = schema.tables.get(current.target);
      current = target && current.visibleCol ? target.columns.find((c) => c.id === current.visibleCol) : null;
    }
  }

  // Names of the tables that are needed to write the fields `paths` for a row of `tableId`: the table
  // itself (the row is read there when Grist does not give its values), the tables crossed by the
  // paths and the tables that give the labels of references.
  function tablesForPaths(schema, tableId, paths) {
    const found = new Set();
    if (paths.length && schema.tables.has(tableId)) found.add(tableId);
    for (const path of paths) {
      let currentId = tableId;
      for (const part of path.split(`.`)) {
        const table = schema.tables.get(currentId);
        const column = table ? table.columns.find((c) => c.id === part) : null;
        if (!column) break;
        if (column.kind === `ref` || column.kind === `reflist`) {
          labelTables(schema, column, found);
          currentId = column.target;
        }
      }
    }
    return [...found];
  }

  // A value of a column as a text for a sentence or a cell: numbers of Numeric columns and dates the
  // French way (with `decimals` decimals when it is 0 or more), references by their label, lists by
  // their items, booleans as yes or no.
  function formatValue(column, raw, dataset, words, decimals) {
    if (raw === null || raw === undefined) return ``;
    if (column.kind === `ref`) return dataset.refLabel(column, raw);
    if (column.kind === `reflist`) return values.listItems(raw).map((id) => dataset.refLabel(column, id)).filter(Boolean).join(`, `);
    if (values.isUnusable(raw)) return ``;
    if (column.base === `Numeric`) {
      const number = values.toNumber(raw);
      return number === null ? `` : format.formatNumber(number, decimals >= 0 ? decimals : undefined);
    }
    if (column.base === `Date` || column.base === `DateTime`) {
      const seconds = values.toSeconds(raw);
      return seconds === null ? `` : format.formatDate(seconds);
    }
    if (column.base === `Bool`) return typeof raw === `boolean` ? (raw ? words.yes : words.no) : ``;
    return values.toText(raw);
  }

  // The type of JavaScript value that a live value of a plain column must have to be trusted.
  const LIVE_TYPES = { Text: `string`, Choice: `string`, Numeric: `number`, Int: `number`, Bool: `boolean` };

  // The raw value of a column of the selected row. The value that Grist gives with the selected row
  // (the `record`) is used when it has the expected type, because it is always up to date. Otherwise
  // (a column that Grist did not send, a reference sent as a label, a date sent as an object) the
  // value is read in the loaded table, which holds the raw values. Returns { found, raw }; `found` is
  // false when the table of the row is not loaded and the live value cannot be trusted.
  function rawValue(dataset, table, record, column) {
    const live = record[column.id];
    if (column.kind === `plain` && LIVE_TYPES[column.base] && typeof live === LIVE_TYPES[column.base]) return { found: true, raw: live };
    const loaded = dataset.table(table.id);
    const index = loaded ? loaded.rowOfId(record.id) : -1;
    if (index >= 0 && loaded.column(column.id)) {
      const stored = loaded.column(column.id)[index];
      return { found: true, raw: stored === undefined ? null : stored };
    }
    return { found: false, raw: null };
  }

  // The text of one field for the selected row `record` of the table `tableId`. The first column is
  // read in the record or in the loaded table (see rawValue), the following ones in the loaded tables. Returns
  // { ok: true, text } or { ok: false, reason } (`unknown` column, `notloaded` table, `norow`).
  function resolveFieldFull(dataset, schema, tableId, record, path, words) {
    const parts = String(path).split(`.`);
    const table = schema.tables.get(tableId);
    const column = table ? table.columns.find((c) => c.id === parts[0]) : null;
    if (!column || !record) return { ok: false, reason: `unknown` };
    const cell = rawValue(dataset, table, record, column);
    if (!cell.found) return { ok: false, reason: `notloaded` };
    const raw = cell.raw;
    if (parts.length === 1) return { ok: true, text: formatValue(column, raw, dataset, words), raw, column };
    if (column.kind !== `ref`) return { ok: false, reason: `unknown` };
    if (!raw) return { ok: true, text: `` };
    const target = dataset.table(column.target);
    if (!target) return { ok: false, reason: `notloaded` };
    const index = target.rowOfId(raw);
    if (index < 0) return { ok: true, text: `` };
    const resolved = dataset.resolvePath(column.target, parts.slice(1).join(`.`));
    if (resolved.error) return { ok: false, reason: resolved.error.includes(`not loaded`) ? `notloaded` : `unknown` };
    const last = dataset.valueAt(resolved, index);
    return { ok: true, text: formatValue(resolved.column, last, dataset, words), raw: last, column: resolved.column };
  }

  // The same as resolveFieldFull for the callers that only need the text: { ok: true, text } or { ok: false, reason }.
  function resolveField(dataset, schema, tableId, record, path, words) {
    const read = resolveFieldFull(dataset, schema, tableId, record, path, words);
    return read.ok ? { ok: true, text: read.text } : read;
  }

  // Replaces the fields in the plain text nodes of a tree of Markdown nodes. `resolve(path)` gives
  // { ok, text }. A field that cannot be read stays written as it is. Returns { nodes, problems }
  // where `problems` lists the paths that could not be read.
  function expandFields(nodes, resolve) {
    const problems = [];
    const walk = (list) => list.map((node) => {
      if (node.type === `text`) {
        const value = node.value.replace(FIELD, (whole, path) => {
          const result = resolve(path);
          if (result.ok) return result.text;
          if (!problems.includes(path)) problems.push(path);
          return whole;
        });
        return { type: `text`, value };
      }
      if (node.children) return { ...node, children: walk(node.children) };
      if (node.items) return { ...node, items: node.items.map(walk) };
      return node;
    });
    return { nodes: walk(nodes), problems };
  }

  const api = { extractFields, fieldChoices, sortChoices, tablesForPaths, formatValue, resolveField, resolveFieldFull, expandFields };
  if (isNode) module.exports = api;
  else root.exportTdbFields = api;
})(typeof window !== `undefined` ? window : globalThis);
