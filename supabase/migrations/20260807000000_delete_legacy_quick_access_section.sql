-- Delete the legacy employee-style "Akses Cepat" section + its 7 tiles.
-- It was seeded in 20260805040000 and only hidden (is_visible=false) in
-- 20260805050000 — the admin editor still showed it above the public
-- sections. The public sections are the only quick access surface now.
DELETE FROM public.quick_access_tiles
WHERE section_id = '10000000-0000-4000-8000-000000000001';

DELETE FROM public.quick_access_sections
WHERE id = '10000000-0000-4000-8000-000000000001';
