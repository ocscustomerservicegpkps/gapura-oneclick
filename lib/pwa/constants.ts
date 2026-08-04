
export const PWA_VERSION = "2026-04-cachefix";

export const PWA_STORAGE_PREFIX = "gapura-pwa";

export const PWA_DB_NAME = `${PWA_STORAGE_PREFIX}-${PWA_VERSION}`;

export const PWA_DB_VERSION = 1;

export const PWA_QUEUE_STORE = "report-queue";

export const PWA_AUTH_SCOPE_KEY = `${PWA_STORAGE_PREFIX}:auth-scope`;

export const PWA_QUEUE_EVENT = "gapura:pwa-queue-updated";

export const PWA_SYNC_TAG = "gapura-report-queue";

export const PWA_CACHEABLE_PAGE_ROUTES = [
  "/",
  "/auth/login",
  "/auth/public-report",
  "/offline",
];

export const PWA_DYNAMIC_CACHE_PREFIXES = [
  "gapura-pages",
  "gapura-images",
  "gapura-documents",
  "gapura-readonly-apis",
  "gapura-rsc",
  "gapura-next-image",
];
