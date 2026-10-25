// The course windows: a button of the settings panel opens, in a window of the browser of its own, the course of the
// type of block (what it is for, step by step, the settings one by one, examples with a small drawn result, good to
// know). The window is a page of the site (guide.html) that the widget fills with createElement and textContent; it
// can be moved to another screen, resized and kept open while a block is set. The text of the courses is in
// guide-content.js and shared/i18n.js, in French and in English like the rest of the widget.
(function () {
  const { t } = window.exportTdbI18n;
  const Content = window.exportTdbGuideContent;
  const NAME = `export_tdb_guide`;
  const TYPE_KEYS = { text: `typeText`, table: `typeTable`, record: `typeRecord`, chart: `typeChart`, image: `typeImage`, indicator: `typeIndicator` };

  // True when a course exists for this type of block.
  function has(type) {
    return Content.TYPES.includes(type);
  }

  // An element with a class and a text.
  function make(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // A list (ordered or not) of texts.
  function list(doc, tag, items, className) {
    const node = make(doc, tag, className);
    for (const text of items) node.appendChild(make(doc, `li`, ``, text));
    return node;
  }

  // The small result drawn under the settings of an example, with invented values.
  function drawSample(doc, sample) {
    if (sample.kind === `table`) {
      const table = make(doc, `table`, `sample`);
      const head = table.createTHead().insertRow();
      sample.headers.forEach((text, index) => head.appendChild(make(doc, `th`, index ? `num` : ``, text)));
      const body = table.createTBody();
      for (const row of sample.rows) {
        const line = body.insertRow();
        row.forEach((text, index) => line.appendChild(make(doc, `td`, index && /^[\d.,\s]+$/.test(text) ? `num` : ``, text)));
      }
      if (sample.total) {
        const foot = table.createTFoot().insertRow();
        sample.total.forEach((text, index) => foot.appendChild(make(doc, `td`, index ? `num` : ``, text)));
      }
      return table;
    }
    if (sample.kind === `record`) {
      const grid = make(doc, `div`, `sampleRecord`);
      grid.style.gridTemplateColumns = `repeat(${sample.columns || 2}, minmax(0, 1fr))`;
      for (const [label, value] of sample.cells) {
        const cell = make(doc, `div`);
        cell.append(make(doc, `div`, `label`, label), make(doc, `div`, `value`, value));
        grid.appendChild(cell);
      }
      return grid;
    }
    if (sample.kind === `bars`) {
      const chart = make(doc, `div`, `sampleBars`);
      const numbers = sample.rows.map((row) => Number(String(row[1]).replace(/\s/g, ``).replace(`,`, `.`)) || 0);
      const top = Math.max(...numbers, 1);
      sample.rows.forEach((row, index) => {
        const line = make(doc, `div`, `barRow`);
        const track = make(doc, `div`, `barTrack`);
        const bar = make(doc, `div`, `bar color${index % 4}`);
        bar.style.width = `${Math.max(4, Math.round((numbers[index] / top) * 100))}%`;
        track.appendChild(bar);
        line.append(make(doc, `div`, `barLabel`, row[0]), track, make(doc, `div`, `barValue`, row[1]));
        chart.appendChild(line);
      });
      return chart;
    }
    if (sample.kind === `indicator`) {
      const [label, value, note] = sample.cells[0];
      const card = make(doc, `div`, `sampleIndicator ind-${sample.color || `none`}`);
      card.appendChild(make(doc, `div`, `indLabel`, label));
      const symbol = (window.exportTdbIndicator && window.exportTdbIndicator.SYMBOLS[sample.color]) || ``;
      const row = make(doc, `div`, `indRow`);
      row.appendChild(make(doc, `span`, `indValue`, value));
      if (symbol) row.appendChild(make(doc, `span`, `indSymbol`, symbol));
      card.appendChild(row);
      if (note) card.appendChild(make(doc, `div`, `indNote`, note));
      return card;
    }
    if (sample.kind === `image`) {
      const frame = make(doc, `div`, `sampleImage`);
      frame.appendChild(make(doc, `div`, `picture`));
      for (const line of sample.lines) frame.appendChild(make(doc, `div`, `caption`, line.text));
      return frame;
    }
    const box = make(doc, `div`, `sampleText`);
    for (const line of sample.lines) box.appendChild(make(doc, line.tag === `h1` ? `h1` : `p`, ``, line.text));
    return box;
  }

  // Fills the page of the course window with the course of a type of block.
  function fill(popup, type) {
    const doc = popup.document;
    const root = doc.getElementById(`guide`);
    const topic = Content.TOPICS[type];
    doc.title = t(`guide_window_title`, { name: t(TYPE_KEYS[type]) });
    doc.documentElement.lang = window.exportTdbI18n.lang;
    root.textContent = ``;
    const head = make(doc, `div`, `guideHead`);
    const close = make(doc, `button`, `guideClose`, `×`);
    close.type = `button`;
    close.setAttribute(`aria-label`, t(`guide_close`));
    close.addEventListener(`click`, () => popup.close());
    head.append(make(doc, `h1`, ``, t(topic.title)), close);
    root.appendChild(head);
    doc.addEventListener(`keydown`, (event) => {
      if (event.key === `Escape`) popup.close();
    });
    for (const section of Content.sectionsOf(type, t)) {
      if (section.kind === `intro`) {
        root.appendChild(make(doc, `p`, `intro`, section.text));
        continue;
      }
      root.appendChild(make(doc, `h2`, ``, section.heading));
      if (section.kind === `steps`) {
        root.appendChild(list(doc, `ol`, section.items));
      } else if (section.kind === `block`) {
        for (const text of section.paragraphs) root.appendChild(make(doc, `p`, ``, text));
        if (section.items.length) root.appendChild(list(doc, `ul`, section.items));
      } else if (section.kind === `menus`) {
        const terms = make(doc, `dl`);
        for (const item of section.items) terms.append(make(doc, `dt`, ``, item.name), make(doc, `dd`, ``, item.text));
        root.appendChild(terms);
      } else if (section.kind === `examples`) {
        for (const example of section.items) {
          const box = make(doc, `div`, `example`);
          box.appendChild(make(doc, `h3`, ``, example.title));
          box.appendChild(make(doc, `div`, `exampleLabel`, example.settingsLabel));
          box.appendChild(list(doc, `ul`, example.settings));
          box.appendChild(make(doc, `div`, `exampleLabel`, example.resultLabel));
          box.appendChild(drawSample(doc, example.sample));
          root.appendChild(box);
        }
      } else if (section.kind === `notes`) {
        root.appendChild(list(doc, `ul`, section.items, `notes`));
      }
    }
  }

  // True when the window shows the page of the courses and is ready to be filled.
  function ready(popup) {
    try {
      return popup.location.pathname.endsWith(`/guide.html`) && popup.document.readyState === `complete` && Boolean(popup.document.getElementById(`guide`));
    } catch {
      return false;
    }
  }

  // Opens the course of a type of block, in the window of the courses (a second call changes its content). Must be called
  // from a click. Resolves to `ok`, `blocked` (pop-up blocker) or `failed`.
  async function open(type) {
    if (!has(type)) return `failed`;
    const popup = window.open(``, NAME, `popup=yes,width=620,height=760,resizable=yes,scrollbars=yes`);
    if (!popup) return `blocked`;
    try {
      if (!ready(popup)) popup.location.href = new URL(`guide.html`, location.href).href;
      const deadline = Date.now() + 10000;
      while (!popup.closed && !ready(popup) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
      if (ready(popup)) {
        fill(popup, type);
        popup.focus();
        return `ok`;
      }
    } catch {
      // The window cannot be used: it is closed below.
    }
    popup.close();
    return `failed`;
  }

  window.exportTdbGuide = { has, open };
})();
