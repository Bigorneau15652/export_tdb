// The cells of a record block (the identity band of a sheet): for the row selected in Grist, a list of
// information, each one a label and a value read in a column of that row or of a table that it points to
// (`Reference.Column`). Values are given as plain text by fields.js, so a value can never change the layout.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const isNode = typeof module !== `undefined` && module.exports;
  const fields = isNode ? require(`./fields.js`) : root.exportTdbFields;

  // The label of an information: the label typed by the user, otherwise the label of the last column of
  // its path (as Grist shows it), otherwise the path.
  function labelOf(dataset, tableId, item) {
    if (item.label) return item.label;
    const resolved = dataset.resolvePath(tableId, item.path);
    return resolved.error ? item.path : resolved.column.label || resolved.column.id;
  }

  // The cells of a record block for the selected row `record` of the table `linked`. `config.items` is
  // the list of { path, label }. Returns { cells: [{ label, text }], problems } where `problems` lists the
  // paths that could not be read (unknown column or table not loaded yet); their cell is empty.
  function recordCells(schema, dataset, linked, record, config, words) {
    const cells = [];
    const problems = [];
    for (const item of config.items) {
      if (!item.path) continue;
      const result = fields.resolveField(dataset, schema, linked, record, item.path, words);
      if (!result.ok && !problems.includes(item.path)) problems.push(item.path);
      cells.push({ label: labelOf(dataset, linked, item), text: result.ok ? result.text : `` });
    }
    return { cells, problems };
  }

  // The narrowest width, in millimetres, that a cell can have and still be read, for each size of text.
  const MIN_CELL_MM = { small: 26, normal: 30, large: 43 };

  // The most cells that fit on the one line of a block that is `widthMm` wide: at least one.
  function maxCells(widthMm, size) {
    const least = MIN_CELL_MM[size] || MIN_CELL_MM.normal;
    return Math.max(1, Math.floor((Number.isFinite(widthMm) ? widthMm : 0) / least));
  }

  // The paths of the information of a record block, for loading the tables that they cross.
  function recordPaths(config) {
    return config.items.map((item) => item.path).filter(Boolean);
  }

  const api = { MIN_CELL_MM, maxCells, recordCells, recordPaths };
  if (isNode) module.exports = api;
  else root.exportTdbRecord = api;
})(typeof window !== `undefined` ? window : globalThis);
