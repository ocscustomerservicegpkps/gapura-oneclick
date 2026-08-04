-- RLS was already enabled on these tables (by 20260704201740_enable_rls_lockdown_only)
-- with zero policies, which Postgres treats as default-deny for anon/authenticated
-- regardless of table-level grants. Each table still carried a dangling GRANT ALL
-- to anon/authenticated from an earlier migration, so this revokes those unused
-- grants for defense in depth. All application data access goes through Next.js
-- API routes using the service-role client (lib/supabase-admin.ts), which bypasses
-- RLS and grants entirely, so this does not change app behavior for server-side
-- reads/writes.
--
-- Exception: components/security/LiveSecurityFeed.tsx reads `security_events`
-- directly from the browser with the anon key and subscribes to realtime changes
-- on it. With no SELECT policy this was silently returning empty results in
-- production, so this adds a public-read policy scoped to that one table.

REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.blocked_ips FROM anon, authenticated;
REVOKE ALL ON public.security_configs FROM anon, authenticated;
REVOKE ALL ON public.security_sessions FROM anon, authenticated;
REVOKE ALL ON public.performance_links FROM anon, authenticated;
REVOKE ALL ON public.ocs_tab_records FROM anon, authenticated;
REVOKE ALL ON public.custom_dashboards FROM anon, authenticated;
REVOKE ALL ON public.sync_state FROM anon, authenticated;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
REVOKE ALL ON public.dashboard_cache_entries FROM anon, authenticated;

REVOKE ALL ON public.security_events FROM anon, authenticated;
GRANT SELECT ON public.security_events TO anon, authenticated;

DROP POLICY IF EXISTS "security_events_public_read" ON public.security_events;
CREATE POLICY "security_events_public_read" ON public.security_events
  FOR SELECT
  TO anon, authenticated
  USING (true);
