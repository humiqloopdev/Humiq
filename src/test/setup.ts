import '@testing-library/jest-dom';

// Some Node versions define their own (disabled) localStorage that hides the one jsdom provides.
// Fall back to a simple in-memory Storage so tests behave like a browser.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

// jsdom does not implement scrollIntoView.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
