ALTER TABLE public.division_documents
    ADD COLUMN IF NOT EXISTS meeting_title text NULL,
    ADD COLUMN IF NOT EXISTS meeting_date date NULL,
    ADD COLUMN IF NOT EXISTS audience_label text NULL;

ALTER TABLE public.division_documents
    DROP CONSTRAINT IF EXISTS division_documents_visibility_scope_check;

ALTER TABLE public.division_documents
    ADD CONSTRAINT division_documents_visibility_scope_check
    CHECK (visibility_scope IN ('all', 'stations', 'roles', 'targeted'));

CREATE INDEX IF NOT EXISTS idx_division_documents_meeting_date
    ON public.division_documents(meeting_date DESC);
