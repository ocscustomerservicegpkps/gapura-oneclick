import 'server-only';

// Storage backend is now Supabase Storage. These functions keep the original
// "Drive" names and return shapes so every upload/serving route swaps over with
// zero changes. New files live in the `uploads` bucket. A read-only Google Drive
// fallback remains ONLY to serve legacy files that were never migrated (their
// ids are bare Drive ids without a "/"); storage paths always contain "/".

import { createHash } from 'crypto';
import { google } from 'googleapis';
import {
  deleteFromStorage,
  downloadFromStorage,
  documentPrefix,
  evidencePrefix,
  thumbnailPrefix,
  uploadToStorage,
} from '@/lib/supabase-storage';

export function sha256Hex(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function isStoragePath(idOrPath: string): boolean {
  return idOrPath.includes('/');
}

// ---- Legacy Google Drive read-only fallback (unmigrated files) -------------

let legacyDriveAuth: InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.OAuth2> | null = null;

function getLegacyDrive() {
  if (!legacyDriveAuth) {
    // Match the identity that originally uploaded the files (GOOGLE_DRIVE_AUTH_MODE),
    // otherwise Drive returns 404 for OAuth-owned files.
    const mode = process.env.GOOGLE_DRIVE_AUTH_MODE || 'service_account';
    if (mode === 'oauth') {
      const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN;
      if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing Google Drive OAuth credentials for legacy read');
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      legacyDriveAuth = auth;
    } else {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!email || !privateKey) throw new Error('Missing Google service account credentials for legacy Drive read');
      legacyDriveAuth = new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    }
  }
  return google.drive({ version: 'v3', auth: legacyDriveAuth });
}

// ---- Shared result shape (unchanged) ---------------------------------------

interface UploadEvidenceToDriveResult {
  fileId: string;        // now the Supabase Storage object path
  folderId: string;      // now the storage folder prefix
  webViewLink: string;   // public Supabase URL
  webContentLink: string | null;
  name: string;
}

// ---- Reads / deletes (storage-first, Drive fallback) -----------------------

export async function downloadDriveFile(idOrPath: string): Promise<Buffer> {
  if (isStoragePath(idOrPath)) {
    return downloadFromStorage(idOrPath);
  }
  const response = await getLegacyDrive().files.get(
    { fileId: idOrPath, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data as ArrayBuffer);
}

export async function deleteDriveFile(idOrPath: string): Promise<void> {
  if (isStoragePath(idOrPath)) {
    await deleteFromStorage(idOrPath);
    return;
  }
  // Legacy Drive originals are retained after migration — nothing to delete.
  console.warn(`[storage] deleteDriveFile skipped for legacy Drive id: ${idOrPath}`);
}

// ---- Uploads (fully Supabase Storage) --------------------------------------

interface UploadEvidenceToDriveInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  submissionId: string;
  stationCode?: string | null;
  reporterEmail?: string | null;
  userId?: string | null;
  kind: 'evidence' | 'document';
  appProperties?: Record<string, string | null | undefined>;
}

export async function uploadEvidenceToDrive(input: UploadEvidenceToDriveInput): Promise<UploadEvidenceToDriveResult> {
  const result = await uploadToStorage({
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalName: input.originalName,
    prefix: evidencePrefix(input.stationCode, input.submissionId),
  });
  return {
    fileId: result.path,
    folderId: result.folder,
    webViewLink: result.url,
    webContentLink: result.url,
    name: result.name,
  };
}

interface UploadPerformanceLinkThumbnailInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  linkId?: string;
  userId: string;
}

export async function uploadPerformanceLinkThumbnailToDrive(
  input: UploadPerformanceLinkThumbnailInput
): Promise<UploadEvidenceToDriveResult> {
  const result = await uploadToStorage({
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalName: input.originalName,
    prefix: thumbnailPrefix(),
  });
  return {
    fileId: result.path,
    folderId: result.folder,
    webViewLink: result.url,
    webContentLink: result.url,
    name: result.name,
  };
}

interface UploadDivisionDocumentToDriveInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  division: 'HC' | 'HT' | 'ANALYST';
  category: string;
  title: string;
  userId: string;
}

type UploadDivisionDocumentToDriveResult = UploadEvidenceToDriveResult;

export async function uploadDivisionDocumentToDrive(
  input: UploadDivisionDocumentToDriveInput
): Promise<UploadDivisionDocumentToDriveResult> {
  const result = await uploadToStorage({
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalName: input.originalName,
    prefix: documentPrefix(input.division, input.category),
  });
  return {
    fileId: result.path,
    folderId: result.folder,
    webViewLink: result.url,
    webContentLink: result.url,
    name: result.name,
  };
}
