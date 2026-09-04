import { NextResponse } from 'next/server';
import { compressToExactSize } from '@/lib/image-compression';
import { validateEvidenceBuffer } from '@/lib/security/file-validation';
import {
  EVIDENCE_HEAVY_REQUEST_BYTES,
  EVIDENCE_MAX_REQUEST_BYTES,
  checkEvidenceFile,
  extensionForUpload,
} from '@/lib/evidence-mime';
import { checkByteBudget, checkRateLimit, checkDbRateLimit, getClientIpFromRequest, verifyUploadToken } from '@/lib/security/rate-limit';
import { normalizeEvidenceSubmissionId, recordEvidenceUpload } from '@/lib/evidence-files';
import { compressEvidenceVideo } from '@/lib/video-compression';
import { deleteDriveFile, sha256Hex, uploadEvidenceToDrive } from '@/lib/google-drive';

const MAX_UPLOADS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW = 60 * 1000;

/**
 * This endpoint is unauthenticated, and it now accepts 25MB videos rather than
 * half-megabyte compressed photos. A plain request count is no longer a
 * meaningful control — five requests a minute is ~2.5MB of photos or 125MB of
 * video — so heavy uploads get their own, much tighter budget on top of the
 * generic limit. Video also costs CPU to re-encode, which the same gate caps.
 */
const HEAVY_WINDOW = 10 * 60 * 1000;
const MAX_HEAVY_UPLOADS_PER_WINDOW = 4;
const HEAVY_BYTE_BUDGET = 60 * 1024 * 1024;

function tooMany() {
  return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 });
}

export async function POST(request: Request) {
  let uploadedDriveFileId: string | null = null;

  try {

    const uploadToken = request.headers.get('x-upload-token');
    if (!uploadToken || !verifyUploadToken(uploadToken)) {
        return NextResponse.json(
            { error: 'Invalid or expired upload token. Request a new token from /api/uploads/evidence/token' },
            { status: 403 }
        );
    }

    const ip = getClientIpFromRequest(request);

    // Decided from the headers, before a single byte of the body is buffered:
    // an oversized or over-budget request should cost us nothing to refuse.
    //
    // A declared length is mandatory rather than defaulted. Metering a missing
    // one as the worst case still let the request through — `formData()` then
    // buffered a chunked body of *any* size into memory, so the size cap was
    // bypassable by simply omitting the header. Browsers always set it for a
    // multipart FormData body, so this costs real clients nothing.
    const contentLength = request.headers.get('content-length');
    if (contentLength === null) {
      return NextResponse.json({ error: 'Content-Length is required' }, { status: 411 });
    }

    const requestBytes = Number(contentLength);
    if (!Number.isSafeInteger(requestBytes) || requestBytes <= 0) {
      return NextResponse.json({ error: 'Invalid Content-Length' }, { status: 400 });
    }
    if (requestBytes > EVIDENCE_MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const memRl = checkRateLimit(`upload:${ip}`, MAX_UPLOADS_PER_WINDOW, RATE_LIMIT_WINDOW);
    if (!memRl.success) return tooMany();

    const dbRl = await checkDbRateLimit(`upload:${ip}`, MAX_UPLOADS_PER_WINDOW, RATE_LIMIT_WINDOW);
    if (!dbRl.success) return tooMany();

    if (requestBytes > EVIDENCE_HEAVY_REQUEST_BYTES) {
      const budget = checkByteBudget(`upload:bytes:${ip}`, requestBytes, HEAVY_BYTE_BUDGET, HEAVY_WINDOW);
      if (!budget.success) return tooMany();

      const heavyMem = checkRateLimit(`upload:heavy:${ip}`, MAX_HEAVY_UPLOADS_PER_WINDOW, HEAVY_WINDOW);
      if (!heavyMem.success) return tooMany();

      const heavyDb = await checkDbRateLimit(`upload:heavy:${ip}`, MAX_HEAVY_UPLOADS_PER_WINDOW, HEAVY_WINDOW);
      if (!heavyDb.success) return tooMany();
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const reporterEmail = String(form.get('reporter_email') || '').trim().toLowerCase();
    const reporterName = String(form.get('reporter_name') || '').trim();
    if (!reporterName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      return NextResponse.json({ error: 'Reporter name and valid email are required before upload' }, { status: 400 });
    }

    const check = checkEvidenceFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.tooLarge ? 413 : 400 });
    }
    const kind = check.kind;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateEvidenceBuffer(buffer, kind, file.type);
    if (!validation.valid) {
        return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 });
    }

    let compressedBuffer: Buffer;
    let contentType: string;
    let ext = extensionForUpload(kind, file.type, file.name);

    if (kind === 'image') {
      try {
        const result = await compressToExactSize(buffer);
        compressedBuffer = result.buffer;
        contentType = 'image/webp';
        ext = 'webp';
      } catch (error) {
        console.error('[PUBLIC UPLOAD] Compression failed:', error);
        return NextResponse.json({ error: 'Image processing failed' }, { status: 400 });
      }
    } else if (kind === 'video') {
      const result = await compressEvidenceVideo(buffer, file.type, ext);
      compressedBuffer = result.buffer;
      contentType = result.mimeType;
      ext = result.ext;
    } else {
      // Documents are stored byte-for-byte — re-encoding would corrupt them.
      compressedBuffer = buffer;
      contentType = file.type;
    }

    const submissionId = normalizeEvidenceSubmissionId(form.get('evidence_submission_id'));
    const originalBaseName = file.name.replace(/\.[^.]+$/, '') || 'evidence';
    const driveFileName = `${Date.now()}-${originalBaseName}.${ext}`;
    const driveFile = await uploadEvidenceToDrive({
      buffer: compressedBuffer,
      mimeType: contentType,
      originalName: driveFileName,
      submissionId,
      stationCode: String(form.get('station_code') || form.get('station_id') || 'PUBLIC'),
      reporterEmail,
      kind: 'evidence',
      appProperties: {
        upload_mode: 'public',
        quick_access_session_id: String(form.get('quick_access_session_id') || ''),
      },
    });
    uploadedDriveFileId = driveFile.fileId;

    const evidence = await recordEvidenceUpload({
      mode: 'public',
      submissionId,
      reporterEmail,
      reporterName,
      quickAccessSessionId: String(form.get('quick_access_session_id') || ''),
      googleDriveFileId: driveFile.fileId,
      googleDriveFolderId: driveFile.folderId,
      webViewLink: driveFile.webViewLink,
      webContentLink: driveFile.webContentLink,
      originalName: driveFile.name,
      mimeType: contentType,
      sizeBytes: compressedBuffer.length,
      sha256: sha256Hex(compressedBuffer),
      kind: 'evidence',
    });
    uploadedDriveFileId = null;

    return NextResponse.json({
      success: true,
      url: evidence.url,
      evidence_file_id: evidence.id,
      evidenceFileId: evidence.id,
      evidence_submission_id: evidence.submissionId,
      path: `drive://${driveFile.fileId}`,
      originalSize: file.size,
      compressedSize: compressedBuffer.length
    });
  } catch (e) {
    if (uploadedDriveFileId) {
      await deleteDriveFile(uploadedDriveFileId).catch((rollbackError) => {
        console.error('[UPLOAD_PUBLIC_EVIDENCE_ROLLBACK_ERROR]', rollbackError);
      });
    }
    console.error('[UPLOAD_PUBLIC_EVIDENCE_ERROR]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
