-- Move a report's child rows when the sync relinks it to a new sheet row.
--
-- A report's stable id is uuidv5(sheet_id) (see ReportsService.getReportUuid),
-- so when a row is inserted or deleted above it in the Google Sheet, every row
-- below shifts down and its id changes. The sync detects this by fingerprint
-- and "relinks": it rewrites the stored row, including the new id.
--
-- Nothing moved the children. report_comments, report_comment_notifications,
-- report_documents and evidence_files all key off the report's id in a plain
-- TEXT column with no foreign key, so after a relink they still point at the id
-- the report no longer has. They vanish from their report, and worse, the id
-- they point at is handed to whichever report shifts into that sheet position —
-- surfacing one report's comments and evidence on an unrelated one.
--
-- All of it in one function so the moves commit together: a partial remap would
-- split a report's history across two ids with no way to tell which is which.
CREATE OR REPLACE FUNCTION public.relink_report_children(
    p_previous_id text,
    p_new_id text,
    p_previous_sheet_id text,
    p_new_sheet_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_comments integer := 0;
    v_notifications integer := 0;
    v_documents integer := 0;
    v_document_conflicts integer := 0;
    v_evidence integer := 0;
    v_sessions integer := 0;
BEGIN
    IF p_previous_id IS NULL OR p_new_id IS NULL OR p_previous_id = p_new_id THEN
        RETURN jsonb_build_object('skipped', true);
    END IF;

    -- Serialize against a concurrent relink of the same report so two sync runs
    -- cannot each move half the children.
    PERFORM pg_advisory_xact_lock(hashtext('relink_report:' || p_previous_id));

    UPDATE public.report_comments
       SET report_id = p_new_id,
           sheet_id = COALESCE(p_new_sheet_id, sheet_id)
     WHERE report_id = p_previous_id;
    GET DIAGNOSTICS v_comments = ROW_COUNT;

    -- Legacy rows stored the sheet_id in report_id instead of the uuid.
    IF p_previous_sheet_id IS NOT NULL AND p_new_sheet_id IS NOT NULL THEN
        UPDATE public.report_comments
           SET report_id = p_new_id,
               sheet_id = p_new_sheet_id
         WHERE report_id = p_previous_sheet_id;
    END IF;

    UPDATE public.report_comment_notifications
       SET report_id = p_new_id
     WHERE report_id = p_previous_id;
    GET DIAGNOSTICS v_notifications = ROW_COUNT;

    -- report_documents is UNIQUE (report_type, report_id). A document already
    -- sitting on the destination id belongs to whatever previously occupied that
    -- sheet position; moving onto it would violate the constraint and abort the
    -- whole relink. Leave those behind and report the count instead — losing a
    -- generated document is worse than leaving one attached to a stale id.
    SELECT count(*) INTO v_document_conflicts
      FROM public.report_documents rd
     WHERE rd.report_id = p_previous_id
       AND EXISTS (
           SELECT 1 FROM public.report_documents existing
            WHERE existing.report_id = p_new_id
              AND existing.report_type = rd.report_type
       );

    UPDATE public.report_documents rd
       SET report_id = p_new_id,
           updated_at = now()
     WHERE rd.report_id = p_previous_id
       AND NOT EXISTS (
           SELECT 1 FROM public.report_documents existing
            WHERE existing.report_id = p_new_id
              AND existing.report_type = rd.report_type
       );
    GET DIAGNOSTICS v_documents = ROW_COUNT;

    UPDATE public.evidence_files
       SET report_id = p_new_id,
           report_sheet_id = COALESCE(p_new_sheet_id, report_sheet_id),
           updated_at = now()
     WHERE report_id = p_previous_id;
    GET DIAGNOSTICS v_evidence = ROW_COUNT;

    IF p_previous_sheet_id IS NOT NULL AND p_new_sheet_id IS NOT NULL
       AND p_previous_sheet_id <> p_new_sheet_id THEN
        UPDATE public.evidence_upload_sessions
           SET report_sheet_id = p_new_sheet_id,
               updated_at = now()
         WHERE report_sheet_id = p_previous_sheet_id;
        GET DIAGNOSTICS v_sessions = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'comments', v_comments,
        'notifications', v_notifications,
        'documents', v_documents,
        'document_conflicts', v_document_conflicts,
        'evidence_files', v_evidence,
        'upload_sessions', v_sessions
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.relink_report_children(text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.relink_report_children(text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.relink_report_children(text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.relink_report_children(text, text, text, text) TO service_role;
