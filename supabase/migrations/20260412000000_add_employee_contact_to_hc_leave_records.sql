ALTER TABLE public.hc_leave_records
    ADD COLUMN IF NOT EXISTS employee_email text NULL,
    ADD COLUMN IF NOT EXISTS employee_phone text NULL;
