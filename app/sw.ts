
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import {
  PWA_CACHEABLE_PAGE_ROUTES,
  PWA_DYNAMIC_CACHE_PREFIXES,
  PWA_QUEUE_EVENT,
  PWA_SYNC_TAG,
} from "@/lib/pwa/constants";
import {
  EMPTY_OFFLINE_QUEUE_SUMMARY,
  getOfflineQueueSummary,
  isIndexedDbUnavailableError,
  processOfflineQueue,
} from "@/lib/pwa/offline-queue-core";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const LEGACY_PROTECTED_CACHE_NAMES = [
  "gapura-pages",
  "gapura-readonly-apis",
  "gapura-documents",
  "gapura-next-image",
  "gapura-images",
] as const;

function sameOriginNotificationPath(value: string | undefined): string {
  try {
    const url = new URL(value || "/", self.location.origin);
    if (url.origin !== self.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    navigateFallback: "/offline",
    navigateFallbackDenylist: [/^\/api\//, /^\/_next\//],
  },
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, request, url }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        PWA_CACHEABLE_PAGE_ROUTES.includes(url.pathname),
      handler: new NetworkFirst({
        cacheName: "gapura-pages-v2",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: /\/_next\/image\?url=.+$/i,
      handler: new StaleWhileRevalidate({
        cacheName: "gapura-next-image-v2",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, request, url }) => {
        if (request.method !== "GET") {
          return false;
        }

        return (
          request.destination === "image" ||
          (sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname))
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: "gapura-images-v2",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 96,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(LEGACY_PROTECTED_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }

  if (event.data?.type === "PURGE_RUNTIME_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => PWA_DYNAMIC_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
            .map((key) => caches.delete(key))
        )
      )
    );
    return;
  }

  if (event.data?.type === "SYNC_REPORT_QUEUE") {
    event.waitUntil(syncOfflineQueue());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === PWA_SYNC_TAG) {
    event.waitUntil(syncOfflineQueue());
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title?: string; body?: string; url?: string };
  const notificationPath = sameOriginNotificationPath(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title ?? "OneClick", {
      body: data.body,
      icon: "/icons/pwa-192.png",
      badge: "/icons/pwa-192-maskable.png",
      data: { url: notificationPath },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sameOriginNotificationPath(
    (event.notification.data as { url?: string })?.url
  );
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.startsWith(self.location.origin));
        if (existing) return existing.navigate(url).then((c) => c?.focus());
        return self.clients.openWindow(url);
      })
  );
});

async function syncOfflineQueue() {
  let summary = EMPTY_OFFLINE_QUEUE_SUMMARY;

  try {
    await processOfflineQueue();
    summary = await getOfflineQueueSummary();
  } catch (error) {
    if (!isIndexedDbUnavailableError(error)) {
      throw error;
    }
  }

  const clients = await self.clients.matchAll({ type: "window" });

  clients.forEach((client) => {
    client.postMessage({
      type: PWA_QUEUE_EVENT,
      summary,
    });
  });
}
