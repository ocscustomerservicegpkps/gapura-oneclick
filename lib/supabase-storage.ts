import 'server-only';

import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const STORAGE_BUCKET = 'uploads';

// Largest edge we keep. Real-world evidence photos rarely need more, and
// capping is the single biggest size win while staying visually identical.
const MAX_EDGE = 2560;
// Quality tuned for "keep the format, drop the bytes, don't visibly degrade".
const JPEG_QUALITY = 72;
const WEBP_QUALITY = 72;

function extFromName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : '';
}

function sanitizeSegment(value: string, fallback: string): string {
  const safe = value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return safe || fallback;
}

export interface CompressedUpload {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

/**
 * Compress before upload while keeping the original format. Images are
 * re-encoded (mozjpeg / palette-png / webp), stripped of metadata, and capped
 * at MAX_EDGE — significant size reduction with no visible quality loss.
 * Non-images (PDF/DOCX/…) and vector/animated images pass through untouched.
 */
export async function compressForUpload(buffer: Buffer, mimeType: string, originalName: string): Promise<CompressedUpload> {
  const mime = (mimeType || '').toLowerCase();
  const passthrough: CompressedUpload = { buffer, mimeType: mimeType || 'application/octet-stream', ext: extFromName(originalName) || 'bin' };

  // Never touch non-raster images or animations.
  if (!mime.startsWith('image/') || mime.includes('svg') || mime.includes('gif')) {
    return passthrough;
  }

  try {
    const pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // honour EXIF orientation, then drop metadata
    const meta = await pipeline.metadata();
    if ((meta.width || 0) > MAX_EDGE || (meta.height || 0) > MAX_EDGE) {
      pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
    }

    // Always return the re-encoded output, even if it isn't smaller: the
    // pipeline's job is metadata stripping (EXIF/GPS) as much as size, and
    // evidence photos in particular must not leak location/device metadata
    // through a "smaller original wins" passthrough.
    if (mime.includes('png')) {
      const out = await pipeline.png({ compressionLevel: 9, palette: true, quality: 90, effort: 8 }).toBuffer();
      return { buffer: out, mimeType: 'image/png', ext: 'png' };
    }
    if (mime.includes('webp')) {
      const out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      return { buffer: out, mimeType: 'image/webp', ext: 'webp' };
    }
    // jpeg/jpg and everything else raster (incl. heic/heif) -> jpeg
    const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { buffer: out, mimeType: 'image/jpeg', ext: 'jpg' };
  } catch {
    // Corrupt/unsupported image — store the original rather than fail the upload.
    return passthrough;
  }
}

function publicUrl(path: string): string {
  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Groundwork for moving evidence buckets to private. Generates a short-lived
// signed URL from a stored object path so read access can be revoked from the
// bucket without breaking rendering. TTL defaults to 1 hour.
export async function signedUrl(
  path: string,
  { bucket = STORAGE_BUCKET, expiresIn = 3600 }: { bucket?: string; expiresIn?: number } = {},
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

export interface StorageUploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  /** Directory prefix inside the bucket, e.g. "evidence/2026/07/CGK/<submission>". */
  prefix: string;
}

export interface StorageUploadResult {
  path: string;
  folder: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadToStorage(input: StorageUploadInput): Promise<StorageUploadResult> {
  const compressed = await compressForUpload(input.buffer, input.mimeType, input.originalName);
  const baseName = input.originalName.replace(/\.[a-z0-9]+$/i, '');
  const safeBase = sanitizeSegment(baseName, 'file');
  const folder = input.prefix.replace(/^\/+|\/+$/g, '');
  const path = `${folder}/${randomUUID()}-${safeBase}.${compressed.ext}`;

  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, compressed.buffer, {
    contentType: compressed.mimeType,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return {
    path,
    folder,
    url: publicUrl(path),
    name: `${safeBase}.${compressed.ext}`,
    size: compressed.buffer.length,
    mimeType: compressed.mimeType,
  };
}

export async function downloadFromStorage(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message || 'not found'}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromStorage(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

// Path builders — keep the same folder semantics the Drive layout used.
export function evidencePrefix(stationCode: string | null | undefined, submissionId: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `evidence/${yyyy}/${mm}/${sanitizeSegment(stationCode || 'UNKNOWN_STATION', 'UNKNOWN_STATION')}/${sanitizeSegment(submissionId, 'submission')}`;
}

export function documentPrefix(division: string, category: string): string {
  const year = String(new Date().getUTCFullYear());
  return `documents/${sanitizeSegment(division, 'division')}/${year}/${sanitizeSegment(category, 'documents')}`;
}

export function thumbnailPrefix(): string {
  return 'thumbnails';
}
