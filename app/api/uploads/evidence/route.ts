
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { compressToExactSize } from '@/lib/image-compression';
import { validateEvidenceBuffer } from '@/lib/security/file-validation';
import { checkEvidenceFile, extensionForUpload } from '@/lib/evidence-mime';
import { normalizeEvidenceSubmissionId, recordEvidenceUpload } from '@/lib/evidence-files';
import { compressEvidenceVideo } from '@/lib/video-compression';
import { deleteDriveFile, sha256Hex, uploadEvidenceToDrive } from '@/lib/google-drive';

export async function POST(request: Request) {
  let uploadedDriveFileId: string | null = null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifySession(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
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
        console.warn(`[UPLOAD] File validation failed: ${validation.error}`);
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
        console.error('[UPLOAD] Compression failed, using original:', error);
        compressedBuffer = buffer;
        contentType = file.type;
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
      stationCode: String(form.get('station_code') || form.get('station_id') || payload.station_id || 'INTERNAL'),
      reporterEmail: payload.email || null,
      userId: payload.id || null,
      kind: 'evidence',
      appProperties: {
        upload_mode: 'internal',
      },
    });
    uploadedDriveFileId = driveFile.fileId;

    const evidence = await recordEvidenceUpload({
      mode: 'internal',
      submissionId,
      userId: payload.id || null,
      reporterEmail: payload.email || null,
      reporterName: String(form.get('reporter_name') || payload.full_name || ''),
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
        console.error('[UPLOAD_TEMP_EVIDENCE_ROLLBACK_ERROR]', rollbackError);
      });
    }
    console.error('[UPLOAD_TEMP_EVIDENCE_ERROR]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
