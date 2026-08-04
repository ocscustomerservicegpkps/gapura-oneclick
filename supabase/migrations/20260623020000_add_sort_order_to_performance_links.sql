ALTER TABLE public.performance_links
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
    FROM public.performance_links
)
UPDATE public.performance_links pl
SET sort_order = ordered.rn
FROM ordered
WHERE pl.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_performance_links_sort_order ON public.performance_links (sort_order);
