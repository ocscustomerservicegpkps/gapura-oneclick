-- Add calendar_type column to calendar_events
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS calendar_type TEXT NOT NULL DEFAULT 'event' CHECK (calendar_type IN ('meeting', 'event'));

-- Create index for calendar_type
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(calendar_type) WHERE deleted_at IS NULL;

-- Update existing events to be 'event' type (they were created before this field existed)
UPDATE calendar_events SET calendar_type = 'event' WHERE calendar_type IS NULL;

-- Drop and recreate RLS policies to include calendar_type filter
DROP POLICY IF EXISTS "calendar_events_select_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete_policy" ON calendar_events;

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
