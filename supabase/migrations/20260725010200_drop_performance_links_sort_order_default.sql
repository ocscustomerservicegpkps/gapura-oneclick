-- app/api/performance-links/route.ts POST always computes and supplies an
-- explicit sort_order; drop the default so a future caller can't silently
-- insert everything at position 0.
ALTER TABLE public.performance_links
  ALTER COLUMN sort_order DROP DEFAULT;
