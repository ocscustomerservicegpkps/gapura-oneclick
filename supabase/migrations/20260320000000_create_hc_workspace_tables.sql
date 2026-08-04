CREATE TABLE IF NOT EXISTS public.hc_leave_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name text NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    submission_status text NOT NULL DEFAULT 'PENDING'
        CHECK (submission_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    station_id text NULL,
    division_name text NULL,
    unit_name text NULL,
    pic_name text NULL,
    pic_email text NULL,
    pic_phone text NULL,
    e_letter_status text NOT NULL DEFAULT 'BELUM_ADA'
        CHECK (e_letter_status IN ('BELUM_ADA', 'PENGAJUAN', 'TERBIT')),
    notes text NULL,
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz NULL,
    review_notes text NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_hc_leave_records_station_id ON public.hc_leave_records(station_id);
CREATE INDEX IF NOT EXISTS idx_hc_leave_records_start_date ON public.hc_leave_records(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_hc_leave_records_created_by ON public.hc_leave_records(created_by);
CREATE INDEX IF NOT EXISTS idx_hc_leave_records_submission_status ON public.hc_leave_records(submission_status);
CREATE INDEX IF NOT EXISTS idx_hc_leave_records_reviewed_by ON public.hc_leave_records(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_hc_leave_records_is_deleted ON public.hc_leave_records(is_deleted);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'stations'
    ) THEN
        ALTER TABLE public.hc_leave_records
            DROP CONSTRAINT IF EXISTS hc_leave_records_station_id_fkey;

        ALTER TABLE public.hc_leave_records
            ADD CONSTRAINT hc_leave_records_station_id_fkey
            FOREIGN KEY (station_id)
            REFERENCES public.stations(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.division_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    division text NOT NULL CHECK (division IN ('HC', 'HT')),
    category text NOT NULL CHECK (category IN ('SAM_HANDBOOK', 'EDARAN_DIREKSI', 'MATERI_SOSIALISASI', 'TRAINING_MATERIAL')),
    title text NOT NULL,
    description text NULL,
    source_type text NOT NULL CHECK (source_type IN ('upload', 'link')),
    file_url text NULL,
    file_name text NULL,
    file_size bigint NULL,
    mime_type text NULL,
    external_url text NULL,
    visibility_scope text NOT NULL DEFAULT 'all'
        CHECK (visibility_scope IN ('all', 'stations', 'roles')),
    audience_station_ids text[] NOT NULL DEFAULT '{}',
    audience_roles text[] NOT NULL DEFAULT '{}',
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (source_type = 'upload' AND file_url IS NOT NULL)
        OR
        (source_type = 'link' AND external_url IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_division_documents_division ON public.division_documents(division, category);
CREATE INDEX IF NOT EXISTS idx_division_documents_visibility ON public.division_documents(visibility_scope);

CREATE TABLE IF NOT EXISTS public.notification_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('EMAIL')),
    recipient_email text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_entity_channel_email
    ON public.notification_recipients(entity, channel, recipient_email);

CREATE TABLE IF NOT EXISTS public.notification_delivery_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint text NOT NULL UNIQUE,
    entity text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('EMAIL')),
    recipient_email text NOT NULL,
    subject text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    error_message text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_entity ON public.notification_delivery_log(entity, created_at DESC);

DROP TRIGGER IF EXISTS trigger_hc_leave_records_updated_at ON public.hc_leave_records;
CREATE TRIGGER trigger_hc_leave_records_updated_at
    BEFORE UPDATE ON public.hc_leave_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hc_requests_updated_at();

DROP TRIGGER IF EXISTS trigger_division_documents_updated_at ON public.division_documents;
CREATE TRIGGER trigger_division_documents_updated_at
    BEFORE UPDATE ON public.division_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hc_requests_updated_at();

DROP TRIGGER IF EXISTS trigger_notification_recipients_updated_at ON public.notification_recipients;
CREATE TRIGGER trigger_notification_recipients_updated_at
    BEFORE UPDATE ON public.notification_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hc_requests_updated_at();
