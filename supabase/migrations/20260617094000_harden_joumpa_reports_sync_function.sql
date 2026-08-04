CREATE OR REPLACE FUNCTION public.update_joumpa_reports_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

REVOKE ALL ON FUNCTION public.update_joumpa_reports_sync_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_joumpa_reports_sync_updated_at() TO service_role;
