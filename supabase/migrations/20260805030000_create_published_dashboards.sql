-- Published dashboard share links for presentation mode.
-- Each row = one public share link: a dashboard key + tab (or '*' = whole
-- dashboard) + the filter scope the sharer chose at publish time. Live data
-- is applied to the scope on every public page load; the row itself only
-- carries metadata.
CREATE TABLE IF NOT EXISTS public.published_dashboards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  dashboard_key text NOT NULL,
  tab           text NOT NULL,
  name          text,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS published_dashboards_created_by_idx
  ON public.published_dashboards (created_by)
  WHERE revoked_at IS NULL;

ALTER TABLE public.published_dashboards ENABLE ROW LEVEL SECURITY;

-- Owners manage their own active links.
CREATE POLICY published_dashboards_owner_select
  ON public.published_dashboards
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY published_dashboards_owner_insert
  ON public.published_dashboards
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY published_dashboards_owner_update
  ON public.published_dashboards
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY published_dashboards_owner_delete
  ON public.published_dashboards
  FOR DELETE
  USING (created_by = auth.uid());

-- Public slug lookup: security definer so anonymous visitors can resolve an
-- active link without exposing owner metadata. Returns only the columns the
-- public page needs; revoked rows are invisible.
CREATE OR REPLACE FUNCTION public.get_active_published_dashboard(p_slug text)
RETURNS TABLE (
  id            uuid,
  slug          text,
  dashboard_key text,
  tab           text,
  name          text,
  config        jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, dashboard_key, tab, name, config
  FROM public.published_dashboards
  WHERE slug = p_slug AND revoked_at IS NULL
  LIMIT 1;
$$;

-- Explicit grants per the repo's function-hardening convention: the share page
-- resolves links server-side (service_role), but keep the surface identical
-- for any caller without silently widening default PUBLIC execute.
REVOKE EXECUTE ON FUNCTION public.get_active_published_dashboard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_published_dashboard(text) TO anon, authenticated, service_role;
