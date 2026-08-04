-- Optional cover photo for performance links, uploaded by the analyst.
ALTER TABLE public.performance_links
    ADD COLUMN IF NOT EXISTS thumbnail_url text NULL;
