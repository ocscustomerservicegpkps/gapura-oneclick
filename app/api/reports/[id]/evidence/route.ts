
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { compressToExactSize } from '@/lib/image-compression';
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

    const isImage = file.type.startsWith('image/');
    const isDoc = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ].includes(file.type);

    if (!isImage && !isDoc) {
      return NextResponse.json({ error: 'Only images and documents (PDF/Word) are allowed' }, { status: 400 });
    }

    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
    }


    const arrayBuffer = await file.arrayBuffer();
    let uploadBuffer: Buffer;
    let contentType = file.type;

    let compressed = false;
    if (isImage) {
      try {

        const result = await compressToExactSize(arrayBuffer);
        uploadBuffer = result.buffer;
        contentType = 'image/webp';
        compressed = true;
      } catch (error) {
        console.error('[EVIDENCE UPLOAD] Compression failed, using original:', error);
        uploadBuffer = Buffer.from(arrayBuffer);
      }
    } else {

      uploadBuffer = Buffer.from(arrayBuffer);
    }

    const ext = compressed ? 'webp' : (file.name.split('.').pop() || 'tmp');
    let fileName = file.name.replace(/\.[^.]+$/, "");
    fileName = `${fileName}_${randomUUID().slice(0, 8)}.${ext}`;

    fileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const path = `reports/${id}/${fileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('evidence')
      .upload(path, uploadBuffer, { contentType, upsert: false });

    if (uploadErr) {
      console.error('[EVIDENCE UPLOAD] Supabase storage error:', uploadErr);
      return NextResponse.json({ error: uploadErr.message, details: uploadErr }, { status: 500 });
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
