-- Reconciles a schema change that happened live outside of migration
-- tracking: `reports_sync` (created by 20260304000000_create_reports_sync.sql)
-- was renamed to `ground_handling_irregularity_report` at some point without
-- a corresponding tracked migration. Without this, a fresh environment built
-- via `supabase db reset` would still have a table named `reports_sync`,
-- while the live database (and every query in the app) uses
-- `ground_handling_irregularity_report` — and the index migration that
-- follows this one targets that name.
--
-- Idempotent: only renames when the old name exists and the new one
-- doesn't, so this is a no-op on the live database (already renamed) and
-- only takes effect on a fresh rebuild from these migrations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reports_sync'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ground_handling_irregularity_report'
  ) THEN
    ALTER TABLE public.reports_sync RENAME TO ground_handling_irregularity_report;
  END IF;
END $$;
