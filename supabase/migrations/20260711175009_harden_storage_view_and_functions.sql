-- Security hardening pass: storage lockdown, view/MV exposure, function search_path.
-- Context: Supabase security advisor + manual audit (2026-07-11).
--
-- The application performs ALL storage and privileged DB work through the
-- service role (server-side), which bypasses RLS. The anon/authenticated roles
-- (anon key ships to the browser) must therefore have no standing write/list
-- access. Public evidence rendering keeps working because the buckets stay
-- public and are read via the public-object URL, which does not consult RLS.

-- 1. Storage: remove wide-open anon access.
--    "Allow All Objects" granted role `public` ALL commands with USING(true) /
--    WITH CHECK(true) — i.e. anyone with the anon key could SELECT/INSERT/
--    UPDATE/DELETE every object in every bucket (delete/overwrite all evidence,
--    upload arbitrary files, enumerate/download everything).
DROP POLICY IF EXISTS "Allow All Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload"     ON storage.objects;
DROP POLICY IF EXISTS "Public Select"     ON storage.objects;
-- Left intact: "Authenticated Upload" (INSERT into evidence, authenticated only).

-- 2. dashboard_summary view ran with SECURITY DEFINER semantics, bypassing the
--    querying role's RLS. Run it as the invoker instead.
ALTER VIEW public.dashboard_summary SET (security_invoker = on);

-- 3. dashboard_metrics materialized view was reachable through the auto-exposed
--    API roles. Revoke it; the app reads it via the service role.
REVOKE SELECT ON public.dashboard_metrics FROM anon, authenticated;

-- 4. Functions: pin a non-mutable search_path (blocks search_path injection)
--    and revoke anon/authenticated EXECUTE on the SECURITY DEFINER maintenance
--    functions (prevents anon from triggering cleanup/vacuum/refresh — a DoS
--    and privilege-abuse vector). Trigger and cron invocations are unaffected:
--    triggers fire regardless of EXECUTE grants, and cron runs as postgres.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, p.prosecdef,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'acquire_sync_lock','bump_sync_state_version','cleanup_expired_rate_limits',
        'cleanup_old_audit_partitions','cleanup_old_sessions','complete_sync_state',
        'create_audit_partitions','get_report_counts_by_date','get_top_categories',
        'log_query_performance','log_report_changes','log_slow_queries',
        'maintenance_vacuum_analyze','periodic_performance_maintenance',
        'refresh_analytics_materialized_views','refresh_dashboard_metrics',
        'refresh_dashboard_statistics')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public',
      r.proname, r.args);
    IF r.prosecdef THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated, PUBLIC',
        r.proname, r.args);
    END IF;
  END LOOP;
END $$;
