CREATE OR REPLACE FUNCTION public.update_evidence_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can view own evidence upload sessions"
  ON public.evidence_upload_sessions;

CREATE POLICY "Users can view own evidence upload sessions"
  ON public.evidence_upload_sessions FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('SUPER_ADMIN', 'ANALYST')
    )
  );

DROP POLICY IF EXISTS "Users can view own evidence files"
  ON public.evidence_files;

CREATE POLICY "Users can view own evidence files"
  ON public.evidence_files FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('SUPER_ADMIN', 'ANALYST')
    )
  );
