// The named values of a dashboard: a number (and its text) with a name, defined once and used in the texts
// with `{name}` and later in the indicators. A value is a calculation on a table, a column of the selected row
// or an expression of other values. This file has no access to the page or to Grist: it is pure logic, tested
// with Node. Expressions are read by expr.js and never run as code.
(function (root) {
  const isNode = typeof module !== `undefined` && module.exports;
  const expr = isNode ? require(`./expr.js`) : root.exportTdbExpr;
  const query = isNode ? require(`./table-query.js`) : root.exportTdbTableQuery;
  const fields = isNode ? require(`./fields.js`) : root.exportTdbFields;
  const format = isNode ? require(`./format.js`) : root.exportTdbFormat;
  const values = isNode ? require(`./values.js`) : root.exportTdbValues;

  const DASH = `–`;
  const NO_BREAK = ` `;

  // The text of a number with its decimals and its unit, or a dash when there is no number.
  function numberText(number, item) {
    if (typeof number !== `number` || !Number.isFinite(number)) return DASH;
    const text = format.formatNumber(number, item.decimals >= 0 ? item.decimals : undefined);
    return item.unit ? `${text}${NO_BREAK}${item.unit}` : text;
  }

  // The settings of a calculation as the table engine reads them (to know which tables it needs).
  function calcConfig(item) {
    return {
      table: item.table, start: item.start, link: item.link, filters: item.filters, groupBy: [], sort: { by: `none`, column: ``, dir: `asc`, order: [] },
      columns: item.path ? [{ path: item.path, fn: item.fn }] : []
    };
  }

  // Names of the tables that the named values need for the selected row of the table `linked`.
  function tablesForValues(schema, linked, list) {
    const found = new Set();
    const paths = [];
    for (const item of list) {
      if (item.kind === `calc` && item.table && schema.tables.has(item.table)) query.tablesFor(schema, linked, calcConfig(item)).forEach((name) => found.add(name));
      if (item.kind === `field` && item.path) paths.push(item.path);
    }
    fields.tablesForPaths(schema, linked, paths).forEach((name) => found.add(name));
    return [...found];
  }

  // Calculates every named value. Returns { byName: Map(name -> { number, text, error }), list: [...] } with one entry
  // per value in the same order ({ name, number, text, error }). `error` is an empty text when the value is
  // fine, otherwise a short code: `name` (no or wrong name), `duplicate`, `choose`, `notloaded`, `unknown`,
  // `expression`, `unknownName`, `loop` or a reason of the table engine. A value that has an error has the text of a dash.
  function evaluateValues(schema, dataset, linked, record, list, words) {
    const byName = new Map();
    const firstOf = new Map();
    list.forEach((item, index) => {
      if (item.name && !firstOf.has(item.name)) firstOf.set(item.name, index);
    });
    const results = new Array(list.length);
    const state = new Array(list.length).fill(0);

    const resolve = (index) => {
      if (results[index]) return results[index];
      const item = list[index];
      if (!item.name) return (results[index] = { name: ``, number: null, text: DASH, error: `name` });
      if (firstOf.get(item.name) !== index) return (results[index] = { name: item.name, number: null, text: DASH, error: `duplicate` });
      if (state[index] === 1) return { name: item.name, number: null, text: DASH, error: `loop` };
      state[index] = 1;
      let outcome;
      if (item.kind === `calc`) {
        const run = query.runValue(schema, dataset, linked, record, item);
        outcome = run.ok ? { number: run.number, text: numberText(run.number, item), error: `` } : { number: null, text: DASH, error: run.reason };
      } else if (item.kind === `field`) {
        outcome = readField(schema, dataset, linked, record, item, words);
      } else {
        outcome = evaluateExpression(item, (name) => (firstOf.has(name) ? resolve(firstOf.get(name)) : null));
      }
      state[index] = 2;
      return (results[index] = { name: item.name, ...outcome });
    };

    list.forEach((_, index) => resolve(index));
    results.forEach((result) => {
      if (result.name && !byName.has(result.name)) byName.set(result.name, result);
    });
    return { byName, list: results };
  }

  // The value of a column of the selected row (a number when the column holds numbers, always a text).
  function readField(schema, dataset, linked, record, item, words) {
    if (!item.path) return { number: null, text: DASH, error: `choose` };
    if (!record) return { number: null, text: DASH, error: `choose` };
    const read = fields.resolveFieldFull(dataset, schema, linked, record, item.path, words);
    if (!read.ok) return { number: null, text: DASH, error: read.reason === `notloaded` ? `notloaded` : `unknown` };
    const numeric = read.column && read.column.kind === `plain` && [`Numeric`, `Int`].includes(read.column.base);
    const number = numeric ? values.toNumber(read.raw) : null;
    if (numeric) return { number, text: numberText(number, item), error: `` };
    return { number: null, text: read.text === `` ? DASH : read.text, error: `` };
  }

  // The value of an expression of other values. `lookup(name)` gives the result of a value or null.
  function evaluateExpression(item, lookup) {
    const parsed = expr.parseExpression(item.expr);
    if (parsed.error) return { number: null, text: DASH, error: `expression` };
    let error = ``;
    const number = expr.evaluate(parsed.ast, (name) => {
      const found = lookup(name);
      if (!found) {
        error = error || `unknownName`;
        return null;
      }
      if (found.error === `loop`) error = `loop`;
      return found.number;
    });
    if (error) return { number: null, text: DASH, error };
    return { number, text: numberText(number, item), error: `` };
  }

  const api = { DASH, numberText, tablesForValues, evaluateValues };
  if (isNode) module.exports = api;
  else root.exportTdbNamed = api;
})(typeof window !== `undefined` ? window : globalThis);
