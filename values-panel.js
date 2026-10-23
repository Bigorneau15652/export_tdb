// The editor of the named values, shown in the settings panel of the dashboard. One card per value: its name, its
// kind (calculation on a table, column of the selected row, expression), the settings of that kind, the unit and the
// decimals, and the result that it gives now for the selected row. The cards are rebuilt only when their structure
// changes, so that typing in a field is never interrupted. The values themselves are cleaned by model.js.
(function () {
  const { t } = window.exportTdbI18n;
  const FilterUi = window.exportTdbFilterUi;
  const FN_ORDER = [`sum`, `avg`, `min`, `max`, `count`, `distinct`];
  const FN_SHORT = { sum: `fnSumShort`, avg: `fnAvgShort`, min: `fnMinShort`, max: `fnMaxShort`, count: `fnCountShort`, distinct: `fnDistinctShort` };
  const NUMERIC_FUNCTIONS = [`sum`, `avg`, `min`, `max`];
  const KIND_KEYS = { calc: `valueKindCalc`, field: `valueKindField`, expr: `valueKindExpr` };
  const FILTERS_PER_VALUE = 2;

  // Fills a select element with [value, label] pairs.
  function fillSelect(select, items, value) {
    select.textContent = ``;
    for (const [optionValue, label] of items) {
      const option = document.createElement(`option`);
      option.value = String(optionValue);
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = String(value);
  }

  // Sets the items of a select only when they changed, then its value.
  function setOptions(select, items, value) {
    const signature = JSON.stringify(items);
    if (select.dataset.signature !== signature) {
      fillSelect(select, items, value);
      select.dataset.signature = signature;
    }
    if (select.value !== String(value)) select.value = String(value);
  }

  // Sets the text of an input, unless the user is typing in it.
  function setText(input, value) {
    if (document.activeElement !== input && input.value !== value) input.value = value;
  }

  // Creates the editor. `deps`: list (the element that receives the cards), getValues(), setValues(list),
  // context() ({ schema, linked, record }), results() (the evaluation of the values: { list }), linkLabel(choice)
  // (the short sentence of a way to choose rows), Fields and Query (the pure modules).
  function create(deps) {
    let builtFor = ``;

    const change = (index, patch) => {
      const list = deps.getValues().map((item) => ({ ...item }));
      if (!list[index]) return;
      list[index] = { ...list[index], ...patch };
      deps.setValues(list);
    };

    // The card of the value `index`: its fixed controls and the controls of its kind.
    function buildCard(index, item) {
      const card = document.createElement(`div`);
      card.className = `valueCard`;
      card.dataset.index = String(index);
      const make = (tag, className) => {
        const element = document.createElement(tag);
        element.className = className;
        return element;
      };
      const head = make(`div`, `valueHead`);
      const name = make(`input`, `valueName`);
      name.type = `text`;
      name.maxLength = 40;
      name.placeholder = t(`valueNamePlaceholder`);
      name.setAttribute(`aria-label`, t(`valueNamePlaceholder`));
      const kind = make(`select`, `valueKind`);
      const remove = make(`button`, `valueRemove`);
      remove.type = `button`;
      remove.textContent = `×`;
      remove.setAttribute(`aria-label`, t(`valueRemove`));
      head.append(name, kind, remove);
      card.appendChild(head);
      name.addEventListener(`input`, () => change(index, { name: name.value }));
      kind.addEventListener(`change`, () => change(index, { kind: kind.value }));
      remove.addEventListener(`click`, () => deps.setValues(deps.getValues().filter((_, at) => at !== index)));
      if (item.kind === `calc`) {
        const table = make(`select`, `valueTable`);
        const link = make(`select`, `valueLink`);
        const row = make(`div`, `valueRow`);
        const fn = make(`select`, `valueFn`);
        const path = make(`select`, `valuePath`);
        row.append(fn, path);
        const filters = make(`div`, `valueFilters`);
        card.append(labelled(t(`valueTable`), table), labelled(t(`valueLink`), link), row, filters);
        table.addEventListener(`change`, () => change(index, { table: table.value, start: ``, link: ``, path: ``, filters: [] }));
        link.addEventListener(`change`, () => {
          const current = deps.getValues()[index];
          const [start, linkKey] = link.value ? link.value.split(`|`) : [``, ``];
          change(index, start === current.start ? { start, link: linkKey } : { start, link: linkKey, filters: [] });
        });
        fn.addEventListener(`change`, () => {
          const current = deps.getValues()[index];
          const needsNumbers = NUMERIC_FUNCTIONS.includes(fn.value);
          const numeric = numericPaths(current.table);
          change(index, needsNumbers && current.path && !numeric.has(current.path) ? { fn: fn.value, path: `` } : { fn: fn.value });
        });
        path.addEventListener(`change`, () => change(index, { path: path.value }));
      } else if (item.kind === `field`) {
        const column = make(`select`, `valueColumn`);
        card.appendChild(labelled(t(`valueColumn`), column));
        column.addEventListener(`change`, () => change(index, { path: column.value }));
      } else {
        const expression = make(`input`, `valueExpr`);
        expression.type = `text`;
        expression.maxLength = 500;
        expression.placeholder = `{a} / {b}`;
        expression.setAttribute(`aria-label`, t(`valueExpression`));
        const names = make(`p`, `hint valueNames`);
        card.append(labelled(t(`valueExpression`), expression), names);
        expression.addEventListener(`input`, () => change(index, { expr: expression.value }));
      }
      const look = make(`div`, `valueRow`);
      const unit = make(`input`, `valueUnit`);
      unit.type = `text`;
      unit.maxLength = 12;
      unit.placeholder = t(`valueUnit`);
      unit.setAttribute(`aria-label`, t(`valueUnit`));
      const decimals = make(`select`, `valueDecimals`);
      decimals.setAttribute(`aria-label`, t(`valueDecimals`));
      look.append(unit, decimals);
      const result = make(`p`, `valueResult`);
      card.append(look, result);
      unit.addEventListener(`input`, () => change(index, { unit: unit.value }));
      decimals.addEventListener(`change`, () => change(index, { decimals: Number(decimals.value) }));
      return card;
    }

    // A label above a control.
    function labelled(text, control) {
      const box = document.createElement(`label`);
      box.className = `valueLabelled`;
      const caption = document.createElement(`span`);
      caption.textContent = text;
      box.append(caption, control);
      return box;
    }

    // The paths of the columns that hold numbers in a table, as a Set.
    function numericPaths(tableId) {
      const state = deps.context();
      return state.schema && tableId && state.schema.tables.has(tableId) ? deps.Query.numericPaths(state.schema, tableId) : new Set();
    }

    // Shows the values: rebuilds the cards when their structure changed, then fills their controls.
    function render() {
      const state = deps.context();
      const list = deps.getValues();
      const key = JSON.stringify([state.linked, Boolean(state.schema), list.map((item) => [item.kind, item.table, item.start, item.link, item.fn])]);
      if (key !== builtFor) {
        builtFor = key;
        deps.list.textContent = ``;
        list.forEach((item, index) => deps.list.appendChild(buildCard(index, item)));
      }
      const results = deps.results().list;
      const names = list.map((item) => item.name).filter(Boolean);
      list.forEach((item, index) => fillCard(deps.list.children[index], item, results[index], state, names));
    }

    // Fills the controls of one card from the value and shows its result.
    function fillCard(card, item, result, state, names) {
      if (!card) return;
      const q = (selector) => card.querySelector(selector);
      setText(q(`.valueName`), item.name);
      setOptions(q(`.valueKind`), Object.keys(KIND_KEYS).map((kind) => [kind, t(KIND_KEYS[kind])]), item.kind);
      setText(q(`.valueUnit`), item.unit);
      setOptions(q(`.valueDecimals`), [[-1, t(`valueDecimalsAuto`)], ...[0, 1, 2, 3, 4].map((count) => [count, `${count}`])], item.decimals);
      const schema = state.schema;
      if (item.kind === `calc` && schema) fillCalc(card, item, state);
      if (item.kind === `field`) {
        const choices = schema && state.linked && schema.tables.has(state.linked) ? deps.Fields.sortChoices(deps.Fields.fieldChoices(schema, state.linked)) : [];
        setOptions(q(`.valueColumn`), [[``, t(`boardColumnNone`)], ...choices.map((choice) => [choice.path, choice.label])], item.path);
      }
      if (item.kind === `expr`) {
        setText(q(`.valueExpr`), item.expr);
        q(`.valueNames`).textContent = names.length ? t(`valueNamesAvailable`, { names: names.filter((name) => name !== item.name).map((name) => `{${name}}`).join(` `) }) : t(`valueNamesNone`);
      }
      const shown = q(`.valueResult`);
      if (!result) shown.textContent = ``;
      else if (result.error) shown.textContent = `${t(`valueResultError`)} ${t(`valueError_${result.error}`, { reason: result.error })}`;
      else shown.textContent = `= ${result.text}`;
      shown.className = result && result.error ? `valueResult warning` : `valueResult`;
    }

    // Fills the controls of a calculation: table, rows, function, column and filters.
    function fillCalc(card, item, state) {
      const schema = state.schema;
      const q = (selector) => card.querySelector(selector);
      setOptions(q(`.valueTable`), [[``, t(`boardColumnNone`)], ...deps.Query.listAllTables(schema).map((entry) => [entry.table, entry.summary ? `${entry.table} ${t(`labQualitySummary`)}` : entry.table])], item.table);
      const known = item.table && schema.tables.has(item.table);
      const choices = known ? deps.Query.listChoices(schema, state.linked, item.table).filter((choice) => !choice.advanced) : [];
      const chosen = choices.find((choice) => choice.start === item.start && choice.link === item.link);
      setOptions(q(`.valueLink`), [[``, t(`boardColumnNone`)], ...choices.map((choice) => [choice.value, choice.kind === `all` ? t(`labAllRows`) : deps.linkLabel(choice)])], chosen ? chosen.value : ``);
      setOptions(q(`.valueFn`), FN_ORDER.map((name) => [name, t(FN_SHORT[name])]), item.fn);
      const numeric = numericPaths(item.table);
      const columns = known ? deps.Fields.sortChoices(deps.Fields.fieldChoices(schema, item.table)) : [];
      const available = NUMERIC_FUNCTIONS.includes(item.fn) ? columns.filter((choice) => numeric.has(choice.path)) : columns;
      setOptions(q(`.valuePath`), [[``, item.fn === `count` ? t(`boardCountRows`) : t(`boardColumnNone`)], ...available.map((choice) => [choice.path, choice.label])], item.path);
      const box = q(`.valueFilters`);
      if (!known || !chosen) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      const filterKey = `${item.table}|${item.start}|${item.link}`;
      if (box.dataset.built !== filterKey) {
        box.dataset.built = filterKey;
        box.textContent = ``;
        const start = deps.Query.listStarts(schema, state.linked).find((entry) => entry.key === item.start);
        const startChoices = start ? deps.Fields.fieldChoices(schema, start.table) : [];
        const uis = [];
        for (let at = 0; at < FILTERS_PER_VALUE; at += 1) {
          const fieldset = document.createElement(`fieldset`);
          fieldset.className = `filter`;
          box.appendChild(fieldset);
          uis.push(FilterUi.build(fieldset, columns, startChoices, item.filters[at], () => {
            const index = Number(card.dataset.index);
            change(index, { filters: uis.map(FilterUi.read).filter(Boolean) });
          }));
        }
      }
    }

    return { render };
  }

  window.exportTdbValuesPanel = { create };
})();
