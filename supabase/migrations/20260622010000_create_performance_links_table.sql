-- Performance Evaluation Monitoring: external links managed by the analyst
-- role, viewed (with auto-generated QR codes) by the eskalasi role.
CREATE TABLE IF NOT EXISTS public.performance_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    url text NOT NULL,
    description text NULL,
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_links_active ON public.performance_links(is_active, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_performance_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_performance_links_updated_at ON public.performance_links;
CREATE TRIGGER trigger_performance_links_updated_at
    BEFORE UPDATE ON public.performance_links
    FOR EACH ROW EXECUTE FUNCTION public.set_performance_links_updated_at();
