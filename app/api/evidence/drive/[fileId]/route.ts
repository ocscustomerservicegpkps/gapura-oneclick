import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { downloadDriveFile } from '@/lib/google-drive';
import { reportsService } from '@/lib/services/reports-service';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const GLOBAL_EVIDENCE_ROLES = new Set([
  'SUPER_ADMIN',
  'ANALYST',
  'DIVISI_ESKALASI',
  'DIVISI_OS', 'DIVISI_OCS', 'DIVISI_OT', 'DIVISI_UQ',
  'DIVISI_OP',
  'DIVISI_HC',
  'DIVISI_HT',
  'PARTNER_OS',
  'PARTNER_OP',
  'PARTNER_HC',
  'PARTNER_HT',
]);

function normalizeAccessValue(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeFilename(value: unknown) {
  return String(value || 'evidence')
    .replace(/[\r\n"]/g, '_')
    .slice(0, 180);
}

async function canViewEvidence(
  payload: Awaited<ReturnType<typeof verifySession>>,
  evidence: {
    user_id: string | null;
    reporter_email: string | null;
    report_sheet_id: string | null;
  }
) {
  if (!payload) return false;

  const payloadEmail = normalizeAccessValue(payload.email);
  const evidenceEmail = normalizeAccessValue(evidence.reporter_email);
  if (evidence.user_id === payload.id || (payloadEmail && payloadEmail === evidenceEmail)) {
    return true;
  }

  const role = String(payload.role || '').trim().toUpperCase();
  if (GLOBAL_EVIDENCE_ROLES.has(role)) return true;
  if (!evidence.report_sheet_id) return false;

  const report = await reportsService.getReportById(evidence.report_sheet_id);
  if (!report) return false;

  if (role === 'MANAGER_CABANG') {
    return Boolean(payload.station_id && report.station_id === payload.station_id);
  }

  if (role === 'STAFF_CABANG' || role === 'CABANG' || role === 'EMPLOYEE') {
    const payloadName = normalizeAccessValue(payload.full_name);
    return Boolean(
      report.user_id === payload.id ||
      (payload.station_id && report.station_id === payload.station_id) ||
      (payloadEmail && normalizeAccessValue(report.reporter_email) === payloadEmail) ||
      (payloadName && normalizeAccessValue(report.reporter_name) === payloadName)
    );
  }

  return false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) {
      return NextResponse.json({ error: 'Invalid evidence file ID' }, { status: 400 });
    }

    const token = (await cookies()).get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifySession(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { data: evidence, error } = await supabaseAdmin
      .from('evidence_files')
      .select('user_id,reporter_email,report_sheet_id,original_name,mime_type,size_bytes,status')
      .eq('google_drive_file_id', fileId)
      .maybeSingle();

    if (error) throw error;
    if (!evidence || ['deleted', 'quarantined'].includes(String(evidence.status))) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    if (!await canViewEvidence(payload, evidence)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const file = await downloadDriveFile(fileId);
    const filename = sanitizeFilename(evidence.original_name);

    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(file.length),
        'Content-Type': evidence.mime_type || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[DRIVE_EVIDENCE_PREVIEW_ERROR]', error);
    return NextResponse.json({ error: 'Unable to load evidence preview' }, { status: 500 });
  }
}
