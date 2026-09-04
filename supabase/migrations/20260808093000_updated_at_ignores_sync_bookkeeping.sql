-- Stop the sync outbox re-dirtying every row it just marked clean.
--
-- "Dirty" — a row carrying an app edit the sheet has not seen — is defined as
-- updated_at > synced_at. The outbox pushes dirty rows to Google Sheets and
-- then stamps synced_at to mark them clean.
--
-- This trigger set NEW.updated_at = NOW() on *every* UPDATE, including that
-- stamp. So the stamp moved updated_at to a moment at or after the synced_at it
-- was writing, and the row came out of the operation dirty again. Every sync
-- then re-pushed the same rows: 1179 of 1179 rows currently read as dirty, 450
-- of them by less than five seconds apart. Each push overwrites the sheet row
-- — the source of truth — with the database's older snapshot, so a genuine
-- sheet edit could be reverted on the next sync, indefinitely.
--
-- A write that touches nothing but sync bookkeeping is not a content edit, so
-- it must leave updated_at where it was.
CREATE OR REPLACE FUNCTION public.update_reports_sync_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    -- Columns that describe the sync itself rather than the report's content.
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
