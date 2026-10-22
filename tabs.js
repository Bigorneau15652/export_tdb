// The tabs of the widget: dashboard, explorer and query lab. Showing a tab hides the other panels,
// sets `data-tab` on the page body (the status lines of the explorer are hidden on the dashboard)
// and tells the other scripts with the event `exporttdb:tabchanged` (its detail is the tab name).
(function () {
  const NAMES = [`board`, `explorer`, `lab`];
  const tabs = new Map(NAMES.map((name) => [name, document.getElementById(`tab${name.charAt(0).toUpperCase()}${name.slice(1)}`)]));
  const panels = new Map(NAMES.map((name) => [name, document.getElementById(`panel${name.charAt(0).toUpperCase()}${name.slice(1)}`)]));
  window.exportTdbCurrentTab = `board`;

  // Shows one tab and hides the others.
  function showTab(name) {
    window.exportTdbCurrentTab = name;
    document.body.dataset.tab = name;
    for (const other of NAMES) {
      panels.get(other).hidden = other !== name;
      tabs.get(other).setAttribute(`aria-selected`, String(other === name));
    }
    window.dispatchEvent(new CustomEvent(`exporttdb:tabchanged`, { detail: name }));
  }

  for (const name of NAMES) tabs.get(name).addEventListener(`click`, () => showTab(name));
  showTab(`board`);
})();
