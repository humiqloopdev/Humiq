// src/hooks/index.ts
import { useState, useEffect, useRef } from 'react';

/* ── useDebounce ────────────────────────────────────────────── */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

/* ── useClickOutside ────────────────────────────────────────── */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  handler: (e: MouseEvent) => void
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler(e);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [handler]);
  return ref;
}

/* ── useLocalStorage ────────────────────────────────────────── */
export function useLocalStorage<T>(key: string, init: T): [T, (value: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });

  const set = (value: T) => {
    setVal(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return [val, set];
}
