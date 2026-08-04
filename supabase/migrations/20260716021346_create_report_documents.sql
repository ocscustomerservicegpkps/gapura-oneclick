INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-documents',
  'report-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.report_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('IRREGULARITY', 'JOUMPA')),
  report_id TEXT NOT NULL,
  revision_id UUID NOT NULL,
  docx_path TEXT NOT NULL UNIQUE,
  docx_filename TEXT NOT NULL,
  docx_mime_type TEXT NOT NULL CHECK (
    docx_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ),
  docx_size_bytes BIGINT NOT NULL CHECK (docx_size_bytes > 0 AND docx_size_bytes <= 20971520),
  docx_sha256 TEXT NOT NULL CHECK (docx_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_path TEXT NOT NULL UNIQUE,
  pdf_filename TEXT NOT NULL,
  pdf_mime_type TEXT NOT NULL CHECK (pdf_mime_type = 'application/pdf'),
  pdf_size_bytes BIGINT NOT NULL CHECK (pdf_size_bytes > 0 AND pdf_size_bytes <= 20971520),
  pdf_sha256 TEXT NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  edited_snapshot JSONB NOT NULL CHECK (jsonb_typeof(edited_snapshot) = 'object'),
  signature_sha256 TEXT CHECK (signature_sha256 IS NULL OR signature_sha256 ~ '^[0-9a-f]{64}$'),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_type, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_documents_report_lookup
  ON public.report_documents (report_type, report_id);

ALTER TABLE public.report_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.report_documents FROM anon, authenticated;
REVOKE ALL ON TABLE public.report_documents FROM PUBLIC;

COMMENT ON TABLE public.report_documents IS
  'Canonical private DOCX/PDF bundles generated from the final report editor snapshot.';
