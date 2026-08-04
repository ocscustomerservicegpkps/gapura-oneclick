-- Reports Sync Table
-- Syncs data from Google Sheets to Supabase for faster reads
-- Eliminates Google Sheets API as read bottleneck

CREATE TABLE IF NOT EXISTS reports_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT UNIQUE NOT NULL,
  
  -- Core fields
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  reporter_email TEXT,
  evidence_url TEXT,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'BARU',
  severity TEXT DEFAULT 'medium',
  priority TEXT DEFAULT 'medium',
  
  -- Flight Info
  flight_number TEXT,
  aircraft_reg TEXT,
  is_flight_related BOOLEAN DEFAULT FALSE,
  
  -- GSE Info
  gse_number TEXT,
  gse_name TEXT,
  is_gse_related BOOLEAN DEFAULT FALSE,
  
  -- Categorization (using TEXT to match existing schema)
  station_id TEXT,
  unit_id TEXT,
  location_id TEXT,
  incident_type_id TEXT,
  category TEXT,
  main_category TEXT,
  
  -- Investigation
  investigator_notes TEXT,
  manager_notes TEXT,
  partner_response_notes TEXT,
  validation_notes TEXT,
  partner_evidence_urls TEXT[],
  
  -- Source tracking
  source_sheet TEXT,
  original_id TEXT,
  row_number INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  incident_date DATE,
  date_of_event DATE,
  
  -- Branch/Station fields
  reporting_branch TEXT,
  hub TEXT,
  route TEXT,
  branch TEXT,
  station_code TEXT,
  reporter_name TEXT,
  
  -- Additional fields
  specific_location TEXT,
  airlines TEXT,
  airline TEXT,
  jenis_maskapai TEXT,
  reference_number TEXT,
  root_caused TEXT,
  root_cause TEXT,
  action_taken TEXT,
  immediate_action TEXT,
  kps_remarks TEXT,
  gapura_kps_action_taken TEXT,
  preventive_action TEXT,
  remarks_gapura_kps TEXT,
  area TEXT,
  terminal_area_category TEXT,
  apron_area_category TEXT,
  general_category TEXT,
  week_in_month TEXT,
  report TEXT,
  irregularity_complain_category TEXT,
  kode_cabang TEXT,
  kode_hub TEXT,
  maskapai_lookup TEXT,
  case_classification TEXT,
  lokal_mpa_lookup TEXT,
  
  -- Delay Info
  delay_code TEXT,
  delay_duration TEXT,
  
  -- Triage Fields
  primary_tag TEXT,
  sub_category_note TEXT,
  target_division TEXT,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_version INTEGER DEFAULT 1
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reports_sync_user_id ON reports_sync(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_station_id ON reports_sync(station_id) WHERE station_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_branch ON reports_sync(branch) WHERE branch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_hub ON reports_sync(hub) WHERE hub IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_status ON reports_sync(status);
CREATE INDEX IF NOT EXISTS idx_reports_sync_date_of_event ON reports_sync(date_of_event DESC);
CREATE INDEX IF NOT EXISTS idx_reports_sync_created_at ON reports_sync(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_sync_main_category ON reports_sync(main_category);
CREATE INDEX IF NOT EXISTS idx_reports_sync_primary_tag ON reports_sync(primary_tag);
CREATE INDEX IF NOT EXISTS idx_reports_sync_target_division ON reports_sync(target_division);
CREATE INDEX IF NOT EXISTS idx_reports_sync_synced_at ON reports_sync(synced_at DESC);

-- Compound indexes for RBAC filtering
CREATE INDEX IF NOT EXISTS idx_reports_sync_user_status ON reports_sync(user_id, status) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_station_status ON reports_sync(station_id, status) WHERE station_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_branch_status ON reports_sync(branch, status) WHERE branch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_sync_date_category ON reports_sync(date_of_event DESC, main_category);

-- Sync metadata index
CREATE INDEX IF NOT EXISTS idx_reports_sync_sheet_id ON reports_sync(sheet_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_reports_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reports_sync_updated_at
  BEFORE UPDATE ON reports_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_sync_updated_at();

-- Grant permissions (adjust as needed for your RLS policies)
ALTER TABLE reports_sync ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON reports_sync FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins and analysts can view all reports
CREATE POLICY "Admins and analysts can view all reports"
  ON reports_sync FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPER_ADMIN', 'ANALYST')
    )
  );

-- Policy: Division heads can view reports for their division
CREATE POLICY "Division heads can view division reports"
  ON reports_sync FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role LIKE 'DIVISI_%'
      AND (
        reports_sync.target_division = substring(users.role from 'DIVISI_(.+)')
        OR reports_sync.target_division IS NULL
      )
    )
  );

-- Policy: Branch managers can view reports for their station
CREATE POLICY "Branch managers can view station reports"
  ON reports_sync FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'MANAGER_CABANG'
      AND users.station_id::text = reports_sync.station_id::text
    )
  );

-- Policy: Staff can view reports from their station
CREATE POLICY "Staff can view station reports"
  ON reports_sync FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'STAFF_CABANG'
      AND (
        users.station_id::text = reports_sync.station_id::text
        OR reports_sync.user_id = auth.uid()
      )
    )
  );

-- Comment for documentation
COMMENT ON TABLE reports_sync IS 'Synced reports from Google Sheets for fast reads. Updated periodically via sync job.';
COMMENT ON COLUMN reports_sync.sheet_id IS 'Unique identifier from Google Sheets (e.g., "NON CARGO!row_2")';
COMMENT ON COLUMN reports_sync.synced_at IS 'Timestamp when this record was last synced from Sheets';
COMMENT ON COLUMN reports_sync.sync_version IS 'Incremented on each sync for change tracking';
