ALTER TABLE IF EXISTS public.division_documents
    ADD COLUMN IF NOT EXISTS activity_pic text NULL,
    ADD COLUMN IF NOT EXISTS activity_location text NULL;

CREATE INDEX IF NOT EXISTS idx_division_documents_activity_fields
    ON public.division_documents(category, meeting_date DESC);
