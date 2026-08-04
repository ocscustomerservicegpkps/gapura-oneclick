ALTER TABLE public.performance_links
    ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'ground-handling';

ALTER TABLE public.performance_links
    DROP CONSTRAINT IF EXISTS performance_links_category_check;
ALTER TABLE public.performance_links
    ADD CONSTRAINT performance_links_category_check CHECK (category IN ('ground-handling', 'joumpa'));

UPDATE public.performance_links
SET category = 'joumpa'
WHERE category = 'ground-handling'
    AND (lower(title) || ' ' || lower(coalesce(description, ''))) ~ '(joumpa|meet[\s-]?and[\s-]?greet|premium\s*service|vip)';

CREATE INDEX IF NOT EXISTS idx_performance_links_category ON public.performance_links (category);
