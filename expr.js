// Calculates the named values and the ratios of the indicators: numbers, names between braces, the
// four operations, parentheses and the minus sign. It is a small parser written for the widget: the
// text is never run as code. This file has no access to the page or to Grist: it is pure logic.
(function (root) {
  const MAX_LENGTH = 500;
  const MAX_DEPTH = 40;

  // Cuts a text into tokens: { type: number | name | op | open | close, value }.
  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === ` ` || ch === `\t` || ch === `\n`) {
        i += 1;
      } else if (/[0-9]/.test(ch) || (ch === `.` && /[0-9]/.test(text[i + 1] || ``))) {
        const match = /^[0-9]*[.,]?[0-9]+|^[0-9]+/.exec(text.slice(i));
        tokens.push({ type: `number`, value: Number(match[0].replace(`,`, `.`)) });
        i += match[0].length;
      } else if (ch === `{`) {
        const end = text.indexOf(`}`, i);
        if (end < 0) return { error: `a name is not closed` };
        const name = text.slice(i + 1, end).trim();
        if (!name) return { error: `a name is empty` };
        tokens.push({ type: `name`, value: name });
        i = end + 1;
      } else if (`+-*/`.includes(ch)) {
        tokens.push({ type: `op`, value: ch });
        i += 1;
      } else if (ch === `(`) {
        tokens.push({ type: `open` });
        i += 1;
      } else if (ch === `)`) {
        tokens.push({ type: `close` });
        i += 1;
      } else {
        return { error: `unexpected character ${ch}` };
      }
    }
    return { tokens };
  }

  // Reads an expression. Returns { ast, names } (names: the names used) or { error }.
  function parseExpression(text) {
    const source = String(text === null || text === undefined ? `` : text);
    if (!source.trim()) return { error: `empty expression` };
    if (source.length > MAX_LENGTH) return { error: `expression too long` };
    const lexed = tokenize(source);
    if (lexed.error) return { error: lexed.error };
    const tokens = lexed.tokens;
    const names = new Set();
    let position = 0;

    const parseExpr = (depth) => {
      if (depth > MAX_DEPTH) throw new Error(`expression too deep`);
      let left = parseTerm(depth);
      while (tokens[position] && tokens[position].type === `op` && `+-`.includes(tokens[position].value)) {
        const op = tokens[position].value;
        position += 1;
        left = { op, left, right: parseTerm(depth) };
      }
      return left;
    };
    const parseTerm = (depth) => {
      let left = parseUnary(depth);
      while (tokens[position] && tokens[position].type === `op` && `*/`.includes(tokens[position].value)) {
        const op = tokens[position].value;
        position += 1;
        left = { op, left, right: parseUnary(depth) };
      }
      return left;
    };
    const parseUnary = (depth) => {
      const token = tokens[position];
      if (token && token.type === `op` && token.value === `-`) {
        position += 1;
        return { op: `neg`, value: parseUnary(depth + 1) };
      }
      return parsePrimary(depth);
    };
    const parsePrimary = (depth) => {
      const token = tokens[position];
      if (!token) throw new Error(`the expression ends too early`);
      position += 1;
      if (token.type === `number`) return { number: token.value };
      if (token.type === `name`) {
        names.add(token.value);
        return { name: token.value };
      }
      if (token.type === `open`) {
        const inner = parseExpr(depth + 1);
        if (!tokens[position] || tokens[position].type !== `close`) throw new Error(`a parenthesis is not closed`);
        position += 1;
        return inner;
      }
      throw new Error(`unexpected symbol`);
    };

    try {
      const ast = parseExpr(0);
      if (position < tokens.length) return { error: `unexpected symbol` };
      return { ast, names: [...names] };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Value of an expression. `lookup(name)` gives a number or null. A missing value or a division by
  // zero gives null: the result is then shown as a dash, never as 0.
  function evaluate(ast, lookup) {
    if (ast.number !== undefined) return ast.number;
    if (ast.name !== undefined) {
      const value = lookup(ast.name);
      return typeof value === `number` && Number.isFinite(value) ? value : null;
    }
    if (ast.op === `neg`) {
      const inner = evaluate(ast.value, lookup);
      return inner === null ? null : -inner;
    }
    const left = evaluate(ast.left, lookup);
    const right = evaluate(ast.right, lookup);
    if (left === null || right === null) return null;
    let result;
    if (ast.op === `+`) result = left + right;
    else if (ast.op === `-`) result = left - right;
    else if (ast.op === `*`) result = left * right;
    else result = right === 0 ? null : left / right;
    return result !== null && Number.isFinite(result) ? result : null;
  }

  const api = { parseExpression, evaluate };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbExpr = api;
})(typeof window !== `undefined` ? window : globalThis);
