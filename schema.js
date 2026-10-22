// Builds a picture of the structure of a Grist document (tables, columns, types, references)
// from the two metadata tables of Grist, and finds the tables that descend from a given table.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  // A table that descends from another one is searched through at most this many references.
  const MAX_DEPTH = 3;
  // A table is reported with at most this many different paths to the starting table.
  const MAX_PATHS = 12;

  // Reads the type text of a column: `Ref:Sites` gives { kind: `ref`, target: `Sites` }.
  function parseType(type) {
    const text = String(type || ``);
    const ref = /^(Ref|RefList):(.+)$/.exec(text);
    if (ref) return { kind: ref[1] === `Ref` ? `ref` : `reflist`, target: ref[2], base: ref[1] };
    const base = text.split(`:`)[0] || `Any`;
    return { kind: base === `Attachments` ? `attachments` : `plain`, target: ``, base };
  }

  // Value at a position of a metadata table given in columns ({ colId: [values] }).
  const cell = (table, name, index) => (table[name] ? table[name][index] : undefined);

  // `tables` and `columns` are the content of `_grist_Tables` and `_grist_Tables_column`, in the
  // column form returned by fetchTable. Returns { tables: Map(tableId -> table), order: [tableId] }.
  // Columns that Grist uses internally (helpers, manual sort) are left out.
  function buildSchema(tables, columns) {
    const byRef = new Map();
    const result = new Map();
    const order = [];
    const ids = (tables && tables.id) || [];
    ids.forEach((id, i) => {
      const tableId = String(cell(tables, `tableId`, i));
      if (tableId.startsWith(`_`)) return;
      const table = { ref: id, id: tableId, columns: [], summary: Boolean(cell(tables, `summarySourceTable`, i)) };
      byRef.set(id, table);
      result.set(tableId, table);
      order.push(tableId);
    });
    const colRefs = new Map();
    const colIds = (columns && columns.id) || [];
    colIds.forEach((id, i) => {
      const table = byRef.get(cell(columns, `parentId`, i));
      const colId = String(cell(columns, `colId`, i));
      if (!table || colId === `manualSort` || colId.startsWith(`gristHelper_`)) return;
      const parsed = parseType(cell(columns, `type`, i));
      const column = {
        ref: id, id: colId, label: String(cell(columns, `label`, i) || colId), type: String(cell(columns, `type`, i) || `Any`),
        kind: parsed.kind, base: parsed.base, target: parsed.target, isFormula: Boolean(cell(columns, `isFormula`, i)),
        visibleRef: cell(columns, `visibleCol`, i) || 0, visibleCol: ``
      };
      table.columns.push(column);
      colRefs.set(id, column);
    });
    // The column that Grist shows for a reference is given by its number: replace it by its name.
    for (const table of result.values()) {
      for (const column of table.columns) {
        const visible = colRefs.get(column.visibleRef);
        column.visibleCol = visible ? visible.id : ``;
      }
    }
    return { tables: result, order };
  }

  // Text of a link, for example `Rooms.Building -> Buildings`.
  function describeStep(step) {
    return `${step.from}.${step.column} -> ${step.to}`;
  }

  // Tables that reach `startId` through references (a column of one table that points to the next).
  // Returns [{ table, paths }] sorted by depth then name; a path is a list of steps from the
  // descendant table up to the start table. A table is never visited twice in one path.
  function findDescendants(schema, startId) {
    const found = new Map();
    // Looks for the tables that point to `currentId`; `trail` holds the tables already on the path.
    function visit(currentId, trail, steps) {
      if (steps.length >= MAX_DEPTH) return;
      for (const tableId of schema.order) {
        const table = schema.tables.get(tableId);
        for (const column of table.columns) {
          if (column.kind === `plain` || column.kind === `attachments` || column.target !== currentId) continue;
          if (trail.includes(tableId) || tableId === startId) continue;
          const path = [{ from: tableId, column: column.id, to: currentId, list: column.kind === `reflist` }, ...steps];
          const entry = found.get(tableId) || { table: tableId, paths: [] };
          if (entry.paths.length < MAX_PATHS) entry.paths.push(path);
          found.set(tableId, entry);
          visit(tableId, [...trail, tableId], path);
        }
      }
    }
    visit(startId, [startId], []);
    return [...found.values()]
      .map((entry) => ({ ...entry, paths: entry.paths.sort((a, b) => a.length - b.length) }))
      .sort((a, b) => a.paths[0].length - b.paths[0].length || a.table.localeCompare(b.table));
  }


  // Tables that the rows of `startId` point to through references (single references only), up to
  // `MAX_DEPTH` links away, with the chain of references to follow. Used to start from a parent of the
  // selected row (for example the building of a selected room). Returns [{ table, steps }] where a step
  // is { from, column, to }; the shortest chains come first.
  function findAncestors(schema, startId, maxDepth = 2) {
    const out = [];
    function walk(currentId, trail, steps) {
      if (steps.length >= maxDepth) return;
      const table = schema.tables.get(currentId);
      if (!table) return;
      for (const column of table.columns) {
        if (column.kind !== `ref` || !schema.tables.has(column.target) || trail.includes(column.target)) continue;
        const next = [...steps, { from: currentId, column: column.id, to: column.target }];
        if (out.length < MAX_PATHS * 4) out.push({ table: column.target, steps: next });
        walk(column.target, [...trail, column.target], next);
      }
    }
    walk(startId, [startId], []);
    return out.sort((a, b) => a.steps.length - b.steps.length || a.table.localeCompare(b.table));
  }

  // How a chain of references can be trusted: `list` when it goes through a list of references, `summary`
  // when it goes through a summary table made by Grist, `direct` otherwise.
  function pathQuality(schema, path) {
    if (path.some((step) => step.list)) return `list`;
    if (path.some((step) => schema.tables.get(step.from) && schema.tables.get(step.from).summary)) return `summary`;
    return `direct`;
  }

  // Sorts the result of findDescendants so that the useful tables come first: those that have a direct
  // chain of single references, then the summary tables, then the tables reached only through lists.
  // Each entry gets a `quality` and its paths are sorted the same way. Returns a new list.
  function rankDescendants(schema, descendants) {
    const order = { direct: 0, summary: 1, list: 2 };
    const ranked = descendants.map((entry) => {
      const paths = entry.paths.slice().sort((a, b) => order[pathQuality(schema, a)] - order[pathQuality(schema, b)] || a.length - b.length);
      return { ...entry, paths, quality: pathQuality(schema, paths[0]) };
    });
    return ranked.sort((a, b) => order[a.quality] - order[b.quality] || a.paths[0].length - b.paths[0].length || a.table.localeCompare(b.table));
  }

  const api = { parseType, buildSchema, findDescendants, findAncestors, pathQuality, rankDescendants, describeStep, MAX_DEPTH };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbSchema = api;
})(typeof window !== `undefined` ? window : globalThis);
