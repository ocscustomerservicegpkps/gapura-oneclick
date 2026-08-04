
"use client";

import {
  PWA_AUTH_SCOPE_KEY,
  PWA_DB_NAME,
  PWA_DYNAMIC_CACHE_PREFIXES,
  PWA_STORAGE_PREFIX,
  PWA_VERSION,
} from "@/lib/pwa/constants";

export function getPwaAuthScope() {
  if (typeof window === "undefined") {
    return "guest";
  }

  return localStorage.getItem(PWA_AUTH_SCOPE_KEY) || "guest";
}

export function setPwaAuthScope(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(PWA_AUTH_SCOPE_KEY, scope || "guest");
}

export function buildPwaScopedStorageKey(base: string) {
  return `${PWA_STORAGE_PREFIX}:${PWA_VERSION}:${getPwaAuthScope()}:${base}`;
}

function isPwaStorageKey(key: string) {
  return key.startsWith(`${PWA_STORAGE_PREFIX}:`);
}

export function purgePwaClientState() {
  if (typeof window === "undefined") {
    return;
  }

  const lsKeys = Object.keys(localStorage).filter((key) => isPwaStorageKey(key) || key === PWA_AUTH_SCOPE_KEY);
  const ssKeys = Object.keys(sessionStorage).filter(
    (key) => key.startsWith(PWA_STORAGE_PREFIX) || key.startsWith("gapura:pwa-")
  );

  if (lsKeys.length || ssKeys.length) {
    queueMicrotask(() => {
      lsKeys.forEach((key) => localStorage.removeItem(key));
      ssKeys.forEach((key) => sessionStorage.removeItem(key));
    });
  }

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "PURGE_RUNTIME_CACHE" });
  }

  if ("indexedDB" in window) {
    try {
      indexedDB.deleteDatabase(PWA_DB_NAME);
    } catch {

    }
  }

  if ("caches" in window) {
    caches.keys().then((cacheKeys) => {
      Promise.all(
        cacheKeys
          .filter((key) => PWA_DYNAMIC_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))
      ).catch(() => {

      });
    }).catch(() => {

    });
  }
}
