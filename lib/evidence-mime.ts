/**
 * Single source of truth for what may be attached as report evidence.
 *
 * Imported by both the browser forms (`accept` filter + pre-flight checks) and
 * the upload routes (server-side allowlist), so the two can never drift apart
 * and leave the user with a picker that offers files the API rejects.
 *
 * This file must stay isomorphic — no `server-only`, no node builtins.
 */

export type EvidenceKind = 'image' | 'video' | 'document';

/**
 * Per-kind size caps. `document`/`video` are pinned to the Supabase `uploads`
 * bucket's own `file_size_limit` (25 MiB) — anything larger is rejected by
 * storage after the request body has already been transferred, so we fail fast
 * here instead.
 */
export const EVIDENCE_MAX_BYTES: Record<EvidenceKind, number> = {
  image: 10 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

/**
 * Largest multipart body worth reading at all: the biggest allowed file plus
 * room for boundaries and the accompanying form fields. Lets a route refuse an
 * oversized request from its `Content-Length` alone, before the body is
 * buffered into memory.
 */
export const EVIDENCE_MAX_REQUEST_BYTES = Math.max(...Object.values(EVIDENCE_MAX_BYTES)) + 1024 * 1024;

/**
 * Above this, a request is treated as a heavy upload and metered separately.
 * Images arrive canvas-compressed at a few hundred KB, so anything past 2MB is
 * video, a document, or someone bypassing the client — all of which cost real
 * bandwidth and (for video) real CPU.
 */
export const EVIDENCE_HEAVY_REQUEST_BYTES = 2 * 1024 * 1024;

/**
 * MIME -> kind. Browsers disagree about several of these (`.mov` is variously
 * `video/quicktime`, `video/mp4` or empty; `.csv` is often
 * `application/vnd.ms-excel`), so `EXTENSION_KINDS` below backs it up.
 */
const MIME_KINDS: Record<string, EvidenceKind> = {
  'image/jpeg': 'image',
  'image/pjpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/heic': 'image',
  'image/heif': 'image',

  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'video/x-matroska': 'video',
  'video/x-msvideo': 'video',
  'video/avi': 'video',
  'video/3gpp': 'video',
  'video/mpeg': 'video',

  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  'text/csv': 'document',
  'text/plain': 'document',
};

const EXTENSION_KINDS: Record<string, EvidenceKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  bmp: 'image', tif: 'image', tiff: 'image', heic: 'image', heif: 'image',

  mp4: 'video', m4v: 'video', mov: 'video', webm: 'video', mkv: 'video',
  avi: 'video', '3gp': 'video', mpeg: 'video', mpg: 'video',

  pdf: 'document', doc: 'document', docx: 'document', xls: 'document',
  xlsx: 'document', ppt: 'document', pptx: 'document', rtf: 'document',
  csv: 'document', txt: 'document',
};

/** Value for an `<input type="file" accept>`: MIME types plus extensions, because mobile pickers honour only one or the other. */
export const EVIDENCE_ACCEPT = [
  ...Object.keys(MIME_KINDS),
  ...Object.keys(EXTENSION_KINDS).map((ext) => `.${ext}`),
].join(',');

export const EVIDENCE_HINT = 'Images, videos, and documents (PDF, Word, Excel, PowerPoint) — 10 MB per image, 25 MB per video or document.';

export function extensionOf(fileName?: string | null): string {
  const path = String(fileName || '').split('?')[0].split('#')[0];
  const match = /\.([a-z0-9]+)$/i.exec(path.trim());
  return match ? match[1].toLowerCase() : '';
}

/** `null` means "not an allowed evidence type". */
export function classifyEvidence(mimeType?: string | null, fileName?: string | null): EvidenceKind | null {
  const mime = String(mimeType || '').trim().toLowerCase().split(';')[0];
  if (mime && MIME_KINDS[mime]) return MIME_KINDS[mime];
  const ext = extensionOf(fileName);
  if (ext && EXTENSION_KINDS[ext]) return EXTENSION_KINDS[ext];
  return null;
}

/** Best-effort kind for an already-stored evidence URL — extension only, since the MIME is not in hand. */
export function evidenceKindFromUrl(url?: string | null): EvidenceKind | null {
  const ext = extensionOf(url);
  return (ext && EXTENSION_KINDS[ext]) || null;
}

export function formatMaxSize(kind: EvidenceKind): string {
  return `${Math.round(EVIDENCE_MAX_BYTES[kind] / (1024 * 1024))} MB`;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi', 'video/avi': 'avi', 'video/3gpp': '3gp', 'video/mpeg': 'mpeg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/rtf': 'rtf', 'text/rtf': 'rtf', 'text/csv': 'csv', 'text/plain': 'txt',
};

const KIND_FALLBACK_EXTENSIONS: Record<EvidenceKind, string> = { image: 'jpg', video: 'mp4', document: 'pdf' };

/**
 * The extension the stored object should carry. The uploaded filename is only
 * trusted when its extension is itself on the allowlist *for the resolved
 * kind* — otherwise a `report.html` declared as `text/plain` would be stored
 * under an extension we never meant to serve.
 */
export function extensionForUpload(kind: EvidenceKind, mimeType?: string | null, fileName?: string | null): string {
  const ext = extensionOf(fileName);
  if (ext && EXTENSION_KINDS[ext] === kind) return ext;

  const mime = String(mimeType || '').trim().toLowerCase().split(';')[0];
  const fromMime = MIME_EXTENSIONS[mime];
  if (fromMime && EXTENSION_KINDS[fromMime] === kind) return fromMime;

  return KIND_FALLBACK_EXTENSIONS[kind];
}

export interface EvidenceCheck {
  ok: boolean;
  /** `null` only when the type was rejected outright. */
  kind: EvidenceKind | null;
  error?: string;
  /** Distinguishes "too big" (413) from "wrong type" (400) at the API boundary. */
  tooLarge?: boolean;
}

/**
 * Pre-flight check shared by the forms and the API routes: is this an allowed
 * type, and is it within that type's size cap?
 */
export function checkEvidenceFile(file: { name?: string; type?: string; size?: number }): EvidenceCheck {
  const name = file.name || 'file';
  const kind = classifyEvidence(file.type, name);
  if (!kind) {
    return {
      ok: false,
      kind: null,
      tooLarge: false,
      error: `${name}: unsupported file type. Allowed: images, videos, PDF, Word, Excel, PowerPoint, and text files.`,
    };
  }

  const max = EVIDENCE_MAX_BYTES[kind];
  if (typeof file.size === 'number' && file.size > max) {
    return { ok: false, kind, tooLarge: true, error: `${name}: ${kind} exceeds ${formatMaxSize(kind)}.` };
  }

  return { ok: true, kind };
}
