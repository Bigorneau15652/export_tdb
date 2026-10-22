// The small "?" badge that shows an explanation on hover, focus or click. The text is a key of the
// translations, so that it is written in French or in English like the rest of the widget.
(function () {
  const { t } = window.exportTdbI18n;

  // Builds the badge for a translation key.
  function make(key) {
    const badge = document.createElement(`span`);
    badge.className = `help`;
    badge.tabIndex = 0;
    badge.setAttribute(`role`, `img`);
    badge.textContent = `?`;
    badge.dataset.tip = t(key);
    badge.title = t(key);
    badge.setAttribute(`aria-label`, t(key));
    return badge;
  }

  window.exportTdbHelp = { make };
})();
