-- Second hardening pass: pin search_path on the remaining flagged functions
-- and lock down run_analytics_query.
--
-- run_analytics_query(text, text[]) executes caller-supplied SQL (guarded only
-- by a "must start with SELECT/WITH" string check). It has no callers in the
-- application code and yet anon + authenticated could EXECUTE it — an
-- unnecessary arbitrary-SQL surface. Revoke it from the API roles; service_role
-- and postgres retain access.
REVOKE EXECUTE ON FUNCTION public.run_analytics_query(text, text[]) FROM anon, authenticated, PUBLIC;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'refresh_monthly_summary','update_hc_requests_updated_at',
        'update_reports_sync_updated_at','update_calendar_events_updated_at',
        'set_updated_at','run_analytics_query','set_performance_links_updated_at')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public',
      r.proname, r.args);
  END LOOP;
END $$;
