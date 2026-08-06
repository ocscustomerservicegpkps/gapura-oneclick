-- Quick Access → Public Bento Grid restructure
-- 1. Add wizard_category to tiles (maps a tile to the PublicReportWizard form flow).
-- 2. Hide the old employee-style seeded section ("Akses Cepat") — the public
--    page is now the only quick access surface; super admin can delete it.
-- 3. Seed the 5 public sections + 13 tiles matching /auth/public-report.

-- ── wizard_category column ──────────────────────────────────────────────
ALTER TABLE public.quick_access_tiles
    ADD COLUMN IF NOT EXISTS wizard_category TEXT
    CHECK (wizard_category IS NULL OR wizard_category IN ('Irregularity', 'JOUMPA'));

COMMENT ON COLUMN public.quick_access_tiles.wizard_category
    IS 'When set, clicking the tile opens the PublicReportWizard form for this category instead of a content modal.';

-- ── Hide the old employee section ───────────────────────────────────────
UPDATE public.quick_access_sections
SET is_visible = false
WHERE id = '10000000-0000-4000-8000-000000000001';

-- ── New public sections (fixed UUIDs, idempotent) ───────────────────────
INSERT INTO public.quick_access_sections (id, title, description, sort_order, is_visible)
VALUES
    ('30000000-0000-4000-8000-000000000001', 'AI Assistant', '', 0, true),
    ('30000000-0000-4000-8000-000000000002', 'Irregularity, Complaint & Compliment Reports', '', 1, true),
    ('30000000-0000-4000-8000-000000000003', 'Passenger Survey Reports', '', 2, true),
    ('30000000-0000-4000-8000-000000000004', 'Form & Reports', '', 3, true),
    ('30000000-0000-4000-8000-000000000005', 'Documents / Guideline', '', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ── New tiles (fixed UUIDs, idempotent) ─────────────────────────────────
-- Values mirror PublicReportWizard CATEGORIES (colors/spans/urls).
INSERT INTO public.quick_access_tiles (
    id, section_id, title, description, icon, color, span, display_mode, content,
    is_visible, gated_by, wizard_category, is_password_protected, password_hash, sort_order
) VALUES
    -- AI Assistant
    ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
     'I''m in Charge Virtual Assistant', 'Ask the AI assistant for operational help.',
     'bot', 'oklch(0.60 0.18 260)', '2x2', 'links',
     '{"links":[{"label":"Buka Virtual Assistant","sublabel":"Powered by Gapura RAG","url":"/virtual-assistant"}]}'::jsonb,
     true, 'ai_enabled', NULL, false, NULL, 0),
    -- Irregularity, Complaint & Compliment Reports
    ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
     'Ground Handling Irregularity Report', 'Report ground handling operational issues, damage, or irregularities.',
     'alert-triangle', 'oklch(0.55 0.22 30)', '2x2', 'links',
     '{}'::jsonb,
     true, NULL, 'Irregularity', false, NULL, 0),
    ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002',
     'Joumpa Irregularity Report', 'Report operational issues, damage, or irregularities related to JOUMPA service.',
     'alert-triangle', 'oklch(0.50 0.15 190)', '2x2', 'links',
     '{}'::jsonb,
     true, NULL, 'JOUMPA', false, NULL, 1),
    -- Passenger Survey Reports
    ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003',
     'Customer Airline Passenger Survey', 'Help us improve our service via passenger survey.',
     'qr-code', 'oklch(0.60 0.20 340)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Passenger Survey","url":"https://forms.gle/G5T9yx2MBSWdXtJE7"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 0),
    ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003',
     'Joumpa Customer Survey', 'Help us improve JOUMPA service via customer survey.',
     'qr-code', 'oklch(0.52 0.17 300)', '2x1', 'qr',
     '{"qrLinks":[{"label":"JOUMPA Customer Survey","url":"https://forms.gle/gQpqWn2eSRqSsoJt7"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 1),
    -- Form & Reports
    ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000004',
     '[DOS] Direct Observation Form', 'Quick access to the Direct Observation Form submission.',
     'eye', 'oklch(0.50 0.18 250)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Direct Observation Form","url":"https://forms.gle/HScxeQyiSLVdyYWe6"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 0),
    ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000004',
     'Form SLA Report', 'Quick access to SLA report submission.',
     'clipboard-check', 'oklch(0.45 0.18 240)', '2x1', 'qr',
     '{"qrLinks":[{"label":"SLA Landside Submission","url":"https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform"},{"label":"SLA Airside Submission","url":"https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 1),
    ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000004',
     'Form Inspeksi Health, Safety & Environment', 'HEALTH, SAFETY & ENVIRONMENT (HSE)',
     'shield-check', 'oklch(0.62 0.22 28)', '2x1', 'qr',
     '{"qrLinks":[{"label":"HSSE Report Form","url":"https://forms.office.com/pages/responsepage.aspx?id=UN958i0U-k6wuwHqZRjbWCdrrO6qSgFPtKjbarMtEydUN0ZaM0tJODFONktURkpZUE45TFpNQ1hJOC4u&origin=lprLink&route=shorturl"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 2),
    ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000004',
     'HSSE Report', 'Quick QR access and redirect to the HSSE Report portal.',
     'alert-triangle', 'oklch(0.58 0.2 35)', '2x1', 'qr',
     '{"qrLinks":[{"label":"HSSE Report","url":"https://linktr.ee/HSSE_GP#538968339"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 3),
    -- Documents / Guideline
    ('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000005',
     'Standard Appearance Manual (SAM)', 'Operational standard appearance guideline.',
     'shirt', 'oklch(0.50 0.16 200)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Standard Appearance Manual (SAM)","url":"https://gapura-my.sharepoint.com/:b:/g/personal/unitserviceskps_gapura_id/IQBewqRkUXZ5TK3Q6VYSi7WSAdM275R3brwefrVQDnxsC28?e=RZG93D"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 0),
    ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000005',
     'Weekly Service Notice', 'Access the Weekly Service Notice in one link.',
     'activity', 'oklch(0.55 0.18 180)', '2x1', 'qr',
     '{"qrLinks":[{"label":"Weekly Service Notice","url":"https://linktr.ee/unitservicekps"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 1),
    ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000005',
     'Handbook SLA', 'Operational service standards handbook.',
     'book-open', 'oklch(0.45 0.20 160)', '2x1', 'links',
     '{"links":[{"label":"Open Handbook SLA","sublabel":"SIS Apps Dev","url":"https://sis.appsdev.my.id/"}]}'::jsonb,
     true, NULL, NULL, false, NULL, 2)
ON CONFLICT (id) DO NOTHING;
