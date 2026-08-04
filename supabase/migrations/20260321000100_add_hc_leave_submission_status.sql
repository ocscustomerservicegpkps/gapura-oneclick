ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS submission_status text;

UPDATE public.hc_leave_records
SET submission_status = 'PENDING'
WHERE submission_status IS NULL;

ALTER TABLE public.hc_leave_records
    ALTER COLUMN submission_status SET DEFAULT 'PENDING';

ALTER TABLE public.hc_leave_records
    ALTER COLUMN submission_status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hc_leave_records_submission_status_check'
          AND conrelid = 'public.hc_leave_records'::regclass
    ) THEN
        ALTER TABLE public.hc_leave_records
            ADD CONSTRAINT hc_leave_records_submission_status_check
            CHECK (submission_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END
$$;

ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS review_notes text NULL;

CREATE INDEX IF NOT EXISTS idx_hc_leave_records_submission_status
    ON public.hc_leave_records(submission_status);

CREATE INDEX IF NOT EXISTS idx_hc_leave_records_reviewed_by
    ON public.hc_leave_records(reviewed_by);
