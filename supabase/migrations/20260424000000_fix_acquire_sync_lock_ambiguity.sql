-- Fix: PG42702 ambiguous column "source" in acquire_sync_lock.
-- RETURNS TABLE column "source" shadows sync_state.source inside function body.
-- Resolution: alias return column to "sync_source" and update callers.
-- Caller (lib/sync-state.ts) maps sync_source back to source after destructure.
--
-- Must DROP first: PG forbids CREATE OR REPLACE when return type changes (42P13).
DROP FUNCTION IF EXISTS public.acquire_sync_lock(text, integer);

CREATE OR REPLACE FUNCTION public.acquire_sync_lock(
  p_source text,
  p_lock_seconds integer DEFAULT 300
)
RETURNS TABLE (
  acquired boolean,
  sync_source text,
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
    ss.source AS sync_source,
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
