CREATE TABLE IF NOT EXISTS public.evidence_upload_sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('public', 'internal')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  reporter_name TEXT,
  quick_access_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'linked', 'expired', 'quarantined')),
  report_sheet_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_upload_sessions_has_owner
    CHECK (user_id IS NOT NULL OR reporter_email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.evidence_upload_sessions(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('public', 'internal')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  reporter_name TEXT,
  kind TEXT NOT NULL DEFAULT 'evidence' CHECK (kind IN ('evidence', 'document')),
  google_drive_file_id TEXT NOT NULL UNIQUE,
  google_drive_folder_id TEXT NOT NULL,
  web_view_link TEXT NOT NULL,
  web_content_link TEXT,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded_pending_report'
    CHECK (status IN ('uploaded_pending_report', 'linked', 'expired', 'quarantined', 'deleted')),
  report_sheet_id TEXT,
  report_id TEXT,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_files_has_owner
    CHECK (user_id IS NOT NULL OR reporter_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_evidence_upload_sessions_user_id
  ON public.evidence_upload_sessions(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_upload_sessions_reporter_email
  ON public.evidence_upload_sessions(lower(reporter_email))
  WHERE reporter_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_upload_sessions_status_expires
  ON public.evidence_upload_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_evidence_files_session_id
  ON public.evidence_files(session_id);

CREATE INDEX IF NOT EXISTS idx_evidence_files_user_id
  ON public.evidence_files(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_files_reporter_email
  ON public.evidence_files(lower(reporter_email))
  WHERE reporter_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_files_report_sheet_id
  ON public.evidence_files(report_sheet_id)
  WHERE report_sheet_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_evidence_upload_sessions_updated_at ON public.evidence_upload_sessions;
CREATE TRIGGER trigger_evidence_upload_sessions_updated_at
  BEFORE UPDATE ON public.evidence_upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_evidence_updated_at();

DROP TRIGGER IF EXISTS trigger_evidence_files_updated_at ON public.evidence_files;
CREATE TRIGGER trigger_evidence_files_updated_at
  BEFORE UPDATE ON public.evidence_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_evidence_updated_at();

ALTER TABLE public.evidence_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence upload sessions"
  ON public.evidence_upload_sessions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPER_ADMIN', 'ANALYST')
    )
  );

CREATE POLICY "Users can view own evidence files"
  ON public.evidence_files FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPER_ADMIN', 'ANALYST')
    )
  );

COMMENT ON TABLE public.evidence_upload_sessions IS 'Submission-level owner ledger for Google Drive evidence uploads.';
COMMENT ON TABLE public.evidence_files IS 'File-level Google Drive evidence ledger. Every row must have a user_id or reporter_email owner.';

ALTER TABLE public.reports_sync
  ADD COLUMN IF NOT EXISTS evidence_file_ids TEXT[],
  ADD COLUMN IF NOT EXISTS evidence_submission_id TEXT;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS evidence_file_ids TEXT[],
  ADD COLUMN IF NOT EXISTS evidence_submission_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_sync_evidence_submission_id
  ON public.reports_sync(evidence_submission_id)
  WHERE evidence_submission_id IS NOT NULL;
