-- Flexible list of {title, url} material links, replacing the fixed
-- external_url/materi_url/materi_title/attendance_url/recording_url slots
-- for new entries. Those legacy columns are kept for existing rows and as
-- a fallback (see lib/division-documents-material-links.ts).
ALTER TABLE public.division_documents ADD COLUMN IF NOT EXISTS material_links jsonb NOT NULL DEFAULT '[]'::jsonb;
