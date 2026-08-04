import { NextResponse } from 'next/server';
import { compressToExactSize } from '@/lib/image-compression';
import { validateImageFile } from '@/lib/security/file-validation';
import { checkRateLimit, checkDbRateLimit, getClientIpFromRequest, verifyUploadToken } from '@/lib/security/rate-limit';
import { normalizeEvidenceSubmissionId, recordEvidenceUpload } from '@/lib/evidence-files';
import { deleteDriveFile, sha256Hex, uploadEvidenceToDrive } from '@/lib/google-drive';

const MAX_UPLOADS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW = 60 * 1000;

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
    const memRl = checkRateLimit(`upload:${ip}`, MAX_UPLOADS_PER_WINDOW, RATE_LIMIT_WINDOW);
    if (!memRl.success) {
        return NextResponse.json(
            { error: 'Too many uploads. Please try again later.' },
            { status: 429 }
        );
    }

    const dbRl = await checkDbRateLimit(`upload:${ip}`, MAX_UPLOADS_PER_WINDOW, RATE_LIMIT_WINDOW);
    if (!dbRl.success) {
        return NextResponse.json(
            { error: 'Too many uploads. Please try again later.' },
            { status: 429 }
        );
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

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateImageFile(buffer, file.type);
    if (!validation.valid) {
        return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    let compressedBuffer: Buffer;
    let contentType: string;

    try {
      const result = await compressToExactSize(buffer);
      compressedBuffer = result.buffer;
      contentType = 'image/webp';
    } catch (error) {
      console.error('[PUBLIC UPLOAD] Compression failed:', error);
      return NextResponse.json({ error: 'Image processing failed' }, { status: 400 });
    }

    const submissionId = normalizeEvidenceSubmissionId(form.get('evidence_submission_id'));
    const originalBaseName = file.name.replace(/\.[^.]+$/, '') || 'evidence';
    const driveFileName = `${Date.now()}-${originalBaseName}.webp`;
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
