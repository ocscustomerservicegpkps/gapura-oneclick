import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { normalizeEvidenceSubmissionId, recordEvidenceUpload } from '@/lib/evidence-files';
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

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const validExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return NextResponse.json({ error: 'Only PDF, Word, Excel, and PowerPoint files are allowed' }, { status: 400 });
    }

    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
    }


    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = extension || 'tmp';
    const rawBaseName = file.name.replace(/\.[^.]+$/, '') || 'document';
    const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 90);
    const fileName = `${Date.now()}-${safeBaseName}.${ext}`;
    const reportId = String(form.get('reportId') || '').trim();
    const submissionId = normalizeEvidenceSubmissionId(form.get('evidence_submission_id') || reportId);
    const contentType = file.type || 'application/octet-stream';
    const driveFile = await uploadEvidenceToDrive({
      buffer,
      mimeType: contentType,
      originalName: fileName,
      submissionId,
      stationCode: String(form.get('station_code') || payload.station_id || 'DOCUMENT'),
      reporterEmail: payload.email || null,
      userId: payload.id || null,
      kind: 'document',
      appProperties: {
        upload_mode: 'internal_document',
        report_id: reportId,
      },
    });
    uploadedDriveFileId = driveFile.fileId;

    const evidence = await recordEvidenceUpload({
      mode: 'internal',
      submissionId,
      userId: payload.id || null,
      reporterEmail: payload.email || null,
      reporterName: payload.full_name || null,
      googleDriveFileId: driveFile.fileId,
      googleDriveFolderId: driveFile.folderId,
      webViewLink: driveFile.webViewLink,
      webContentLink: driveFile.webContentLink,
      originalName: driveFile.name,
      mimeType: contentType,
      sizeBytes: buffer.length,
      sha256: sha256Hex(buffer),
      kind: 'document',
      status: reportId ? 'linked' : 'uploaded_pending_report',
      reportSheetId: reportId || null,
      reportId: reportId || null,
    });
    uploadedDriveFileId = null;

    return NextResponse.json({ 
      success: true, 
      url: evidence.url,
      evidence_file_id: evidence.id,
      evidenceFileId: evidence.id,
      evidence_submission_id: evidence.submissionId,
      path: `drive://${driveFile.fileId}`,
      name: file.name,
      size: file.size
    });
  } catch (e) {
    if (uploadedDriveFileId) {
      await deleteDriveFile(uploadedDriveFileId).catch((rollbackError) => {
        console.error('[UPLOAD_DOCUMENT_ROLLBACK_ERROR]', rollbackError);
      });
    }
    console.error('[UPLOAD_DOCUMENT_ERROR]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
