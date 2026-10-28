// The settings of an indicator block, shown in the settings panel: the named value that the card shows, a note
// under it, the size of the text, the default colour and the rules of colour by thresholds. The controls are built
// once; the rules are rebuilt only when their number changes, so that typing a limit is never interrupted.
(function () {
  const { t } = window.exportTdbI18n;
  const { setOptions, setText } = window.exportTdbDom;
  const Indicator = window.exportTdbIndicator;
  const COLOR_KEYS = { none: `indColorNone`, green: `indColorGreen`, orange: `indColorOrange`, red: `indColorRed`, blue: `indColorBlue`, grey: `indColorGrey` };

  // The number typed in a field (a comma or a point for the decimals), or null when it is not a number.
  function parseLimit(text) {
    const cleaned = String(text).trim().replace(/\s/g, ``).replace(`,`, `.`);
    if (!cleaned) return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  // Creates the settings in `deps.box`. `deps`: box, getBlock() (the selected indicator block), change(patch) (new
  // settings), names() (the names of the named values), current() ({ text, color, error } now), sizeItems.
  function create(deps) {
    const make = (tag, className) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      return element;
    };
    const labelled = (text, control) => {
      const box = make(`label`, `indLabelled`);
      const caption = make(`span`);
      caption.textContent = text;
      box.append(caption, control);
      return box;
    };
    const value = make(`select`, `indValue`);
    const note = make(`input`, `indNote`);
    note.type = `text`;
    note.maxLength = 200;
    const size = make(`select`, `indSize`);
    const base = make(`select`, `indBase`);
    const pair = make(`div`, `pair`);
    pair.append(labelled(t(`boardSize`), size), labelled(t(`boardIndicatorBase`), base));
    const rules = make(`div`, `indRules`);
    const add = make(`button`, `button secondary small`);
    add.type = `button`;
    add.textContent = t(`boardIndicatorAddRule`);
    const info = make(`p`, `hint`);
    info.setAttribute(`role`, `status`);
    deps.box.append(labelled(t(`boardIndicatorValue`), value), labelled(t(`boardIndicatorNote`), note), pair, labelled(t(`boardIndicatorRules`), rules), add, info);

    const rulesOf = () => deps.getBlock().config.rules.map((rule) => ({ ...rule }));
    const editRule = (index, patch) => {
      const list = rulesOf();
      list[index] = { ...list[index], ...patch };
      deps.change({ rules: list });
    };
    value.addEventListener(`change`, () => deps.change({ value: value.value }));
    note.addEventListener(`input`, () => deps.change({ note: note.value }));
    size.addEventListener(`change`, () => deps.change({ size: size.value }));
    base.addEventListener(`change`, () => deps.change({ base: base.value }));
    add.addEventListener(`click`, () => {
      if (deps.getBlock().config.rules.length < deps.maxRules) deps.change({ rules: [...rulesOf(), { op: `ge`, limit: null, color: `green` }] });
    });

    // The line of one rule: the comparison, the limit, the colour and the buttons that move or remove it.
    function buildRule(index) {
      const row = make(`div`, `indRule`);
      const op = make(`select`, `indOp`);
      const limit = make(`input`, `indLimit`);
      limit.type = `text`;
      limit.inputMode = `decimal`;
      limit.setAttribute(`aria-label`, t(`indLimit`));
      const color = make(`select`, `indColor`);
      const button = (text, key, action) => {
        const item = make(`button`);
        item.type = `button`;
        item.textContent = text;
        item.setAttribute(`aria-label`, t(key));
        item.addEventListener(`click`, action);
        return item;
      };
      const move = (delta) => {
        const list = rulesOf();
        const target = index + delta;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        deps.change({ rules: list });
      };
      op.addEventListener(`change`, () => editRule(index, { op: op.value }));
      limit.addEventListener(`input`, () => editRule(index, { limit: parseLimit(limit.value) }));
      color.addEventListener(`change`, () => editRule(index, { color: color.value }));
      row.append(op, limit, color, button(`↑`, `boardColumnUp`, () => move(-1)), button(`↓`, `boardColumnDown`, () => move(1)), button(`×`, `boardColumnRemove`, () => deps.change({ rules: rulesOf().filter((_, at) => at !== index) })));
      return row;
    }

    // Fills the controls from the selected block.
    function render() {
      const config = deps.getBlock().config;
      const names = deps.names();
      setOptions(value, [[``, t(`boardColumnNone`)], ...names.map((name) => [name, name]), ...(config.value && !names.includes(config.value) ? [[config.value, config.value]] : [])], config.value);
      setText(note, config.note);
      setOptions(size, deps.sizeItems, config.size);
      const colors = Indicator.COLORS.map((name) => [name, t(COLOR_KEYS[name])]);
      setOptions(base, colors, config.base);
      if (rules.children.length !== config.rules.length) {
        rules.textContent = ``;
        config.rules.forEach((_, index) => rules.appendChild(buildRule(index)));
      }
      config.rules.forEach((rule, index) => {
        const row = rules.children[index];
        setOptions(row.querySelector(`.indOp`), [[`ge`, t(`indOpGe`)], [`le`, t(`indOpLe`)]], rule.op);
        setText(row.querySelector(`.indLimit`), rule.limit === null ? `` : String(rule.limit).replace(`.`, `,`));
        setOptions(row.querySelector(`.indColor`), colors, rule.color);
      });
      add.disabled = config.rules.length >= deps.maxRules;
      const now = deps.current();
      if (!config.value) info.textContent = names.length ? t(`indicatorNoValue`) : t(`indicatorNoNamedValues`);
      else if (now.error) info.textContent = t(`indicatorValueError`, { name: config.value });
      else info.textContent = t(`indicatorCurrent`, { text: now.text, color: t(COLOR_KEYS[now.color]) });
      info.className = config.value && now.error ? `warning` : `hint`;
    }

    return { render };
  }

  window.exportTdbIndicatorPanel = { create };
})();
