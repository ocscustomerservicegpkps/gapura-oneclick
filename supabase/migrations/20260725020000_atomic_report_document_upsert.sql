-- Atomic upsert for report_documents that returns the storage paths of the
-- row it replaced (if any), so the caller can derive superseded-object
-- cleanup exclusively from what its own call actually replaced instead of a
-- pre-upload read that races with concurrent saves for the same report.
CREATE OR REPLACE FUNCTION public.upsert_report_document_bundle(
    p_report_type text,
    p_report_id text,
    p_revision_id uuid,
    p_docx_path text,
    p_docx_filename text,
    p_docx_mime_type text,
    p_docx_size_bytes bigint,
    p_docx_sha256 text,
    p_pdf_path text,
    p_pdf_filename text,
    p_pdf_mime_type text,
    p_pdf_size_bytes bigint,
    p_pdf_sha256 text,
    p_edited_snapshot jsonb,
    p_signature_sha256 text,
    p_created_by uuid
)
RETURNS TABLE (
    id uuid,
    report_type text,
    report_id text,
    revision_id uuid,
    docx_path text,
    docx_filename text,
    docx_mime_type text,
    docx_size_bytes bigint,
    docx_sha256 text,
    pdf_path text,
    pdf_filename text,
    pdf_mime_type text,
    pdf_size_bytes bigint,
    pdf_sha256 text,
    edited_snapshot jsonb,
    signature_sha256 text,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz,
    previous_docx_path text,
    previous_pdf_path text
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_prev_docx_path text;
    v_prev_pdf_path text;
BEGIN
    -- Serialize concurrent calls for the same (report_type, report_id) —
    -- including the case where no row exists yet, which a plain
    -- `SELECT ... FOR UPDATE` cannot lock — so two racing saves never both
    -- read the same "previous" state and orphan each other's uploads.
    PERFORM pg_advisory_xact_lock(hashtext(p_report_type || ':' || p_report_id));

    SELECT rd.docx_path, rd.pdf_path
      INTO v_prev_docx_path, v_prev_pdf_path
      FROM public.report_documents rd
     WHERE rd.report_type = p_report_type
       AND rd.report_id = p_report_id
     FOR UPDATE;

    RETURN QUERY
    INSERT INTO public.report_documents AS rd (
        report_type, report_id, revision_id,
        docx_path, docx_filename, docx_mime_type, docx_size_bytes, docx_sha256,
        pdf_path, pdf_filename, pdf_mime_type, pdf_size_bytes, pdf_sha256,
        edited_snapshot, signature_sha256, created_by, updated_at
    )
    VALUES (
        p_report_type, p_report_id, p_revision_id,
        p_docx_path, p_docx_filename, p_docx_mime_type, p_docx_size_bytes, p_docx_sha256,
        p_pdf_path, p_pdf_filename, p_pdf_mime_type, p_pdf_size_bytes, p_pdf_sha256,
        p_edited_snapshot, p_signature_sha256, p_created_by, now()
    )
    ON CONFLICT (report_type, report_id) DO UPDATE SET
        revision_id = EXCLUDED.revision_id,
        docx_path = EXCLUDED.docx_path,
        docx_filename = EXCLUDED.docx_filename,
        docx_mime_type = EXCLUDED.docx_mime_type,
        docx_size_bytes = EXCLUDED.docx_size_bytes,
        docx_sha256 = EXCLUDED.docx_sha256,
        pdf_path = EXCLUDED.pdf_path,
        pdf_filename = EXCLUDED.pdf_filename,
        pdf_mime_type = EXCLUDED.pdf_mime_type,
        pdf_size_bytes = EXCLUDED.pdf_size_bytes,
        pdf_sha256 = EXCLUDED.pdf_sha256,
        edited_snapshot = EXCLUDED.edited_snapshot,
        signature_sha256 = EXCLUDED.signature_sha256,
        created_by = EXCLUDED.created_by,
        updated_at = EXCLUDED.updated_at
    RETURNING
        rd.id, rd.report_type, rd.report_id, rd.revision_id,
        rd.docx_path, rd.docx_filename, rd.docx_mime_type, rd.docx_size_bytes, rd.docx_sha256,
        rd.pdf_path, rd.pdf_filename, rd.pdf_mime_type, rd.pdf_size_bytes, rd.pdf_sha256,
        rd.edited_snapshot, rd.signature_sha256, rd.created_by, rd.created_at, rd.updated_at,
        v_prev_docx_path, v_prev_pdf_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_report_document_bundle(
    text, text, uuid, text, text, text, bigint, text, text, text, text, bigint, text, jsonb, text, uuid
) FROM public;
REVOKE EXECUTE ON FUNCTION public.upsert_report_document_bundle(
    text, text, uuid, text, text, text, bigint, text, text, text, text, bigint, text, jsonb, text, uuid
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_report_document_bundle(
    text, text, uuid, text, text, text, bigint, text, text, text, text, bigint, text, jsonb, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_report_document_bundle(
    text, text, uuid, text, text, text, bigint, text, text, text, text, bigint, text, jsonb, text, uuid
) TO service_role;
