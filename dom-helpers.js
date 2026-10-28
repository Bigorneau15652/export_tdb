// Small helpers shared by the settings panels: filling a list of choices and setting the text of a field without
// disturbing the user who is typing in it. They touch the page, so they are checked by the integration tests.
(function () {
  // Fills a select element with [value, label] pairs (a third item names a group of options) and selects `value` when
  // it is given.
  function fillSelect(select, items, value) {
    select.textContent = ``;
    const groups = new Map();
    for (const [optionValue, label, group] of items) {
      const option = document.createElement(`option`);
      option.value = String(optionValue);
      option.textContent = label;
      if (group) {
        if (!groups.has(group)) {
          const element = document.createElement(`optgroup`);
          element.label = group;
          groups.set(group, element);
          select.appendChild(element);
        }
        groups.get(group).appendChild(option);
      } else {
        select.appendChild(option);
      }
    }
    if (value !== undefined) select.value = String(value);
  }

  // Sets the choices of a select element only when the list changed, then its value.
  function setOptions(select, items, value) {
    const signature = JSON.stringify(items);
    if (select.dataset.signature !== signature) {
      fillSelect(select, items, value);
      select.dataset.signature = signature;
    }
    if (select.value !== String(value)) select.value = String(value);
  }

  // Sets the text of a field, unless the user is typing in it.
  function setText(input, value) {
    if (document.activeElement !== input && input.value !== value) input.value = value;
  }

  window.exportTdbDom = { fillSelect, setOptions, setText };
})();
