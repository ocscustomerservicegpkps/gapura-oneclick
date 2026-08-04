CREATE INDEX IF NOT EXISTS idx_report_documents_created_by
  ON public.report_documents (created_by)
  WHERE created_by IS NOT NULL;

DROP POLICY IF EXISTS "No direct client access" ON public.report_documents;
CREATE POLICY "No direct client access"
  ON public.report_documents
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
