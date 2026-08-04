ALTER TABLE public.reports_sync
    ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE INDEX IF NOT EXISTS idx_reports_sync_source_fingerprint
    ON public.reports_sync(source_fingerprint);

COMMENT ON COLUMN public.reports_sync.source_fingerprint IS
    'Stable fingerprint derived from normalized source row contents for notification dedupe and row relinking.';

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE INDEX IF NOT EXISTS idx_reports_source_fingerprint
    ON public.reports(source_fingerprint);

COMMENT ON COLUMN public.reports.source_fingerprint IS
    'Stable fingerprint mirrored from reports_sync to keep legacy sheet references aligned.';
