// Persistent preferences (language, theme, currency, favourites…) plus a tiny event bus.
// Storage can be unavailable (private mode, file:// quirks), so every access is guarded.
const PREFIX = 'axis:';
const listeners = new Map();

export const store = {
  get(name, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep working in memory only */
    }
  },
};

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
  emit(event, payload) {
    listeners.get(event)?.forEach((fn) => fn(payload));
  },
};

// A set of ids kept in storage, e.g. favourite units or the compare tray.
export function persistentSet(name, limit = Infinity) {
  let items = new Set(store.get(name, []));
  const save = () => {
    store.set(name, [...items]);
    bus.emit(name, [...items]);
  };
  return {
    has: (id) => items.has(id),
    list: () => [...items],
    get size() {
      return items.size;
    },
    toggle(id) {
      if (items.has(id)) items.delete(id);
      else if (items.size < limit) items.add(id);
      else return false;
      save();
      return true;
    },
    remove(id) {
      items.delete(id);
      save();
    },
    clear() {
      items = new Set();
      save();
    },
  };
}
