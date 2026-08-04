ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hc_leave_records_is_deleted
    ON public.hc_leave_records(is_deleted);
