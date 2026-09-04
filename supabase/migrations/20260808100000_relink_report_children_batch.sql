-- Relink a whole shift at once, in two phases.
--
-- relink_report_children() moved one report's children per call, which is wrong
-- as soon as a sheet edit shifts a run of rows. Inserting a row makes every row
-- below it move down by one, so the sync produces a chain of mappings:
--
--     uuid(row_5) -> uuid(row_6),  uuid(row_6) -> uuid(row_7),  ...
--
-- Applied one at a time in ascending order, the first call parks row 5's
-- children on uuid(row_6) — where the second call, which moves *everything*
-- sitting on uuid(row_6), sweeps them along to uuid(row_7). Demonstrated: two
-- comments, one per row, both ended up on row 7 and row 6 was left empty. The
-- per-source advisory lock did not help; the calls were never concurrent, just
-- ordered badly. Descending order happens to work for an insert and breaks for
-- a delete, so ordering is not the fix either.
--
-- Two phases in one transaction removes the overlap entirely: every source's
-- children go to a temporary id unique to that source, and only once no source
-- id holds anything do they move on to their destinations.
CREATE OR REPLACE FUNCTION public.relink_report_children_batch(p_pairs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    pair jsonb;
    prev_id text;
    new_id text;
    prev_sheet text;
    new_sheet text;
    tmp_id text;
    tmp_sheet text;
    moved integer;
    v_comments integer := 0;
    v_notifications integer := 0;
    v_documents integer := 0;
    v_document_conflicts integer := 0;
    v_evidence integer := 0;
    v_sessions integer := 0;
BEGIN
    IF p_pairs IS NULL OR jsonb_array_length(p_pairs) = 0 THEN
        RETURN jsonb_build_object('pairs', 0);
    END IF;

    -- Serialize the whole batch against another relink run rather than locking
    -- per source: the phases are only safe if no other mapping interleaves.
    PERFORM pg_advisory_xact_lock(hashtext('relink_report_children_batch'));

    -- Phase 1 — park every source's children on an id nothing else can target.
    FOR pair IN SELECT * FROM jsonb_array_elements(p_pairs) LOOP
        prev_id := pair->>'previous_id';
        new_id := pair->>'new_id';
        prev_sheet := pair->>'previous_sheet_id';
        new_sheet := pair->>'new_sheet_id';
        IF prev_id IS NULL OR new_id IS NULL OR prev_id = new_id THEN CONTINUE; END IF;
        tmp_id := 'relink-tmp:' || prev_id;

        UPDATE public.report_comments SET report_id = tmp_id WHERE report_id = prev_id;
        -- Legacy rows stored the sheet_id in report_id instead of the uuid.
        IF prev_sheet IS NOT NULL THEN
            UPDATE public.report_comments SET report_id = tmp_id WHERE report_id = prev_sheet;
        END IF;
        UPDATE public.report_comment_notifications SET report_id = tmp_id WHERE report_id = prev_id;
        UPDATE public.report_documents SET report_id = tmp_id WHERE report_id = prev_id;
        UPDATE public.evidence_files SET report_id = tmp_id WHERE report_id = prev_id;

        -- Upload sessions are keyed by sheet id, not by report uuid, but they
        -- shift for exactly the same reason and so need the same two phases.
        -- Moved straight from prev_sheet to new_sheet they reproduced the bug
        -- this function exists to fix: with sheet_5 -> sheet_6 -> sheet_7,
        -- row 5's sessions landed on sheet_6 and the next pair swept them on to
        -- sheet_7, emptying sheet_6 and counting them twice.
        IF prev_sheet IS NOT NULL AND new_sheet IS NOT NULL AND prev_sheet <> new_sheet THEN
            UPDATE public.evidence_upload_sessions
               SET report_sheet_id = 'relink-tmp:' || prev_sheet
             WHERE report_sheet_id = prev_sheet;
        END IF;
    END LOOP;

    -- Phase 2 — no source id holds anything now, so destinations are free.
    FOR pair IN SELECT * FROM jsonb_array_elements(p_pairs) LOOP
        prev_id := pair->>'previous_id';
        new_id := pair->>'new_id';
        prev_sheet := pair->>'previous_sheet_id';
        new_sheet := pair->>'new_sheet_id';
        IF prev_id IS NULL OR new_id IS NULL OR prev_id = new_id THEN CONTINUE; END IF;
        tmp_id := 'relink-tmp:' || prev_id;

        UPDATE public.report_comments
           SET report_id = new_id,
               sheet_id = COALESCE(new_sheet, sheet_id)
         WHERE report_id = tmp_id;
        GET DIAGNOSTICS moved = ROW_COUNT;
        v_comments := v_comments + moved;

        UPDATE public.report_comment_notifications SET report_id = new_id WHERE report_id = tmp_id;
        GET DIAGNOSTICS moved = ROW_COUNT;
        v_notifications := v_notifications + moved;

        -- report_documents is UNIQUE (report_type, report_id). A document
        -- already on the destination belongs to whatever previously occupied
        -- that sheet position; moving onto it would abort the whole batch.
        -- Leave those parked and report the count — losing a generated document
        -- is worse than leaving one on a temporary id, which the next run
        -- retries.
        SELECT count(*) INTO moved
          FROM public.report_documents rd
         WHERE rd.report_id = tmp_id
           AND EXISTS (
               SELECT 1 FROM public.report_documents existing
                WHERE existing.report_id = new_id
                  AND existing.report_type = rd.report_type
           );
        v_document_conflicts := v_document_conflicts + moved;

        UPDATE public.report_documents rd
           SET report_id = new_id, updated_at = now()
         WHERE rd.report_id = tmp_id
           AND NOT EXISTS (
               SELECT 1 FROM public.report_documents existing
                WHERE existing.report_id = new_id
                  AND existing.report_type = rd.report_type
           );
        GET DIAGNOSTICS moved = ROW_COUNT;
        v_documents := v_documents + moved;

        UPDATE public.evidence_files
           SET report_id = new_id,
               report_sheet_id = COALESCE(new_sheet, report_sheet_id),
               updated_at = now()
         WHERE report_id = tmp_id;
        GET DIAGNOSTICS moved = ROW_COUNT;
        v_evidence := v_evidence + moved;

        IF prev_sheet IS NOT NULL AND new_sheet IS NOT NULL AND prev_sheet <> new_sheet THEN
            tmp_sheet := 'relink-tmp:' || prev_sheet;
            UPDATE public.evidence_upload_sessions
               SET report_sheet_id = new_sheet, updated_at = now()
             WHERE report_sheet_id = tmp_sheet;
            GET DIAGNOSTICS moved = ROW_COUNT;
            v_sessions := v_sessions + moved;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'pairs', jsonb_array_length(p_pairs),
        'comments', v_comments,
        'notifications', v_notifications,
        'documents', v_documents,
        'document_conflicts', v_document_conflicts,
        'evidence_files', v_evidence,
        'upload_sessions', v_sessions
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.relink_report_children_batch(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.relink_report_children_batch(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.relink_report_children_batch(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.relink_report_children_batch(jsonb) TO service_role;

-- Superseded, and unsafe for any shift longer than one row. Dropped so it
-- cannot be reached for again.
DROP FUNCTION IF EXISTS public.relink_report_children(text, text, text, text);
