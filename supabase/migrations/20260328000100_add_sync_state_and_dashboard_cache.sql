-- Shared sync state and dashboard snapshot cache
-- These tables replace server-local coordination for serverless deployments.

CREATE TABLE IF NOT EXISTS public.sync_state (
  source text PRIMARY KEY,
  last_sync_at timestamptz,
  sync_version bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle',
  locked_until timestamptz,
  last_error text,
  row_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sync_state (source, status)
VALUES ('reports', 'idle')
ON CONFLICT (source) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sync_state_locked_until
  ON public.sync_state (locked_until);

CREATE OR REPLACE FUNCTION public.acquire_sync_lock(
  p_source text,
  p_lock_seconds integer DEFAULT 300
)
RETURNS TABLE (
  acquired boolean,
  source text,
  last_sync_at timestamptz,
  sync_version bigint,
  status text,
  locked_until timestamptz,
  last_error text,
  row_count integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_acquired boolean := false;
BEGIN
  INSERT INTO public.sync_state (source, status)
  VALUES (p_source, 'idle')
  ON CONFLICT (source) DO NOTHING;

  UPDATE public.sync_state AS s
  SET
    status = 'syncing',
    locked_until = now() + make_interval(secs => GREATEST(p_lock_seconds, 30)),
    updated_at = now()
  WHERE s.source = p_source
    AND (s.locked_until IS NULL OR s.locked_until < now() OR s.status <> 'syncing');

  v_acquired := FOUND;

  RETURN QUERY
  SELECT
    v_acquired AS acquired,
    ss.source,
    ss.last_sync_at,
    ss.sync_version,
    ss.status,
    ss.locked_until,
    ss.last_error,
    ss.row_count,
    ss.updated_at
  FROM public.sync_state AS ss
  WHERE ss.source = p_source;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_sync_state(
  p_source text,
  p_success boolean,
  p_row_count integer DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_bump_version boolean DEFAULT false
)
RETURNS public.sync_state
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.sync_state;
BEGIN
  INSERT INTO public.sync_state (source, status)
  VALUES (p_source, 'idle')
  ON CONFLICT (source) DO NOTHING;

  UPDATE public.sync_state
  SET
    last_sync_at = CASE WHEN p_success THEN now() ELSE last_sync_at END,
    sync_version = CASE WHEN p_bump_version THEN sync_version + 1 ELSE sync_version END,
    status = CASE WHEN p_success THEN 'idle' ELSE 'error' END,
    locked_until = NULL,
    last_error = CASE WHEN p_success THEN NULL ELSE p_error END,
    row_count = COALESCE(p_row_count, row_count),
    updated_at = now()
  WHERE source = p_source
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_sync_state_version(
  p_source text,
  p_row_count integer DEFAULT NULL
)
RETURNS public.sync_state
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.sync_state;
BEGIN
  INSERT INTO public.sync_state (source, status)
  VALUES (p_source, 'idle')
  ON CONFLICT (source) DO NOTHING;

  UPDATE public.sync_state
  SET
    last_sync_at = now(),
    sync_version = sync_version + 1,
    status = 'idle',
    locked_until = NULL,
    last_error = NULL,
    row_count = COALESCE(p_row_count, row_count),
    updated_at = now()
  WHERE source = p_source
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE TABLE IF NOT EXISTS public.dashboard_cache_entries (
  cache_key text PRIMARY KEY,
  scope_key text NOT NULL,
  dashboard_slug text NOT NULL,
  tile_id uuid,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  sync_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_entries_slug
  ON public.dashboard_cache_entries (dashboard_slug);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_entries_scope
  ON public.dashboard_cache_entries (scope_key);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_entries_expires
  ON public.dashboard_cache_entries (expires_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_entries_slug_sync
  ON public.dashboard_cache_entries (dashboard_slug, sync_version);
