// A small and safe reader of Markdown for the text blocks. It understands titles (levels 1 to 3 with
// `#`), paragraphs (a single line break is kept), bulleted and numbered lists, `**bold**`, `*italic*`
// (or `_italic_`) and links `[label](https://address)`. Anything else stays plain text. It never makes
// HTML: it returns a tree of nodes that the page draws with createElement and textContent. Links must
// be https addresses without a user name or password. This file has no access to the page or to
// Grist: it is pure logic, tested with Node.
(function (root) {
  const MAX_TEXT = 20000;
  const MAX_DEPTH = 3;
  const MAX_URL = 2000;
  const HEADING = /^(#{1,3})\s+(.*)$/;
  const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
  const NUMBERED = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/;

  // The address when it is a safe https link, or null. The address is returned in its normal form.
  function safeUrl(address) {
    const text = String(address || ``).trim();
    if (!text || text.length > MAX_URL || !/^https:\/\//i.test(text)) return null;
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== `https:` || !url.hostname || url.username || url.password) return null;
    return url.href;
  }

  // Index of the first closing mark `mark` after `from` in `text`, or -1. A closing mark must follow
  // a character that is not a space, and a backslash protects the character after it.
  function findClose(text, mark, from) {
    for (let i = from; i < text.length; i += 1) {
      if (text[i] === `\\`) {
        i += 1;
        continue;
      }
      if (text.startsWith(mark, i) && i > from && !/\s/.test(text[i - 1])) {
        // In a run of stars the closing mark is the last one, so that `**a *b***` closes both.
        let end = i;
        while (mark === `**` && text[end + 2] === `*`) end += 1;
        return end;
      }
    }
    return -1;
  }

  // Reads a line of text into inline nodes: { type: `text`, value }, { type: `strong`, children },
  // { type: `em`, children } and { type: `link`, href, children }.
  function parseInline(text, depth) {
    const nodes = [];
    let buffer = ``;
    const flush = () => {
      if (buffer) nodes.push({ type: `text`, value: buffer });
      buffer = ``;
    };
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      if (char === `\\` && i + 1 < text.length && /[\\*_\[\]()#{}]/.test(text[i + 1])) {
        buffer += text[i + 1];
        i += 2;
        continue;
      }
      if (depth < MAX_DEPTH && text.startsWith(`**`, i) && !/\s/.test(text[i + 2] || ` `)) {
        const end = findClose(text, `**`, i + 2);
        if (end > 0) {
          flush();
          nodes.push({ type: `strong`, children: parseInline(text.slice(i + 2, end), depth + 1) });
          i = end + 2;
          continue;
        }
      }
      if (depth < MAX_DEPTH && (char === `*` || char === `_`) && !/\s/.test(text[i + 1] || ` `) && (char === `*` || i === 0 || !/\w/.test(text[i - 1]))) {
        const end = findClose(text, char, i + 1);
        if (end > 0 && (char === `*` || !/\w/.test(text[end + 1] || ` `))) {
          flush();
          nodes.push({ type: `em`, children: parseInline(text.slice(i + 1, end), depth + 1) });
          i = end + 1;
          continue;
        }
      }
      if (depth < MAX_DEPTH && char === `[`) {
        const close = text.indexOf(`](`, i + 1);
        const end = close > 0 ? text.indexOf(`)`, close + 2) : -1;
        if (close > 0 && end > 0) {
          const href = safeUrl(text.slice(close + 2, end));
          const label = text.slice(i + 1, close);
          if (href && label.trim()) {
            flush();
            nodes.push({ type: `link`, href, children: parseInline(label, depth + 1) });
            i = end + 1;
            continue;
          }
        }
      }
      buffer += char;
      i += 1;
    }
    flush();
    return nodes;
  }

  // Reads a whole text into blocks: { type: `heading`, level, children }, { type: `paragraph`, children }
  // and { type: `list`, ordered, items: [children] }. A text longer than the limit is cut.
  function parseMarkdown(source) {
    const text = String(source === null || source === undefined ? `` : source).replace(/\r\n?/g, `\n`).slice(0, MAX_TEXT);
    const blocks = [];
    let paragraph = [];
    let list = null;
    const endParagraph = () => {
      if (!paragraph.length) return;
      const children = [];
      paragraph.forEach((line, index) => {
        if (index) children.push({ type: `break` });
        children.push(...parseInline(line, 0));
      });
      blocks.push({ type: `paragraph`, children });
      paragraph = [];
    };
    const endList = () => {
      if (list) blocks.push(list);
      list = null;
    };
    for (const line of text.split(`\n`)) {
      if (!line.trim()) {
        endParagraph();
        endList();
        continue;
      }
      const heading = HEADING.exec(line.trim());
      const bullet = BULLET.exec(line);
      const numbered = bullet ? null : NUMBERED.exec(line);
      if (heading) {
        endParagraph();
        endList();
        blocks.push({ type: `heading`, level: heading[1].length, children: parseInline(heading[2].trim(), 0) });
      } else if (bullet || numbered) {
        endParagraph();
        const ordered = Boolean(numbered);
        if (list && list.ordered !== ordered) endList();
        if (!list) list = { type: `list`, ordered, items: [] };
        list.items.push(parseInline((bullet || numbered)[1].trim(), 0));
      } else {
        endList();
        paragraph.push(line.trim());
      }
    }
    endParagraph();
    endList();
    return blocks;
  }

  const api = { safeUrl, parseInline, parseMarkdown };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbMarkdown = api;
})(typeof window !== `undefined` ? window : globalThis);
