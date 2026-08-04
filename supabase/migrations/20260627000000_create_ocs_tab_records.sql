-- OCS dashboard tab records: one table backs all three tabs
-- (reminder series, joumpa evaluation, RCA). Discriminated by `tab`.
-- All attachment fields are pasted URLs (no file upload). Managed by ANALYST.
CREATE TABLE IF NOT EXISTS public.ocs_tab_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tab text NOT NULL CHECK (tab IN ('reminder', 'joumpa', 'rca')),
    event_date date NULL,
    agenda text NULL,
    series text NULL,          -- Seri Reminder Series / Sesi Joumpa Assessment
    location text NULL,        -- Tempat / Lokasi
    pic text NULL,             -- PIC / DIVISI
    branch text NULL,          -- Cabang
    airline text NULL,         -- RCA Airlines
    participants text NULL,    -- Peserta
    case_report text NULL,     -- Data Case Report / Case Report RCA
    remarks text NULL,         -- RCA Remarks
    report_url text NULL,      -- Upload link Report (Word/PDF/PPT)
    materi_url text NULL,      -- Upload link Materi (PPT/PDF)
    attendance_url text NULL,  -- Upload link Daftar Kehadiran (Excel)
    record_url text NULL,      -- Record / RCA detail document
    created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocs_tab_records_tab ON public.ocs_tab_records(tab, event_date DESC);
