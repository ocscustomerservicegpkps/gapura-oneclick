-- Allow ANALYST as a valid division in division_documents.
-- The original CHECK constraint only covers HC and HT.
ALTER TABLE public.division_documents
    DROP CONSTRAINT IF EXISTS division_documents_division_check;

ALTER TABLE public.division_documents
    ADD CONSTRAINT division_documents_division_check
    CHECK (division IN ('HC', 'HT', 'ANALYST'));

-- Allow the new categories added for analyst documents.
ALTER TABLE public.division_documents
    DROP CONSTRAINT IF EXISTS division_documents_category_check;

ALTER TABLE public.division_documents
    ADD CONSTRAINT division_documents_category_check
    CHECK (category IN (
        'SAM_HANDBOOK',
        'EDARAN_DIREKSI',
        'MATERI_SOSIALISASI',
        'NOTULENSI_RAPAT',
        'TRAINING_MATERIAL',
        'DOKUMEN_LAIN',
        'NOTICE',
        'MANUAL'
    ));
