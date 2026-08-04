-- OTP-based password reset (forgot password + profile password reset).
-- Codes are never stored in plaintext: only a SHA-256 hash is kept, and the
-- short-lived reset token handed out after a successful verification is
-- likewise stored hashed.

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    otp_hash text NOT NULL,
    reset_token_hash text,
    attempts integer NOT NULL DEFAULT 0,
    verified_at timestamptz,
    consumed_at timestamptz,
    expires_at timestamptz NOT NULL,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_otps_email_created_idx
    ON public.password_reset_otps (email, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_otps_expires_idx
    ON public.password_reset_otps (expires_at);

-- Service-role only: every read/write goes through the server-side API routes,
-- so no policy is granted to anon/authenticated clients.
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_otps FROM anon, authenticated;
