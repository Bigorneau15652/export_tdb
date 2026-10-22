// The tables that the dashboard needs for its fields, loaded once and kept until the user asks to
// refresh them (Grist does not tell a widget when another table changes). Loading goes through
// grist-access.js.
(function () {
  const access = window.exportTdbAccess;
  const MAX_TABLES = 18;
  const cache = new Map();
  let version = 0;

  // Loads the tables that are not in the cache yet. Resolves to the number of tables loaded.
  async function ensure(names) {
    let loaded = 0;
    for (const name of names) {
      if (cache.has(name) || cache.size >= MAX_TABLES) continue;
      cache.set(name, await access.fetchTable(name));
      loaded += 1;
    }
    if (loaded) version += 1;
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
