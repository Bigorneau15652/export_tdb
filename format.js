// Writes numbers, percentages and dates the French way, the same in every browser: a narrow space
// between thousands, a comma for decimals, `dd/mm/yyyy` for dates. This file has no access to the
// page or to Grist: it is pure logic, tested with Node.
(function (root) {
  const THOUSANDS = ` `;
  const NO_BREAK = ` `;
  const DASH = `—`;

  // A number as a text. `decimals` is the number of decimals; without it a number keeps up to two
  // decimals and loses the zeros at the end. Not a number gives a dash.
  function formatNumber(value, decimals) {
    if (typeof value !== `number` || !Number.isFinite(value)) return DASH;
    const fixed = decimals === undefined || decimals === null ? Math.abs(value).toFixed(2).replace(/\.?0+$/, ``) : Math.abs(value).toFixed(Math.max(0, Math.min(10, decimals)));
    const [whole, fraction] = fixed.split(`.`);
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS);
    const sign = value < 0 && Number(fixed) !== 0 ? `-` : ``;
    return `${sign}${grouped}${fraction ? `,${fraction}` : ``}`;
  }

  // A ratio as a percentage: 0.777 gives `77,7 %`.
  function formatPercent(ratio, decimals) {
    if (typeof ratio !== `number` || !Number.isFinite(ratio)) return DASH;
    return `${formatNumber(ratio * 100, decimals === undefined ? 1 : decimals)}${NO_BREAK}%`;
  }

  // A date given as a number of seconds since 1970 (UTC) as `dd/mm/yyyy`; anything else gives a dash.
  function formatDate(seconds) {
    if (typeof seconds !== `number` || !Number.isFinite(seconds)) return DASH;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return DASH;
    const day = String(date.getUTCDate()).padStart(2, `0`);
    const month = String(date.getUTCMonth() + 1).padStart(2, `0`);
    return `${day}/${month}/${date.getUTCFullYear()}`;
  }

  const api = { formatNumber, formatPercent, formatDate, DASH };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbFormat = api;
})(typeof window !== `undefined` ? window : globalThis);
