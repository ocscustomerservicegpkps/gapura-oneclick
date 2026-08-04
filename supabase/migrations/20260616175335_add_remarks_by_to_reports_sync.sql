ALTER TABLE public.reports_sync
  ADD COLUMN IF NOT EXISTS remarks_by TEXT;
