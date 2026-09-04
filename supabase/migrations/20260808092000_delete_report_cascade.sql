-- Delete a report together with everything hanging off it.
--
-- report_comments, report_comment_notifications, report_documents and
-- evidence_files all key off the report's id in a plain TEXT column — no
-- foreign key, so no ON DELETE CASCADE. Deleting a report left every one of
-- them behind forever.
--
-- That is not only clutter. A report's id is uuidv5(sheet_id), derived from its
-- position in the Google Sheet, so the deleted report's id is immediately
-- reusable: the next sync hands it to whichever report shifts into that sheet
-- position, and the deleted report's comments and evidence reappear on a live,
-- unrelated report.
--
-- evidence_files is retired rather than deleted: each row is the only record of
-- a file that still exists in Google Drive, and dropping the row would strand
-- the file with nothing pointing at it. Clearing the link and marking it
-- 'deleted' keeps the audit trail while making the row unreachable from any
-- report. report_documents rows are deleted, but their Storage object paths are
-- returned so the caller can remove the objects too.
CREATE OR REPLACE FUNCTION public.delete_report_cascade(
    p_report_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_ids text[];
    v_sheet_ids text[];
    v_report_pks text[];
    v_reports integer := 0;
    v_comments integer := 0;
    v_notifications integer := 0;
    v_documents integer := 0;
    v_evidence integer := 0;
    v_document_paths text[] := ARRAY[]::text[];
BEGIN
    SELECT array_agg(DISTINCT candidate)
      INTO v_ids
      FROM unnest(p_report_ids) AS candidate
     WHERE candidate IS NOT NULL AND btrim(candidate) <> '';

    IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
        RETURN jsonb_build_object('reports', 0);
    END IF;

    -- Resolved once, before v_ids is widened. The caller authorised a specific
    -- report; deleting by the widened set could take a *second* report along
    -- with it whenever one report's original_id happens to equal another's
    -- sheet_id — which is exactly what happens while a sheet insert shifts rows.
    SELECT COALESCE(array_agg(DISTINCT r.id::text), ARRAY[]::text[])
      INTO v_report_pks
      FROM public.ground_handling_irregularity_report r
     WHERE r.id::text = ANY (v_ids)
        OR r.sheet_id = ANY (v_ids)
        OR r.original_id = ANY (v_ids);

    -- Every identifier the report is reachable by, so children written against
    -- the uuid and children written against the sheet_id both get cleaned up.
    SELECT COALESCE(array_agg(DISTINCT r.sheet_id), ARRAY[]::text[])
      INTO v_sheet_ids
      FROM public.ground_handling_irregularity_report r
     WHERE r.id::text = ANY (v_report_pks);

    v_ids := (SELECT array_agg(DISTINCT candidate) FROM unnest(v_ids || v_sheet_ids) AS candidate);

    SELECT COALESCE(array_agg(path), ARRAY[]::text[])
      INTO v_document_paths
      FROM (
          SELECT unnest(ARRAY[docx_path, pdf_path]) AS path
            FROM public.report_documents
           WHERE report_id = ANY (v_ids)
      ) paths
     WHERE path IS NOT NULL;

    DELETE FROM public.report_documents WHERE report_id = ANY (v_ids);
    GET DIAGNOSTICS v_documents = ROW_COUNT;

    -- report_comment_notifications has both a report_id and a cascading FK on
    -- comment_id; delete it explicitly so rows written against a report that no
    -- longer has comments still go.
    DELETE FROM public.report_comment_notifications WHERE report_id = ANY (v_ids);
    GET DIAGNOSTICS v_notifications = ROW_COUNT;

    DELETE FROM public.report_comments
     WHERE report_id = ANY (v_ids) OR sheet_id = ANY (v_ids);
    GET DIAGNOSTICS v_comments = ROW_COUNT;

    UPDATE public.evidence_files
       SET status = 'deleted',
           report_id = NULL,
           report_sheet_id = NULL,
           updated_at = now()
     WHERE (report_id = ANY (v_ids) OR report_sheet_id = ANY (v_ids))
       AND status <> 'deleted';
    GET DIAGNOSTICS v_evidence = ROW_COUNT;

    UPDATE public.evidence_upload_sessions
       SET report_sheet_id = NULL,
           updated_at = now()
     WHERE report_sheet_id = ANY (v_ids);

    -- Primary keys only: the children above are cleaned up by every identifier
    -- the report is reachable by, but the report rows themselves are exactly
    -- the ones resolved from the caller's candidates.
    DELETE FROM public.ground_handling_irregularity_report r
     WHERE r.id::text = ANY (v_report_pks);
    GET DIAGNOSTICS v_reports = ROW_COUNT;

    RETURN jsonb_build_object(
        'reports', v_reports,
        'comments', v_comments,
        'notifications', v_notifications,
        'documents', v_documents,
        'evidence_files', v_evidence,
        'document_paths', to_jsonb(v_document_paths)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_report_cascade(text[]) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_report_cascade(text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_report_cascade(text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_report_cascade(text[]) TO service_role;
