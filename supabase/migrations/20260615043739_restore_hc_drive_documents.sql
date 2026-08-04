ALTER TABLE IF EXISTS public.division_documents
    ADD COLUMN IF NOT EXISTS drive_file_id text NULL,
    ADD COLUMN IF NOT EXISTS drive_folder_id text NULL,
    ADD COLUMN IF NOT EXISTS drive_web_url text NULL,
    ADD COLUMN IF NOT EXISTS drive_content_url text NULL,
    ADD COLUMN IF NOT EXISTS uploaded_at timestamptz NULL;

ALTER TABLE IF EXISTS public.division_documents
    DROP CONSTRAINT IF EXISTS division_documents_category_check;

ALTER TABLE IF EXISTS public.division_documents
    ADD CONSTRAINT division_documents_category_check
    CHECK (
        category IN (
            'SAM_HANDBOOK',
            'EDARAN_DIREKSI',
            'MATERI_SOSIALISASI',
            'NOTULENSI_RAPAT',
            'TRAINING_MATERIAL',
            'DOKUMEN_LAIN'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_division_documents_drive_file_id
    ON public.division_documents(drive_file_id)
    WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_division_documents_audience_stations
    ON public.division_documents USING gin(audience_station_ids);

CREATE INDEX IF NOT EXISTS idx_division_documents_audience_roles
    ON public.division_documents USING gin(audience_roles);

CREATE INDEX IF NOT EXISTS idx_division_documents_created_by
    ON public.division_documents(created_by);

CREATE INDEX IF NOT EXISTS idx_division_documents_updated_by
    ON public.division_documents(updated_by);

ALTER TABLE IF EXISTS public.users
    DROP CONSTRAINT IF EXISTS users_division_check;

ALTER TABLE IF EXISTS public.users
    ADD CONSTRAINT users_division_check
    CHECK (division = ANY (ARRAY[
        'GENERAL'::text,
        'OS'::text,
        'OT'::text,
        'OP'::text,
        'UQ'::text,
        'HT'::text,
        'HC'::text
    ]));

UPDATE public.users
SET division = 'HC',
    updated_at = now()
WHERE role IN ('DIVISI_HC', 'PARTNER_HC')
  AND COALESCE(NULLIF(BTRIM(division), ''), 'GENERAL') = 'GENERAL';

ALTER TABLE IF EXISTS public.division_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.division_documents FROM anon, authenticated;
