import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'ehsbha.chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

function chunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const message = (err as { message?: string }).message ?? '';
  const name = (err as { name?: string }).name ?? '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)
  );
}

async function recoverFromStaleShell(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    } catch {
      // ignore — best effort
    }
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    // ignore
  }
  window.location.reload();
}

/**
 * Wraps a dynamic import so that a chunk-load failure (typically caused by a
 * stale service worker shell pointing at deleted hashed chunks after a deploy)
 * recovers automatically by unregistering the SW and hard-reloading once.
 * A cooldown guards against reload loops if the import is genuinely broken.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!chunkLoadError(err)) throw err;

      const last = Number(window.sessionStorage.getItem(RELOAD_KEY)) || 0;
      const now = Date.now();
      if (now - last < RELOAD_COOLDOWN_MS) {
        // Already tried recently — surface the error to the route boundary
        throw err;
      }
      window.sessionStorage.setItem(RELOAD_KEY, String(now));
      await recoverFromStaleShell();
      // Block React from rendering an error UI while the page reloads
      return new Promise<{ default: T }>(() => {});
    }
  });
}
