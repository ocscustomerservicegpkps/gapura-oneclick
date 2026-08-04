
import {
  PWA_DB_NAME,
  PWA_DB_VERSION,
  PWA_QUEUE_STORE,
} from "@/lib/pwa/constants";

type OfflineQueueStatus = "queued" | "syncing" | "synced" | "failed";

type OfflineQueueKind = "internal-report" | "public-report";

interface OfflineAttachment {

  id: string;

  name: string;

  type: string;

  size: number;

  lastModified: number;

  blob: Blob;
}

interface OfflineQueueItem {

  id: string;

  kind: OfflineQueueKind;

  scope: string;

  endpoint: string;

  uploadEndpoint: string;

  reportPayload: Record<string, unknown>;

  attachments: OfflineAttachment[];

  status: OfflineQueueStatus;

  createdAt: number;

  updatedAt: number;

  lastSyncedAt: number | null;

  attemptCount: number;

  error: string | null;

  responseData?: Record<string, unknown> | null;
}

interface OfflineQueueSummary {

  queued: number;

  syncing: number;

  failed: number;

  synced: number;

  total: number;
}

export interface EnqueueOfflineReportInput {

  kind: OfflineQueueKind;

  scope: string;

  endpoint: string;

  uploadEndpoint: string;

  reportPayload: Record<string, unknown>;

  attachments: OfflineAttachment[];
}

interface ProcessOfflineQueueResult {

  processed: number;

  synced: number;

  failed: number;
}

const SYNCED_RETENTION_MS = 1000 * 60 * 60 * 24;

export const EMPTY_OFFLINE_QUEUE_SUMMARY: OfflineQueueSummary = {
  queued: 0,
  syncing: 0,
  failed: 0,
  synced: 0,
  total: 0,
};

export function isIndexedDbUnavailableError(error: unknown) {
  if (error instanceof DOMException) {
    if (
      error.name === "UnknownError" ||
      error.name === "InvalidStateError" ||
      error.name === "SecurityError" ||
      error.name === "QuotaExceededError" ||
      error.name === "NotReadableError"
    ) {
      return true;
    }
  }

  if (error instanceof Error) {
    const message = `${error.name} ${error.message}`.toLowerCase();
    return (
      message.includes("indexeddb") ||
      message.includes("backing store") ||
      message.includes("not available") ||
      message.includes("not tersedia")
    );
  }

  return false;
}

function ensureIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB tidak tersedia di browser ini.");
  }
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openQueueDb(): Promise<IDBDatabase> {
  ensureIndexedDb();

  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(PWA_DB_NAME, PWA_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PWA_QUEUE_STORE)) {
          const store = db.createObjectStore(PWA_QUEUE_STORE, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

async function getStore(mode: IDBTransactionMode) {
  const db = await openQueueDb();
  const transaction = db.transaction(PWA_QUEUE_STORE, mode);
  const store = transaction.objectStore(PWA_QUEUE_STORE);
  return { db, transaction, store };
}

function buildAttachmentDescriptor(file: File): OfflineAttachment {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
  };
}

export function toOfflineAttachments(files: File[]) {
  return files.map(buildAttachmentDescriptor);
}

async function listOfflineQueueItems() {
  const { db, store } = await getStore("readonly");
  try {
    const items = await requestToPromise(store.getAll());
    return (items || []).sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function getOfflineQueueSummary(): Promise<OfflineQueueSummary> {
  const items = await listOfflineQueueItems();
  return items.reduce<OfflineQueueSummary>(
    (summary, item) => {
      summary[item.status] += 1;
      summary.total += 1;
      return summary;
    },
    { ...EMPTY_OFFLINE_QUEUE_SUMMARY }
  );
}

export async function enqueueOfflineReport(input: EnqueueOfflineReportInput) {
  const now = Date.now();
  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    kind: input.kind,
    scope: input.scope,
    endpoint: input.endpoint,
    uploadEndpoint: input.uploadEndpoint,
    reportPayload: input.reportPayload,
    attachments: input.attachments,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: null,
    attemptCount: 0,
    error: null,
    responseData: null,
  };

  const { db, transaction, store } = await getStore("readwrite");
  try {
    store.put(item);
    await txDone(transaction);
    return item;
  } finally {
    db.close();
  }
}

async function saveOfflineQueueItem(item: OfflineQueueItem) {
  const { db, transaction, store } = await getStore("readwrite");
  try {
    store.put(item);
    await txDone(transaction);
    return item;
  } finally {
    db.close();
  }
}

async function deleteOfflineQueueItem(id: string) {
  const { db, transaction, store } = await getStore("readwrite");
  try {
    store.delete(id);
    await txDone(transaction);
  } finally {
    db.close();
  }
}

async function cleanupOfflineQueue() {
  const items = await listOfflineQueueItems();
  const expiry = Date.now() - SYNCED_RETENTION_MS;

  await Promise.all(
    items
      .filter((item) => item.status === "synced" && (item.lastSyncedAt || 0) < expiry)
      .map((item) => deleteOfflineQueueItem(item.id))
  );
}

function clonePayload<T extends Record<string, unknown>>(payload: T): T {
  return JSON.parse(JSON.stringify(payload));
}

async function parseErrorResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    return json?.error || json?.message || `HTTP ${response.status}`;
  }

  const text = await response.text().catch(() => "");
  return text || `HTTP ${response.status}`;
}

async function replayOfflineQueueItem(item: OfflineQueueItem) {
  const payload = clonePayload(item.reportPayload);
  const evidenceSubmissionId = String(payload.evidence_submission_id || item.id);
  const uploadedUrls = Array.isArray(payload.evidence_urls)
    ? [...payload.evidence_urls]
    : [];
  const uploadedFileIds = Array.isArray(payload.evidence_file_ids)
    ? [...payload.evidence_file_ids].map(String)
    : [];

  for (const attachment of item.attachments) {
    const formData = new FormData();
    formData.append("file", attachment.blob, attachment.name);
    formData.append("evidence_submission_id", evidenceSubmissionId);
    if (payload.reporter_name) formData.append("reporter_name", String(payload.reporter_name));
    if (payload.reporter_email) formData.append("reporter_email", String(payload.reporter_email));
    if (payload.station_id) formData.append("station_id", String(payload.station_id));
    if (payload.station_code) formData.append("station_code", String(payload.station_code));
    if (payload.quick_access_session_id) {
      formData.append("quick_access_session_id", String(payload.quick_access_session_id));
    }

    const headers: Record<string, string> = {};
    if (item.uploadEndpoint.includes("/public")) {
      const tokenResponse = await fetch("/api/uploads/evidence/token");
      if (!tokenResponse.ok) {
        throw new Error(await parseErrorResponse(tokenResponse));
      }
      const tokenData = await tokenResponse.json().catch(() => null);
      if (!tokenData?.token) {
        throw new Error("Upload evidence offline gagal: token tidak ditemukan.");
      }
      headers["X-Upload-Token"] = tokenData.token;
    }

    const uploadResponse = await fetch(item.uploadEndpoint, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(await parseErrorResponse(uploadResponse));
    }

    const uploadData = await uploadResponse.json();
    if (!uploadData?.url) {
      throw new Error("Upload evidence offline gagal: URL tidak ditemukan.");
    }

    uploadedUrls.push(uploadData.url);
    if (uploadData.evidence_file_id || uploadData.evidenceFileId) {
      uploadedFileIds.push(String(uploadData.evidence_file_id || uploadData.evidenceFileId));
    }
  }

  if (uploadedUrls.length > 0) {
    payload.evidence_urls = uploadedUrls;
    payload.evidence_url = uploadedUrls[0];
  }
  if (uploadedFileIds.length > 0) {
    payload.evidence_file_ids = [...new Set(uploadedFileIds)];
  }
  payload.evidence_submission_id = evidenceSubmissionId;

  const response = await fetch(item.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const responseData = await response.json().catch(() => null);
  return { payload, responseData };
}

export async function processOfflineQueue() {
  const items = await listOfflineQueueItems();
  const pendingItems = items.filter(
    (item) => item.status === "queued" || item.status === "failed"
  );

  let synced = 0;
  let failed = 0;

  for (const item of pendingItems) {
    item.status = "syncing";
    item.updatedAt = Date.now();
    item.error = null;
    await saveOfflineQueueItem(item);

    try {
      const { responseData } = await replayOfflineQueueItem(item);
      item.status = "synced";
      item.updatedAt = Date.now();
      item.lastSyncedAt = Date.now();
      item.error = null;
      item.responseData = responseData;
      item.attemptCount += 1;
      await saveOfflineQueueItem(item);
      synced += 1;
    } catch (error) {
      item.status = "failed";
      item.updatedAt = Date.now();
      item.error = error instanceof Error ? error.message : "Sinkronisasi gagal";
      item.attemptCount += 1;
      await saveOfflineQueueItem(item);
      failed += 1;
    }
  }

  await cleanupOfflineQueue();

  return {
    processed: pendingItems.length,
    synced,
    failed,
  } satisfies ProcessOfflineQueueResult;
}
