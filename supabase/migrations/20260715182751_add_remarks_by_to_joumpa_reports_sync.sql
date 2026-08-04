ALTER TABLE public.joumpa_reports_sync
  ADD COLUMN IF NOT EXISTS remarks_by TEXT;

COMMENT ON COLUMN public.joumpa_reports_sync.remarks_by IS
  'Division and analyst name recorded when the JOUMPA report status changes.';
