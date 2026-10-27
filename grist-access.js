// Access of the dashboard to Grist: reads and saves the model in the options of the widget. All the
// other dashboard files go through this one, so that they can be tested with a fake Grist.
(function () {
  const callbacks = [];
  let registered = false;

  // What was exchanged with Grist since the page was opened (the options received and the saves made), kept for the
  // diagnostic report so that a model that seems lost can be explained.
  const exchanges = [];
  const MAX_EXCHANGES = 30;
  const opened = Date.now();

  // Adds a line to the list of exchanges, with the time since the page was opened.
  function note(kind, detail) {
    exchanges.push(`${((Date.now() - opened) / 1000).toFixed(1)} s ${kind}: ${detail}`);
    if (exchanges.length > MAX_EXCHANGES) exchanges.shift();
  }

  // Calls `callback(rawModel)` now and each time Grist gives the options again (rawModel is null when
  // nothing is saved yet).
  function onModel(callback) {
    callbacks.push(callback);
    if (registered) return;
    registered = true;
    grist.onOptions((options) => {
      const raw = options && typeof options === `object` ? options.model : null;
      note(`received`, raw === null || raw === undefined ? `no model` : raw && Array.isArray(raw.blocks) ? `${raw.blocks.length} block(s)` : `unreadable model`);
      for (const each of callbacks) each(raw === undefined ? null : raw);
    });
  }

  // Saves the model in the options of the widget. Resolves to true, or to false when Grist refuses.
  async function saveModel(model) {
    try {
      if (typeof grist.setOption === `function`) await grist.setOption(`model`, model);
      else await grist.setOptions({ model });
      note(`saved`, `${model.blocks.length} block(s)`);
      return true;
    } catch {
      note(`save refused`, `${model.blocks.length} block(s)`);
      return false;
    }
  }

  // Loads a whole table in columns, as `fetchTable` gives it.
  function fetchTable(name) {
    return grist.docApi.fetchTable(name);
  }

  // Writes `value` in one cell. Tries `applyUserActions` first, then the table object of the plugin API.
  // Resolves to { ok: true } or { ok: false, reason }.
  async function writeCell(tableId, rowId, colId, value) {
    let reason = ``;
    try {
      await grist.docApi.applyUserActions([[`UpdateRecord`, tableId, rowId, { [colId]: value }]]);
      return { ok: true };
    } catch (first) {
      reason = String(first && first.message ? first.message : first);
    }
    try {
      await grist.getTable(tableId).update({ id: rowId, fields: { [colId]: value } });
      return { ok: true };
    } catch (second) {
      return { ok: false, reason: String(second && second.message ? second.message : second) || reason };
    }
  }

  // The short-lived read-only token that Grist gives for the attachments, kept until it is about to expire.
  let attachmentToken = null;
  const TOKEN_MARGIN_MS = 10000;

  // The address from which a picture element can load the attachment `id`. Resolves to a text, or rejects when Grist
  // gives no token.
  async function attachmentAddress(id) {
    const now = Date.now();
    if (!attachmentToken || attachmentToken.expires - now < TOKEN_MARGIN_MS) {
      const info = await grist.docApi.getAccessToken({ readOnly: true });
      attachmentToken = { baseUrl: info.baseUrl, token: info.token, expires: now + (info.ttlMsecs || 60000) };
    }
    return `${attachmentToken.baseUrl}/attachments/${id}/download?auth=${attachmentToken.token}`;
  }

  window.exportTdbAccess = { onModel, saveModel, fetchTable, writeCell, attachmentAddress, exchanges: () => exchanges.slice() };
})();
