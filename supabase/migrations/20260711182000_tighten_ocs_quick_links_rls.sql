-- Remove the last permissive RLS policy flagged by the advisor.
--
-- `ocs_quick_links_auth` granted every authenticated role ALL commands with
-- USING(true)/WITH CHECK(true) — i.e. any logged-in user could read/write/delete
-- quick links directly through the anon key. The application only touches this
-- table through the service role (app/api/ocs-links/route.ts via supabaseAdmin),
-- which bypasses RLS, so dropping the policy leaves the table deny-by-default
-- (matching every other app table) without affecting the app.
DROP POLICY IF EXISTS "ocs_quick_links_auth" ON public.ocs_quick_links;
