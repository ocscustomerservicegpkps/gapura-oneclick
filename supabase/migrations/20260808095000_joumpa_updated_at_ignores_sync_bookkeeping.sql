-- Same defect as the reports table (see
-- 20260808093000_updated_at_ignores_sync_bookkeeping.sql), on the Joumpa table.
--
-- update_joumpa_reports_sync_updated_at set NEW.updated_at = NOW() on every
-- UPDATE, including the synced_at stamp the outbox writes after pushing a row
-- to Sheets. The stamp therefore left the row dirty again — all 48 of 48 rows
-- read as dirty — so JoumpaSyncService.pushLocalUpdatesToSheets re-pushed the
-- same rows on every run, overwriting the sheet with the database's older copy.
CREATE OR REPLACE FUNCTION public.update_joumpa_reports_sync_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    bookkeeping text[] := ARRAY['synced_at', 'sync_version', 'content_hash', 'updated_at'];
BEGIN
    IF TG_OP = 'UPDATE'
       AND (SELECT to_jsonb(NEW) - bookkeeping) = (SELECT to_jsonb(OLD) - bookkeeping)
    THEN
        NEW.updated_at = OLD.updated_at;
        RETURN NEW;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
