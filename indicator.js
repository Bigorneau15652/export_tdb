// The indicator block: a card with a label, a value in bold and a colour that follows thresholds. This file picks
// the colour for a number and names the symbol that tells the state without colour. It has no access to the page or
// to Grist: it is pure logic, tested with Node. The colours are the names of a fixed list, never CSS typed by the user.
(function (root) {
  const COLORS = [`none`, `green`, `orange`, `red`, `blue`, `grey`];
  // A small symbol for each colour, so that the state does not rest on the colour alone (printing in black and white).
  const SYMBOLS = { none: ``, green: `✓`, orange: `!`, red: `✕`, blue: `i`, grey: `` };

  // The colour of an indicator for a number: the colour of the first rule that the number meets, otherwise the
  // default colour. A missing number (a value that cannot be calculated) gets the default colour.
  function pickColor(config, number) {
    if (typeof number !== `number` || !Number.isFinite(number)) return config.base;
    for (const rule of config.rules) {
      if (typeof rule.limit !== `number`) continue;
      if (rule.op === `ge` ? number >= rule.limit : number <= rule.limit) return rule.color;
    }
    return config.base;
  }

  const api = { COLORS, SYMBOLS, pickColor };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbIndicator = api;
})(typeof window !== `undefined` ? window : globalThis);
