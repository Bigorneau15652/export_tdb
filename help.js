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
    badge.setAttribute(`aria-label`, t(key));
    return badge;
  }

  let bubble = null;
  let owner = null;

  // Closes the open bubble, if any.
  function close(giveFocus) {
    if (!bubble) return;
    bubble.remove();
    bubble = null;
    if (giveFocus && owner) owner.focus();
    owner = null;
  }

  // Opens the bubble of a badge under it, with a cross in the corner. A second click on the same
  // badge closes it.
  function open(badge) {
    const same = owner === badge;
    close(false);
    if (same) return;
    owner = badge;
    bubble = document.createElement(`div`);
    bubble.className = `helpBubble`;
    bubble.setAttribute(`role`, `dialog`);
    const text = document.createElement(`span`);
    text.textContent = badge.dataset.tip || ``;
    const cross = document.createElement(`button`);
    cross.type = `button`;
    cross.className = `helpClose`;
    cross.textContent = `\u00d7`;
    cross.setAttribute(`aria-label`, t(`helpClose`));
    cross.addEventListener(`click`, () => close(true));
    bubble.append(text, cross);
    document.body.appendChild(bubble);
    const box = badge.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const left = Math.max(8, Math.min(box.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - width - 8));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${box.bottom + window.scrollY + 6}px`;
  }

  document.addEventListener(`click`, (event) => {
    const badge = event.target.closest ? event.target.closest(`.help`) : null;
    if (badge) {
      event.preventDefault();
      open(badge);
    } else if (bubble && !bubble.contains(event.target)) {
      close(false);
    }
  });
  document.addEventListener(`keydown`, (event) => {
    if (event.key === `Escape` && bubble) close(true);
    else if ((event.key === `Enter` || event.key === ` `) && event.target.classList && event.target.classList.contains(`help`)) {
      event.preventDefault();
      open(event.target);
    }
  });

  window.exportTdbHelp = { make };
})();
