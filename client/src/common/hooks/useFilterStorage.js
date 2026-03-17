import { useCallback } from "react";

const STORAGE_PREFIX = "decktrack.filters.";

/**
 * Persist and restore filter state per page to localStorage.
 */
export function useFilterStorage(pageKey) {
  const save = useCallback((filters) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(filters));
    } catch { /* quota exceeded */ }
  }, [pageKey]);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + pageKey);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [pageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + pageKey);
    } catch { /* ignore */ }
  }, [pageKey]);

  return { save, load, clear };
}
