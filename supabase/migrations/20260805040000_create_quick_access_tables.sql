-- Quick Access Management Tables
-- DB-driven bento grid config managed by Super Admin via /dashboard/admin/quick-access
-- Mirrors the external_links pattern: deny-by-default RLS, service-role writes,
-- reads flow through API routes (supabaseAdmin).

-- ── Sections ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_access_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    is_visible  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_access_tiles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id            UUID NOT NULL REFERENCES public.quick_access_sections(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    icon                  TEXT NOT NULL DEFAULT 'link',                 -- lucide icon name (whitelist enforced in code)
    color                 TEXT NOT NULL DEFAULT 'oklch(0.60 0.18 260)', -- oklch string
    span                  TEXT NOT NULL DEFAULT '1x1' CHECK (span IN ('1x1','2x1','2x2','4x1')),
    display_mode          TEXT NOT NULL DEFAULT 'links' CHECK (display_mode IN ('qr','links','redirect','form')),
    content               JSONB NOT NULL DEFAULT '{}'::jsonb,           -- shape depends on display_mode
    is_visible            BOOLEAN NOT NULL DEFAULT true,
    gated_by              TEXT NULL CHECK (gated_by IS NULL OR gated_by IN ('ai_enabled')),
    is_password_protected BOOLEAN NOT NULL DEFAULT false,
    password_hash         TEXT NULL,                                    -- bcrypt; NEVER exposed via public GET
    sort_order            INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Settings (feature toggles) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_access_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Form submissions (built-in form tiles) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_access_submissions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tile_id    UUID NOT NULL REFERENCES public.quick_access_tiles(id) ON DELETE CASCADE,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS: deny-by-default, service-role only (house style since July) ────
ALTER TABLE public.quick_access_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_access_tiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_access_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_access_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_sections_service"   ON public.quick_access_sections;
DROP POLICY IF EXISTS "qa_tiles_service"      ON public.quick_access_tiles;
DROP POLICY IF EXISTS "qa_settings_service"   ON public.quick_access_settings;
DROP POLICY IF EXISTS "qa_submissions_service" ON public.quick_access_submissions;

CREATE POLICY "qa_sections_service" ON public.quick_access_sections
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "qa_tiles_service" ON public.quick_access_tiles
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "qa_settings_service" ON public.quick_access_settings
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "qa_submissions_service" ON public.quick_access_submissions
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.quick_access_sections   FROM anon, authenticated;
REVOKE ALL ON public.quick_access_tiles      FROM anon, authenticated;
REVOKE ALL ON public.quick_access_settings   FROM anon, authenticated;
REVOKE ALL ON public.quick_access_submissions FROM anon, authenticated;

-- ── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qa_tiles_section ON public.quick_access_tiles (section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_qa_submissions_tile ON public.quick_access_submissions (tile_id, created_at DESC);

-- ── updated_at triggers (shared set_updated_at from external_links migration) ──
DROP TRIGGER IF EXISTS trg_qa_sections_updated ON public.quick_access_sections;
CREATE TRIGGER trg_qa_sections_updated
    BEFORE UPDATE ON public.quick_access_sections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_tiles_updated ON public.quick_access_tiles;
CREATE TRIGGER trg_qa_tiles_updated
    BEFORE UPDATE ON public.quick_access_tiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_qa_settings_updated ON public.quick_access_settings;
CREATE TRIGGER trg_qa_settings_updated
    BEFORE UPDATE ON public.quick_access_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Comments ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.quick_access_sections IS 'Bento grid sections (Quick Access), managed by Super Admin.';
COMMENT ON TABLE public.quick_access_tiles IS 'Bento grid tiles (Quick Access), managed by Super Admin. password_hash is bcrypt and never exposed via public reads.';
COMMENT ON TABLE public.quick_access_settings IS 'Quick Access feature toggles: ai_enabled, quick_access_enabled.';
COMMENT ON TABLE public.quick_access_submissions IS 'Built-in form tile submissions.';

-- ── Seeds (idempotent) ─────────────────────────────────────────────────
INSERT INTO public.quick_access_settings (key, value)
VALUES
    ('ai_enabled', 'false'::jsonb),
    ('quick_access_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Fixed UUIDs make the seed idempotent and referenceable.
INSERT INTO public.quick_access_sections (id, title, description, sort_order, is_visible)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'Akses Cepat', 'Akses cepat ke tool dan formulir operasional.', 0, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quick_access_tiles (
    id, section_id, title, description, icon, color, span, display_mode, content,
    is_visible, gated_by, is_password_protected, password_hash, sort_order
) VALUES
    -- AI "I am in Charge" — hidden by default, gated by ai_enabled setting
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
     'I am in Charge', 'Tanya asisten AI untuk bantuan operasional.',
     'bot', 'oklch(0.60 0.18 260)', '2x2', 'links',
     '{"links":[{"label":"Buka Virtual Assistant","sublabel":"Powered by Gapura RAG","url":"/virtual-assistant"}]}'::jsonb,
     false, 'ai_enabled', false, NULL, 0),
    -- Irregularity Report
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
     'Irregularity Report', 'Akses cepat pelaporan internal.',
     'alert-triangle', 'oklch(0.55 0.22 30)', '2x2', 'redirect',
     '{"label":"Buka Quick Access Irregularity","url":"/auth/public-report"}'::jsonb,
     true, NULL, false, NULL, 1),
    -- JOUMPA
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
     'JOUMPA', 'Staff JOUMPA report access.',
     'qr-code', 'oklch(0.50 0.15 190)', '1x1', 'qr',
     '{"qrLinks":[{"label":"Staff JOUMPA Report","url":"https://forms.gle/QTP5vvwbmJxDroSB7"}]}'::jsonb,
     true, NULL, false, NULL, 2),
    -- Pengisian Report SLA — hidden by default
    ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
     'Pengisian Report SLA', 'Akses cepat pengisian laporan SLA.',
     'clipboard-check', 'oklch(0.45 0.18 240)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Pengisian SLA Landside","url":"https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform"},{"label":"Pengisian SLA Airside","url":"https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform"}]}'::jsonb,
     false, NULL, false, NULL, 3),
    -- Survey Penumpang
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
     'Survey Penumpang', 'Bantu kami meningkatkan layanan via survey.',
     'qr-code', 'oklch(0.60 0.20 340)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Survey Penumpang","url":"https://forms.gle/G5T9yx2MBSWdXtJE7"},{"label":"JOUMPA Survey Penumpang","url":"https://forms.gle/gQpqWn2eSRqSsoJt7"}]}'::jsonb,
     true, NULL, false, NULL, 4),
    -- Weekly Service Notice
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001',
     'Weekly Service Notice', 'Akses Weekly Service Notice dalam satu link.',
     'qr-code', 'oklch(0.55 0.18 180)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Weekly Service Notice","url":"https://linktr.ee/unitservicekps"}]}'::jsonb,
     true, NULL, false, NULL, 5),
    -- Handbook SLA
    ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001',
     'Handbook SLA', 'Panduan standar layanan operasional prima.',
     'book-open', 'oklch(0.45 0.20 160)', '2x1', 'links',
     '{"links":[{"label":"Buka Handbook SLA","sublabel":"SIS Apps Dev","url":"https://sis.appsdev.my.id/"}]}'::jsonb,
     true, NULL, false, NULL, 6)
ON CONFLICT (id) DO NOTHING;
