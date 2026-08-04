
"use client";

import {
  PWA_QUEUE_EVENT,
  PWA_SYNC_TAG,
} from "@/lib/pwa/constants";
import { getPwaAuthScope } from "@/lib/pwa/client-state";
import {
  EMPTY_OFFLINE_QUEUE_SUMMARY,
  enqueueOfflineReport,
  getOfflineQueueSummary,
  isIndexedDbUnavailableError,
  processOfflineQueue,
  toOfflineAttachments,
  type EnqueueOfflineReportInput,
} from "@/lib/pwa/offline-queue-core";

function dispatchQueueUpdate(summary: Awaited<ReturnType<typeof getOfflineQueueSummary>>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(PWA_QUEUE_EVENT, { detail: summary }));
}

export async function refreshOfflineQueueSummary() {
  try {
    const summary = await getOfflineQueueSummary();
    dispatchQueueUpdate(summary);
    return summary;
  } catch (error) {
    if (isIndexedDbUnavailableError(error)) {
      dispatchQueueUpdate(EMPTY_OFFLINE_QUEUE_SUMMARY);
      return EMPTY_OFFLINE_QUEUE_SUMMARY;
    }

    throw error;
  }
}

export async function queueOfflineReport(
  input: Omit<EnqueueOfflineReportInput, "scope" | "attachments"> & { attachments: File[] }
) {
  try {
    const item = await enqueueOfflineReport({
      ...input,
      scope: getPwaAuthScope(),
      attachments: toOfflineAttachments(input.attachments),
    });

    await refreshOfflineQueueSummary();
    await registerOfflineSync();
    return item;
  } catch (error) {
    if (isIndexedDbUnavailableError(error)) {
      throw new Error(
        "Penyimpanan offline tidak tersedia di browser ini. Sambungkan internet untuk mengirim laporan."
      );
    }

    throw error;
  }
}

export async function processOfflineQueueWithEvents() {
  try {
    const result = await processOfflineQueue();
    await refreshOfflineQueueSummary();
    return result;
  } catch (error) {
    if (isIndexedDbUnavailableError(error)) {
      dispatchQueueUpdate(EMPTY_OFFLINE_QUEUE_SUMMARY);
      return {
        processed: 0,
        synced: 0,
        failed: 0,
      };
    }

    throw error;
  }
}

export async function registerOfflineSync() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("SyncManager" in window)
  ) {
    return;
  }

  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: {
        register: (tag: string) => Promise<void>;
      };
    };
    await registration.sync?.register(PWA_SYNC_TAG);
  } catch {

  }
}
