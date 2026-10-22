// Describes the shape of a value read from Grist (its kind, not its content) so that a report can
// show how Grist encodes lists, dates or references without revealing the data of the document.
// This file has no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const MAX_ITEMS = 6;
  // Grist marks encoded values with a short first item (`L` for a list, `d` for a date...).
  const MARKER = /^[A-Za-z]{1,2}$/;

  // Short text that describes `value`. With `reveal` true the numbers and texts are shown too.
  function describeValue(value, reveal) {
    if (value === null) return `null`;
    if (value === undefined) return `undefined`;
    if (typeof value === `boolean`) return reveal ? `boolean ${value}` : `boolean`;
    if (typeof value === `number`) {
      const kind = Number.isInteger(value) ? `integer` : `decimal`;
      return reveal ? `${kind} ${value}` : kind;
    }
    if (typeof value === `string`) return reveal ? `text ${JSON.stringify(value.slice(0, 40))}` : `text(${value.length})`;
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ITEMS).map((item, index) =>
        index === 0 && typeof item === `string` && MARKER.test(item) ? JSON.stringify(item) : describeValue(item, reveal));
      const more = value.length > MAX_ITEMS ? `, ...+${value.length - MAX_ITEMS}` : ``;
      return `[${items.join(`, `)}${more}]`;
    }
    if (typeof value === `object`) return `{${Object.keys(value).slice(0, MAX_ITEMS).join(`, `)}}`;
    return typeof value;
  }

  // Shape of the first value of a column that is not empty, with the number of empty values.
  // `values` is the array of the column. Returns { shape, filled, empty }.
  function describeColumn(values, reveal) {
    let filled = 0;
    let shape = ``;
    for (const value of values || []) {
      const emptyList = Array.isArray(value) && value.length <= 1;
      if (value === null || value === undefined || value === `` || value === 0 || value === false || emptyList) continue;
      filled += 1;
      if (!shape) shape = describeValue(value, reveal);
    }
    const total = (values || []).length;
    return { shape: shape || (total ? describeValue(values[0], reveal) : `no rows`), filled, empty: total - filled };
  }

  const api = { describeValue, describeColumn };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbShape = api;
})(typeof window !== `undefined` ? window : globalThis);
