-- Security telemetry is available only through server-side, role-authorized
-- API routes. The browser anon key must not read or subscribe directly.
DROP POLICY IF EXISTS "security_events_public_read" ON public.security_events;
REVOKE ALL ON public.security_events FROM anon, authenticated;

-- Consume one rate-limit token atomically. Expired-row cleanup is deliberately
-- not performed here; cleanup_expired_rate_limits can run as scheduled
-- maintenance without adding a table-wide delete to every public request.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_key text,
    p_limit integer,
    p_reset_at timestamptz
)
RETURNS TABLE (
    allowed boolean,
    remaining integer,
    reset_at timestamptz,
    current_count integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v_reset_at timestamptz;
BEGIN
    IF p_key IS NULL OR length(trim(p_key)) = 0 OR length(p_key) > 512 THEN
        RAISE EXCEPTION 'p_key must contain between 1 and 512 characters';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 THEN
        RAISE EXCEPTION 'p_limit must be greater than zero';
    END IF;

    IF p_reset_at IS NULL OR p_reset_at <= now() THEN
        RAISE EXCEPTION 'p_reset_at must be in the future';
    END IF;

    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, p_reset_at)
    ON CONFLICT (key) DO UPDATE
    SET
        count = CASE
            WHEN public.rate_limits.reset_at <= now() THEN 1
            ELSE public.rate_limits.count + 1
        END,
        reset_at = CASE
            WHEN public.rate_limits.reset_at <= now() THEN excluded.reset_at
            ELSE public.rate_limits.reset_at
        END
    RETURNING rate_limits.count, rate_limits.reset_at
    INTO v_count, v_reset_at;

    RETURN QUERY
    SELECT
        v_count <= p_limit,
        greatest(p_limit - v_count, 0),
        v_reset_at,
        v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, timestamptz) FROM public;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, timestamptz) TO service_role;
