-- Custom display label for the Materials link chip (instead of hardcoded "Materials").
ALTER TABLE public.division_documents ADD COLUMN IF NOT EXISTS materi_title text NULL;
