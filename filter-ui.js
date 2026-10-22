// The controls of one filter (column, comparison, value) shared by the query lab and the table blocks.
// A filter is read as { path, op, value } where value is { kind: `const`, value }, { kind: `field`, path }
// or { kind: `id` }, the form that rowset.js applies.
(function () {
  const { t } = window.exportTdbI18n;
  const Help = window.exportTdbHelp;

  const OPERATORS = [
    [`eq`, `opEq`], [`ne`, `opNe`], [`gt`, `opGt`], [`ge`, `opGe`], [`lt`, `opLt`], [`le`, `opLe`],
    [`contains`, `opContains`], [`empty`, `opEmpty`], [`notEmpty`, `opNotEmpty`], [`true`, `opTrue`], [`false`, `opFalse`]
  ];
  const NO_VALUE = new Set([`empty`, `notEmpty`, `true`, `false`]);

  // Fills a select element with [value, label] pairs.
  function fillSelect(select, items) {
    select.textContent = ``;
    for (const [value, label] of items) {
      const option = document.createElement(`option`);
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  // Builds the controls of one filter in `box` (a fieldset). `choices` and `startChoices` are lists of
  // { path, label }: the columns of the table and the columns of the starting row. `initial` is a filter
  // to show, or nothing. `onChange` is called each time the user changes a control.
  function build(box, choices, startChoices, initial, onChange) {
    box.textContent = ``;
    const legend = document.createElement(`legend`);
    legend.textContent = t(`labFilter`);
    legend.appendChild(Help.make(`tipFilter`));
    box.appendChild(legend);
    const filter = { box };
    const make = (tag) => box.appendChild(document.createElement(tag));
    filter.column = make(`select`);
    fillSelect(filter.column, [[``, t(`labNone`)], ...choices.map((c) => [c.path, c.label])]);
    filter.op = make(`select`);
    fillSelect(filter.op, OPERATORS.map(([value, key]) => [value, t(key)]));
    filter.source = make(`select`);
    fillSelect(filter.source, [[`const`, t(`sourceConst`)], [`field`, t(`sourceField`)], [`id`, t(`sourceId`)]]);
    filter.value = make(`input`);
    filter.value.type = `text`;
    filter.value.setAttribute(`aria-label`, t(`labValue`));
    filter.field = make(`select`);
    fillSelect(filter.field, startChoices.map((c) => [c.path, c.label]));
    filter.field.setAttribute(`aria-label`, t(`labField`));
    const sync = () => {
      const needsValue = !NO_VALUE.has(filter.op.value);
      filter.source.hidden = !needsValue;
      filter.value.hidden = !needsValue || filter.source.value !== `const`;
      filter.field.hidden = !needsValue || filter.source.value !== `field`;
    };
    if (initial) {
      if ([...filter.column.options].some((o) => o.value === initial.path)) filter.column.value = initial.path;
      filter.op.value = initial.op;
      if (initial.value) {
        filter.source.value = initial.value.kind;
        if (initial.value.kind === `const`) filter.value.value = String(initial.value.value);
        if (initial.value.kind === `field` && [...filter.field.options].some((o) => o.value === initial.value.path)) filter.field.value = initial.value.path;
      }
    }
    sync();
    for (const control of [filter.column, filter.op, filter.source, filter.field]) control.addEventListener(`change`, () => {
      sync();
      if (onChange) onChange();
    });
    filter.value.addEventListener(`input`, () => {
      if (onChange) onChange();
    });
    return filter;
  }

  // Reads one filter, or null when no column is chosen.
  function read(filter) {
    if (!filter.column || !filter.column.value) return null;
    const op = filter.op.value;
    if (NO_VALUE.has(op)) return { path: filter.column.value, op };
    let value;
    if (filter.source.value === `id`) value = { kind: `id` };
    else if (filter.source.value === `field`) value = { kind: `field`, path: filter.field.value };
    else {
      const text = filter.value.value.trim();
      value = { kind: `const`, value: text !== `` && Number.isFinite(Number(text.replace(`,`, `.`))) ? Number(text.replace(`,`, `.`)) : text };
    }
    return { path: filter.column.value, op, value };
  }

  window.exportTdbFilterUi = { build, read };
})();
