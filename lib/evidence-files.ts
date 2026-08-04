import 'server-only';

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

type EvidenceMode = 'public' | 'internal';

interface EvidenceActorInput {
  mode: EvidenceMode;
  userId?: string | null;
  reporterEmail?: string | null;
  reporterName?: string | null;
  quickAccessSessionId?: string | null;
}

interface RecordEvidenceUploadInput extends EvidenceActorInput {
  submissionId?: string | null;
  googleDriveFileId: string;
  googleDriveFolderId: string;
  webViewLink: string;
  webContentLink?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  kind: 'evidence' | 'document';
  status?: 'uploaded_pending_report' | 'linked';
  reportSheetId?: string | null;
  reportId?: string | null;
}

interface EvidenceValidationInput {
  evidenceFileIds?: unknown;
  evidenceUrls?: unknown;
  submissionId?: string | null;
  mode: EvidenceMode;
  userId?: string | null;
  reporterEmail?: string | null;
  requireLedger?: boolean;
}

type EvidenceFileRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  reporter_email: string | null;
  status: string;
  web_view_link: string;
};

function normalizeEmail(email?: string | null) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

export function normalizeEvidenceSubmissionId(value?: unknown) {
  const raw = String(value || '').trim();
  if (/^[a-zA-Z0-9._:-]{8,160}$/.test(raw)) return raw;
  return randomUUID();
}

export function normalizeEvidenceFileIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    return [...new Set(value.split(/\s*[|,\n]\s*/).map((item) => item.trim()).filter(Boolean))];
  }

  return [];
}

function normalizeUrlList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/\s*\|\s*|\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function resolveUserIdByEmail(email: string | null) {
  if (!email) return null;

  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  return data?.id || null;
}

async function ensureEvidenceSession(input: EvidenceActorInput & { submissionId: string }) {
  const reporterEmail = normalizeEmail(input.reporterEmail);
  const userId = input.userId || await resolveUserIdByEmail(reporterEmail);

  if (!userId && !reporterEmail) {
    throw new Error('Evidence upload needs reporter_email or authenticated user');
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('evidence_upload_sessions')
    .select('id,user_id,reporter_email,status')
    .eq('id', input.submissionId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const existingEmail = normalizeEmail(existing.reporter_email);
    if (existingEmail && reporterEmail && existingEmail !== reporterEmail) {
      throw new Error('Evidence session belongs to different reporter_email');
    }

    if (existing.user_id && userId && existing.user_id !== userId) {
      throw new Error('Evidence session belongs to different user');
    }

    const { error } = await supabaseAdmin
      .from('evidence_upload_sessions')
      .update({
        user_id: existing.user_id || userId || null,
        reporter_email: existing.reporter_email || reporterEmail,
        reporter_name: input.reporterName || null,
        quick_access_session_id: input.quickAccessSessionId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.submissionId);

    if (error) throw error;
    return { submissionId: input.submissionId, userId: existing.user_id || userId || null, reporterEmail: existingEmail || reporterEmail };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('evidence_upload_sessions')
    .insert({
      id: input.submissionId,
      mode: input.mode,
      user_id: userId,
      reporter_email: reporterEmail,
      reporter_name: input.reporterName || null,
      quick_access_session_id: input.quickAccessSessionId || null,
      status: 'uploading',
      expires_at: expiresAt,
    });

  if (error) throw error;
  return { submissionId: input.submissionId, userId, reporterEmail };
}

export async function recordEvidenceUpload(input: RecordEvidenceUploadInput) {
  const submissionId = normalizeEvidenceSubmissionId(input.submissionId);
  const session = await ensureEvidenceSession({ ...input, submissionId });
  const status = input.status || 'uploaded_pending_report';

  const { data, error } = await supabaseAdmin
    .from('evidence_files')
    .insert({
      session_id: submissionId,
      mode: input.mode,
      user_id: session.userId,
      reporter_email: session.reporterEmail,
      reporter_name: input.reporterName || null,
      kind: input.kind,
      google_drive_file_id: input.googleDriveFileId,
      google_drive_folder_id: input.googleDriveFolderId,
      web_view_link: input.webViewLink,
      web_content_link: input.webContentLink || null,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      sha256: input.sha256,
      status,
      report_sheet_id: input.reportSheetId || null,
      report_id: input.reportId || null,
      linked_at: status === 'linked' ? new Date().toISOString() : null,
    })
    .select('id,session_id,web_view_link')
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    submissionId: data.session_id as string,
    url: data.web_view_link as string,
  };
}

export async function validateEvidenceForReport(input: EvidenceValidationInput) {
  const evidenceFileIds = normalizeEvidenceFileIds(input.evidenceFileIds);
  const fallbackUrls = normalizeUrlList(input.evidenceUrls);
  if (evidenceFileIds.length === 0) {
    if (input.requireLedger && fallbackUrls.length > 0) {
      throw new Error('Evidence metadata missing. Re-upload evidence before submitting report.');
    }
    return { urls: fallbackUrls, evidenceFileIds: [] };
  }

  const reporterEmail = normalizeEmail(input.reporterEmail);
  const { data, error } = await supabaseAdmin
    .from('evidence_files')
    .select('id,session_id,user_id,reporter_email,status,web_view_link')
    .in('id', evidenceFileIds);

  if (error) throw error;

  const rows = (data || []) as EvidenceFileRow[];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const orderedRows = evidenceFileIds.map((id) => byId.get(id));
  const missing = evidenceFileIds.filter((id, index) => !orderedRows[index]);
  if (missing.length > 0) {
    throw new Error(`Evidence file not found: ${missing.join(', ')}`);
  }

  for (const row of orderedRows) {
    if (!row) continue;

    if (input.submissionId && row.session_id !== input.submissionId) {
      throw new Error('Evidence file belongs to different submission');
    }

    if (input.mode === 'internal' && input.userId && row.user_id && row.user_id !== input.userId) {
      throw new Error('Evidence file belongs to different user');
    }

    if (input.mode === 'public') {
      const rowEmail = normalizeEmail(row.reporter_email);
      if (!rowEmail || !reporterEmail || rowEmail !== reporterEmail) {
        throw new Error('Evidence file belongs to different reporter_email');
      }
    }

    if (['deleted', 'quarantined'].includes(String(row.status))) {
      throw new Error('Evidence file is not attachable');
    }
  }

  return {
    urls: orderedRows.map((row) => String(row?.web_view_link || '')).filter(Boolean),
    evidenceFileIds,
  };
}

export async function linkEvidenceFilesToReport(input: {
  evidenceFileIds?: unknown;
  submissionId?: string | null;
  reportSheetId?: string | null;
  reportId?: string | null;
}) {
  const evidenceFileIds = normalizeEvidenceFileIds(input.evidenceFileIds);
  const now = new Date().toISOString();

  if (evidenceFileIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('evidence_files')
      .update({
        status: 'linked',
        report_sheet_id: input.reportSheetId || null,
        report_id: input.reportId || null,
        linked_at: now,
        updated_at: now,
      })
      .in('id', evidenceFileIds);

    if (error) throw error;
  }

  if (input.submissionId) {
    const { error } = await supabaseAdmin
      .from('evidence_upload_sessions')
      .update({
        status: 'linked',
        report_sheet_id: input.reportSheetId || null,
        updated_at: now,
      })
      .eq('id', input.submissionId);

    if (error) throw error;
  }
}
