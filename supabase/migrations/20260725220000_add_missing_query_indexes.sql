-- Performance indexes for columns that are actively filtered/joined on in
-- the application but were missing (found during a query-pattern audit of
-- app/api/** and lib/services/**, then verified directly against the live
-- schema via information_schema/pg_indexes before writing this file).
--
-- NOTE on drift: the live database and this migrations directory had
-- diverged. `reports_sync` (as created by 20260304000000_create_reports_sync.sql)
-- was renamed to `ground_handling_irregularity_report` at some point outside
-- of migration tracking (confirmed live: every index and even the primary
-- key on that table are still named idx_reports_sync_* / reports_sync_pkey)
-- -- reconciled by the preceding 20260725215900 migration, so this one can
-- safely target the reconciled name. `security_events` was indexed via a
-- one-off file (supabase_migration/create_performance_indexes.sql) never
-- added to this directory. This migration targets the verified live table
-- names, and only
-- adds indexes that don't already exist under a different name.

-- joumpa_reports_sync: reporter_email/email_address back a per-request OR
-- filter that scopes every basic-staff user's report list to their own rows
-- (app/api/joumpa/route.ts). category_case_joumpa is filtered by service
-- type on the same endpoint. Verified live: none of the three are indexed;
-- sibling columns (case_joumpa, customer_joumpa) already are.
CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_reporter_email ON public.joumpa_reports_sync (reporter_email);
CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_email_address ON public.joumpa_reports_sync (email_address);
CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_category_case_joumpa ON public.joumpa_reports_sync (category_case_joumpa);

-- users.status: verified live an index already exists but is partial
-- (idx_users_status WHERE status = 'active'), which doesn't help
-- app/api/admin/stats/route.ts's separate `.eq('status', 'pending')` count.
-- users.station_id already has an unconditional index live — not repeated.
CREATE INDEX IF NOT EXISTS idx_users_status_all ON public.users (status);

-- ground_handling_irregularity_report.area (the live name for what these
-- migrations call reports_sync): filtered in lib/services/reports-service.ts
-- alongside hub/branch/airlines, which already have indexes — area was
-- the one column in that group missing one. Verified live: no index on it.
CREATE INDEX IF NOT EXISTS idx_ground_handling_irregularity_report_area
  ON public.ground_handling_irregularity_report (area) WHERE area IS NOT NULL;

-- security_events: app/api/security/dashboard-data/route.ts counts both
-- failed AND successful logins (payload->>'success' = 'false' / 'true').
-- Verified live: idx_security_events_login_failures already covers the
-- 'false' case; nothing symmetric exists for 'true'. Matches the existing
-- index's own naming/style rather than introducing a different shape.
CREATE INDEX IF NOT EXISTS idx_security_events_login_successes
  ON public.security_events ((payload ->> 'success'))
  WHERE event_type = 'login' AND (payload ->> 'success') = 'true';
