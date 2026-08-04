-- Attribute public JOUMPA submissions to a registered account when the
-- reporter e-mail matches a user. Adds the ownership column the app now writes
-- on create (app/api/joumpa/public + JoumpaSyncService.createReport).
--
-- Nullable: anonymous submissions (no matching account) stay null. ON DELETE
-- SET NULL so removing a user never blocks or corrupts historical reports.
-- The column is not present in the JOUMPA sheet, so sheet resyncs never touch
-- it — the attribution set at creation persists.
ALTER TABLE public.joumpa_reports_sync
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_user_id
  ON public.joumpa_reports_sync(user_id);
