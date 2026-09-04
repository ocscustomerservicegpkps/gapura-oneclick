
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { compressToExactSize } from '@/lib/image-compression';
import { checkEvidenceFile, extensionForUpload } from '@/lib/evidence-mime';
import { validateEvidenceBuffer } from '@/lib/security/file-validation';
import { compressEvidenceVideo } from '@/lib/video-compression';
import { reportsService } from '@/lib/services/reports-service';

const ELEVATED_ROLES = ['SUPER_ADMIN', 'ANALYST', 'DIVISI_ESKALASI', 'DIVISI_OP', 'DIVISI_OS', 'DIVISI_OCS', 'DIVISI_OT', 'DIVISI_UQ', 'DIVISI_HC', 'DIVISI_HT', 'MANAGER_CABANG'];

function normalizeAccessValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifySession(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    if (!ELEVATED_ROLES.includes(String(payload.role))) {
      const report = await reportsService.getReportById(id);
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

      const payloadEmail = normalizeAccessValue(payload.email);
      // Station membership only grants *viewing* a station's reports (see
      // canViewReport in lib/report-access.ts) — it must not also grant
      // uploading evidence to reports filed by other people at the same
      // station. Ownership here is the actual author: user_id, or the
      // verified session email matching the report's reporter email.
      // reporter_name is free text on the report and is NOT used for
      // ownership — it is not unique and is trivially spoofable by anyone
      // whose account full_name happens to match it.
      const canAccessOwnReport = Boolean(
        report.user_id === payload.id ||
        (payloadEmail && normalizeAccessValue(report.reporter_email) === payloadEmail)
      );
      if (!canAccessOwnReport) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
    const sourceBuffer = Buffer.from(arrayBuffer);

    const validation = validateEvidenceBuffer(sourceBuffer, kind, file.type);
    if (!validation.valid) {
      console.warn(`[EVIDENCE UPLOAD] File validation failed: ${validation.error}`);
      return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 });
    }

    let uploadBuffer: Buffer;
    let contentType = file.type;
    let ext = extensionForUpload(kind, file.type, file.name);

    if (kind === 'image') {
      try {

        const result = await compressToExactSize(arrayBuffer);
        uploadBuffer = result.buffer;
        contentType = 'image/webp';
        ext = 'webp';
      } catch (error) {
        console.error('[EVIDENCE UPLOAD] Compression failed, using original:', error);
        uploadBuffer = sourceBuffer;
      }
    } else if (kind === 'video') {
      const result = await compressEvidenceVideo(sourceBuffer, file.type, ext);
      uploadBuffer = result.buffer;
      contentType = result.mimeType;
      ext = result.ext;
    } else {

      uploadBuffer = sourceBuffer;
    }

    let fileName = file.name.replace(/\.[^.]+$/, "");
    fileName = `${fileName}_${randomUUID().slice(0, 8)}.${ext}`;

    fileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    // `id` is a route parameter and went into the object key untouched, while
    // fileName right above it was carefully sanitised — so `..%2f..` in the id
    // walked the upload straight out of its report's folder. Same allowlist,
    // and pure-dot segments are rejected outright since `.` is permitted.
    const safeId = id.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    if (!safeId || /^\.+$/.test(safeId)) {
      return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    }

    const path = `reports/${safeId}/${fileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('evidence')
      .upload(path, uploadBuffer, { contentType, upsert: false });

    if (uploadErr) {
      console.error('[EVIDENCE UPLOAD] Supabase storage error:', uploadErr);
      // The raw storage error names buckets and internal paths; the caller gets
      // the status, the detail stays in the log.
      return NextResponse.json({ error: 'Gagal mengunggah evidence' }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from('evidence').getPublicUrl(path);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: 'Failed to get public URL' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      url: publicUrl, 
      path,
      originalSize: file.size,
      uploadSize: uploadBuffer.length
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[UPLOAD_EVIDENCE_ERROR]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
