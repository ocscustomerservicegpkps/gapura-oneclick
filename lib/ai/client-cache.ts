'use client';

/**
 * Client-side cache for the "AI Summary & Insight" panel (section summaries +
 * ML overview). Backed by sessionStorage so an answer survives switching
 * dashboard tabs (which unmounts the panel), navigating away and back, or a
 * full page reload — all without a re-request — while still clearing itself
 * when the tab/session ends. Cleared explicitly on logout via
 * clearAiClientCache() so it never leaks into the next user's session on a
 * shared machine.
 */

const PREFIX = 'gapura-ai-cache:v1:';

type CacheEntry<T> = { value: T; savedAt: number };

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    // Private browsing / storage disabled — cache is best-effort.
    return null;
  }
}

/** Deterministic short hash (djb2) so long context payloads make compact keys. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function buildCacheKey(namespace: string, seed: string): string {
  return `${PREFIX}${namespace}:${hash(seed)}`;
}

export function readClientCache<T>(key: string, maxAgeMs: number): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.savedAt !== 'number') return null;
    if (Date.now() - entry.savedAt > maxAgeMs) {
      s.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeClientCache<T>(key: string, value: T): void {
  const s = storage();
  if (!s) return;
  try {
    const entry: CacheEntry<T> = { value, savedAt: Date.now() };
    s.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or non-serializable value — cache is best-effort, ignore.
  }
}

/** Removes every AI-panel cache entry. Call on logout. */
export function clearAiClientCache(): void {
  const s = storage();
  if (!s) return;
  try {
    Object.keys(s)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => s.removeItem(key));
  } catch {
    // ignore
  }
}
