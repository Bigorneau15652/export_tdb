// Access of the dashboard to Grist: reads and saves the model in the options of the widget. All the
// other dashboard files go through this one, so that they can be tested with a fake Grist.
(function () {
  const callbacks = [];
  let registered = false;

  // Calls `callback(rawModel)` now and each time Grist gives the options again (rawModel is null when
  // nothing is saved yet).
  function onModel(callback) {
    callbacks.push(callback);
    if (registered) return;
    registered = true;
    grist.onOptions((options) => {
      const raw = options && typeof options === `object` ? options.model : null;
      for (const each of callbacks) each(raw === undefined ? null : raw);
    });
  }

  // Saves the model in the options of the widget. Resolves to true, or to false when Grist refuses.
  async function saveModel(model) {
    try {
      if (typeof grist.setOption === `function`) await grist.setOption(`model`, model);
      else await grist.setOptions({ model });
      return true;
    } catch {
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

  window.exportTdbAccess = { onModel, saveModel, fetchTable, writeCell, attachmentAddress };
})();
