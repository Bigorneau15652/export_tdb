// The small line icons of the tool bar and of the menus. Each icon is a list of drawing commands (paths of a 24 by 24
// grid) that are turned into an SVG element with createElementNS: nothing is written as HTML. The elements that carry
// `data-icon="name"` are filled when the page loads; `make(name)` gives an icon to put anywhere.
(function (root) {
  const PATHS = {
    plus: [`M12 5v14`, `M5 12h14`],
    format: [`M16 5H3v12h5`, `M8 9h13v12H8z`],
    landscape: [`M3 7h18v10H3z`],
    portrait: [`M7 3h10v18H7z`],
    margin: [`M4 4h16v16H4z`, `M8 8h8v8H8z`],
    footer: [`M5 3h14v18H5z`, `M8 17h8`],
    numbers: [`M9 4L7 20`, `M17 4l-2 16`, `M4 9h16`, `M3 15h16`],
    refresh: [`M20 11a8 8 0 1 0-2.3 5.7`, `M20 5v6h-6`],
    print: [`M7 8V3h10v5`, `M7 17H4v-7h16v7h-3`, `M7 14h10v7H7z`],
    developer: [`M9.5 5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0`, `M6 12a6 6 0 0 1 12 0`, `M4 12h16v7H4z`, `M2 21h20`],
    text: [`M5 6h14`, `M12 6v13`, `M9 19h6`],
    table: [`M3 5h18v14H3z`, `M3 10h18`, `M9 5v14`, `M15 5v14`],
    record: [`M5 4h14v16H5z`, `M8 9h8`, `M8 13h8`, `M8 17h5`],
    chart: [`M5 20V10`, `M12 20V4`, `M19 20v-7`],
    image: [`M3 5h18v14H3z`, `M3 16l5-5 4 4 3-3 6 6`, `M15 9h.01`],
    indicator: [`M4 16a8 8 0 0 1 16 0`, `M12 16l4-5`]
  };

  // The SVG element of an icon: lines of the colour of the text, without fill.
  function make(name) {
    const svg = document.createElementNS(`http://www.w3.org/2000/svg`, `svg`);
    svg.setAttribute(`viewBox`, `0 0 24 24`);
    svg.setAttribute(`width`, `20`);
    svg.setAttribute(`height`, `20`);
    svg.setAttribute(`fill`, `none`);
    svg.setAttribute(`stroke`, `currentColor`);
    svg.setAttribute(`stroke-width`, `2`);
    svg.setAttribute(`stroke-linecap`, `round`);
    svg.setAttribute(`stroke-linejoin`, `round`);
    svg.setAttribute(`aria-hidden`, `true`);
    for (const command of PATHS[name] || []) {
      const path = document.createElementNS(`http://www.w3.org/2000/svg`, `path`);
      path.setAttribute(`d`, command);
      svg.appendChild(path);
    }
    return svg;
  }

  // Puts the icon `name` in an element, in place of its previous icon.
  function setIcon(element, name) {
    element.dataset.icon = name;
    const old = element.querySelector(`svg`);
    if (old) old.remove();
    element.prepend(make(name));
  }

  if (typeof document !== `undefined`) document.querySelectorAll(`[data-icon]`).forEach((element) => setIcon(element, element.dataset.icon));

  const api = { PATHS, make, setIcon };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbIcons = api;
})(typeof window !== `undefined` ? window : globalThis);
