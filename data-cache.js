// The tables that the dashboard needs for its fields, loaded once and kept until the user asks to
// refresh them (Grist does not tell a widget when another table changes). Loading goes through
// grist-access.js.
(function () {
  const access = window.exportTdbAccess;
  const MAX_TABLES = 18;
  const cache = new Map();
  let version = 0;

  // Loads the tables that are not in the cache yet, all at the same time, up to the limit of MAX_TABLES tables kept.
  // A table that cannot be loaded does not stop the others: they are kept, then the first failure is thrown.
  // Resolves to the number of tables loaded.
  async function ensure(names) {
    const wanted = [...new Set(names)].filter((name) => !cache.has(name)).slice(0, Math.max(0, MAX_TABLES - cache.size));
    const results = await Promise.allSettled(wanted.map(async (name) => {
      cache.set(name, await access.fetchTable(name));
    }));
    const loaded = results.filter((result) => result.status === `fulfilled`).length;
    if (loaded) version += 1;
    const failure = results.find((result) => result.status === `rejected`);
    if (failure) throw failure.reason;
    return loaded;
  }

  // Forgets every loaded table, so that the next request loads them again.
  function clear() {
    cache.clear();
    version += 1;
  }

  // Forgets one table, so that the next request loads it again.
  function drop(name) {
    cache.delete(name);
    version += 1;
  }

  window.exportTdbData = { ensure, clear, drop, tables: () => cache, version: () => version };
})();
