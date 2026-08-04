-- Structured meeting-record fields for the Circulars & Materials feature:
-- branch, airline, participants, and separate attachment links per material type.
ALTER TABLE public.division_documents
    ADD COLUMN IF NOT EXISTS station_id text NULL,
    ADD COLUMN IF NOT EXISTS airline text NULL,
    ADD COLUMN IF NOT EXISTS participants text NULL,
    ADD COLUMN IF NOT EXISTS materi_url text NULL,
    ADD COLUMN IF NOT EXISTS attendance_url text NULL,
    ADD COLUMN IF NOT EXISTS recording_url text NULL;

CREATE INDEX IF NOT EXISTS idx_division_documents_station_id ON public.division_documents (station_id);
