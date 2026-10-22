// Reads the raw values that Grist gives to a widget: plain values, references (a row number, 0 when
// empty), lists (`["L", ...]`) and the other encoded values (dates, errors, objects...). This file has
// no access to the page or to Grist: it is pure logic, tested with Node.
(function (root) {
  // Codes that Grist writes as the first item of an encoded value.
  const LIST = `L`;
  const DATE = `d`;
  const DATETIME = `D`;
  const REFERENCE = `R`;
  const REFERENCE_LIST = `r`;
  const ERROR = `E`;
  const PENDING = `P`;
  const CENSORED = `C`;
  const SKIP = `S`;

  // True when the value is a list that carries the Grist list code (or a plain array).
  function isList(raw) {
    return Array.isArray(raw);
  }

  // Items of a list value without its code: `["L", 3, 4]` gives [3, 4]. Anything else gives [].
  function listItems(raw) {
    if (!isList(raw)) return [];
    return raw[0] === LIST ? raw.slice(1) : raw.slice();
  }

  // True when the value is an encoded error, a pending or a censored value: it cannot be used.
  function isUnusable(raw) {
    return isList(raw) && (raw[0] === ERROR || raw[0] === PENDING || raw[0] === CENSORED);
  }

  // True when a value counts as empty. A reference column is empty at 0, a text column at an empty
  // text, a list column at an empty list. A number, including 0, is never empty in a number column.
  function isEmpty(raw, type) {
    if (raw === null || raw === undefined) return true;
    if (raw === `` && type !== `Any`) return true;
    if (raw === 0 && /^Ref:/.test(String(type || ``))) return true;
    if (isList(raw) && raw[0] === LIST && raw.length === 1) return true;
    if (isList(raw) && raw.length === 0) return true;
    return false;
  }

  // The value as a number, or null when it is not one. A date is the number of seconds since 1970.
  function toNumber(raw) {
    if (typeof raw === `number`) return Number.isFinite(raw) ? raw : null;
    if (isList(raw) && (raw[0] === DATE || raw[0] === DATETIME) && typeof raw[1] === `number`) return raw[1];
    return null;
  }

  // The value as a date (a number of seconds since 1970, in UTC), or null.
  function toSeconds(raw) {
    return toNumber(raw);
  }

  // The value as a text for display or for grouping. A reference is the label given by `label`
  // (a function from a row number to a text); without it the row number is used.
  function toText(raw, label) {
    if (raw === null || raw === undefined) return ``;
    if (typeof raw === `string`) return raw;
    if (typeof raw === `number`) return String(raw);
    if (typeof raw === `boolean`) return raw ? `true` : `false`;
    if (isList(raw)) {
      if (raw[0] === REFERENCE && typeof raw[2] === `number`) return label ? label(raw[2]) : String(raw[2]);
      if (isUnusable(raw)) return ``;
      if (raw[0] === DATE || raw[0] === DATETIME) return String(raw[1]);
      if (raw[0] === SKIP) return ``;
      return listItems(raw).map((item) => toText(item, label)).join(`, `);
    }
    return ``;
  }

  // Description of the kind of a value, for messages: `empty`, `number`, `text`, `boolean`, `list`,
  // `date`, `reference`, `unusable` or `object`.
  function kindOf(raw) {
    if (raw === null || raw === undefined) return `empty`;
    if (typeof raw === `number`) return `number`;
    if (typeof raw === `string`) return `text`;
    if (typeof raw === `boolean`) return `boolean`;
    if (isList(raw)) {
      if (isUnusable(raw)) return `unusable`;
      if (raw[0] === DATE || raw[0] === DATETIME) return `date`;
      if (raw[0] === REFERENCE || raw[0] === REFERENCE_LIST) return `reference`;
      if (raw[0] === `O`) return `object`;
      return `list`;
    }
    return `object`;
  }

  const api = { listItems, isList, isUnusable, isEmpty, toNumber, toSeconds, toText, kindOf };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbValues = api;
})(typeof window !== `undefined` ? window : globalThis);
