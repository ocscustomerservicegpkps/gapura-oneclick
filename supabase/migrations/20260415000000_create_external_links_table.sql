-- External Links Management Table
-- Stores all external URLs used across the application (forms, dashboards, etc.)
-- Managed by Super Admin via /dashboard/admin/external-links

CREATE TABLE IF NOT EXISTS public.external_links (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    url         TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('google_forms', 'looker_studio', 'other')),
    description TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;

-- Recreate policies to keep the migration idempotent in local/dev resets
DROP POLICY IF EXISTS "external_links_read_any" ON public.external_links;
DROP POLICY IF EXISTS "external_links_write_service" ON public.external_links;

-- Anyone can read (public-report page needs it)
CREATE POLICY "external_links_read_any" ON public.external_links
    FOR SELECT
    USING (true);

-- Only service role can write (admin API uses supabaseAdmin)
CREATE POLICY "external_links_write_service" ON public.external_links
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Index for category-grouped queries
CREATE INDEX IF NOT EXISTS idx_external_links_category ON public.external_links (category, sort_order);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_external_links_updated ON public.external_links;
CREATE TRIGGER trg_external_links_updated
    BEFORE UPDATE ON public.external_links
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
