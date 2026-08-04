-- Reject rows where the docx and pdf storage paths are identical; the
-- per-column UNIQUE constraints alone don't catch a bug that points both
-- fields at the same object.
ALTER TABLE public.report_documents
  ADD CONSTRAINT report_documents_distinct_paths
  CHECK (docx_path <> pdf_path);
