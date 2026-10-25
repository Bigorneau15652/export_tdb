// Builds the text report of the explorer: what the widget found in the document and what the
// tests of the Grist API answered. The report is meant to be copied and sent to the developer.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  // Report text. `data` is { version, reveal, linked, record, tables, descendants, shapes, tests, events } and, when the
  // dashboard is described, `dashboard`: { format, orientation, margin, pages, numbers, footer, blocks: [{ type, page }],
  // values, bytes, editing, locked }.
  function buildReport(data) {
    const lines = [];
    const add = (text = ``) => lines.push(text);
    add(`export_tdb report ${data.version}`);
    add(`Values shown: ${data.reveal ? `yes` : `no (shapes only)`}`);
    add();
    add(`1. Linked table`);
    add(`Table: ${data.linked || `unknown`}`);
    add(`Selected row id: ${data.record === null ? `none` : `a row (id of kind ${typeof data.record})`}`);
    add(`Rows seen while moving in the table: ${data.events}`);
    add();
    add(`2. Tables of the document (${data.tables.length})`);
    for (const table of data.tables) {
      const refs = table.columns.filter((c) => c.kind === `ref` || c.kind === `reflist`).map((c) => `${c.id}:${c.type}`);
      add(`${table.id}: ${table.columns.length} columns${table.summary ? `, summary table` : ``}${refs.length ? `; references ${refs.join(`, `)}` : ``}`);
    }
    add();
    add(`3. Tables that descend from the linked table (${data.descendants.length})`);
    for (const entry of data.descendants) {
      add(`${entry.table}: ${entry.paths.length} path(s), shortest ${entry.paths[0].map((s) => `${s.from}.${s.column}${s.list ? ` (list)` : ``}`).join(` > `)} > ${entry.paths[0][entry.paths[0].length - 1].to}`);
    }
    add();
    add(`4. Shape of the values (table, column, type, shape of the first filled value, filled/empty)`);
    for (const row of data.shapes) add(`${row.table}.${row.column} [${row.type}] ${row.shape} (${row.filled}/${row.empty})`);
    add();
    add(`5. Loading times`);
    for (const row of data.timings) add(`${row.table}: ${row.rows} rows, ${row.columns} columns, ${Math.round(row.ms)} ms${row.manualSort === undefined ? `` : `, manual order column ${row.manualSort ? `present` : `absent`}`}`);
    add();
    add(`6. Tests of the API`);
    for (const test of data.tests) add(`${test.name}: ${test.ok ? `OK` : `FAILED`}${test.detail ? ` - ${test.detail}` : ``}`);
    add();
    add(`7. Values that Grist gave with the selected row (column, type, shape)`);
    for (const row of data.recordShapes || []) add(`${row.column} [${row.type}] ${row.shape}`);
    if (data.dashboard) {
      const board = data.dashboard;
      add();
      add(`8. Dashboard`);
      add(`Page: ${board.format}, ${board.orientation}, margin ${board.margin} mm, ${board.pages} page(s), numbers ${board.numbers ? `on` : `off`}, footer ${board.footer ? `set` : `empty`}`);
      add(`Blocks: ${board.blocks.length}${board.blocks.length ? ` (${board.blocks.map((block) => `${block.type} p${block.page + 1}`).join(`, `)})` : ``}`);
      add(`Named values: ${board.values}`);
      add(`Saved size: ${board.bytes} bytes`);
      add(`Mode: ${board.editing ? `editing` : `reading`}${board.locked ? `, locked (model not readable)` : ``}`);
    }
    return lines.join(`\n`);
  }

  const api = { buildReport };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbReport = api;
})(typeof window !== `undefined` ? window : globalThis);
