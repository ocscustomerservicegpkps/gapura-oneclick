-- Rate limits table for persistent serverless rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on key for upsert patterns
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_unique ON public.rate_limits (key);

-- Auto-cleanup: delete expired entries older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits WHERE reset_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
