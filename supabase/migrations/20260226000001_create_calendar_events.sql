-- Create calendar_events table for shared team calendar (ANALYST + DIVISI_OS)
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event details
    title TEXT NOT NULL CHECK (char_length(title) <= 200),
    event_date DATE NOT NULL,
    event_time TIME,
    notes TEXT CHECK (char_length(notes) <= 2000),
    meeting_minutes_link TEXT CHECK (
        meeting_minutes_link IS NULL
        OR (meeting_minutes_link ~ '^https?://')
    ),

    -- Recurring events
    is_recurring BOOLEAN DEFAULT false NOT NULL,
    recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
    recurrence_end_date DATE,
    parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

    -- Metadata
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_recurrence CHECK (
        (is_recurring = false) OR
        (is_recurring = true AND parent_event_id IS NULL AND recurrence_pattern IS NOT NULL AND recurrence_end_date IS NOT NULL)
    ),
    CONSTRAINT valid_end_date CHECK (
        recurrence_end_date IS NULL OR recurrence_end_date > event_date
    ),
    CONSTRAINT recurrence_duration_max CHECK (
        recurrence_end_date IS NULL
        OR (recurrence_end_date - event_date) <= interval '1 year'
    )
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX idx_calendar_events_parent ON calendar_events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX idx_calendar_events_deleted ON calendar_events(deleted_at) WHERE deleted_at IS NOT NULL;

-- RLS Policies (ANALYST and DIVISI_OS only)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow ANALYST and DIVISI_OS to view all events
CREATE POLICY "calendar_events_select_policy" ON calendar_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ANALYST', 'DIVISI_OS')
        )
    );

-- Allow ANALYST and DIVISI_OS to insert events
CREATE POLICY "calendar_events_insert_policy" ON calendar_events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ANALYST', 'DIVISI_OS')
        )
        AND created_by = auth.uid()
    );

-- Allow ANALYST and DIVISI_OS to update any event
CREATE POLICY "calendar_events_update_policy" ON calendar_events
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ANALYST', 'DIVISI_OS')
        )
    );

-- Allow ANALYST and DIVISI_OS to delete any event
CREATE POLICY "calendar_events_delete_policy" ON calendar_events
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ANALYST', 'DIVISI_OS')
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_events_updated_at_trigger
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();
