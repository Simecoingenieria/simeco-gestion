// Replica la API window.storage (get/set/delete/list) usando localStorage,
// para que la app funcione igual fuera de Claude, guardando los datos
// directamente en el navegador del celular o computador donde se abra.

function fullKey(key, shared) {
  return `simeco:${shared ? "shared" : "user"}:${key}`;
}

window.storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(fullKey(key, shared));
    if (raw === null) {
      throw new Error("Key not found: " + key);
    }
    return { key, value: raw, shared };
  },

  async set(key, value, shared = false) {
    localStorage.setItem(fullKey(key, shared), value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    localStorage.removeItem(fullKey(key, shared));
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const base = `simeco:${shared ? "shared" : "user"}:`;
    const full = base + prefix;
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(full))
      .map((k) => k.slice(base.length));
    return { keys, prefix, shared };
  },
};
