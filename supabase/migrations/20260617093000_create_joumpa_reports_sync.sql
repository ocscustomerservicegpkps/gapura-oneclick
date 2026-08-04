CREATE TABLE IF NOT EXISTS public.joumpa_reports_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT UNIQUE NOT NULL,
  source_sheet TEXT DEFAULT 'Form Responses 1',
  source_spreadsheet_id TEXT,
  source_fingerprint TEXT,
  row_number INTEGER,
  no TEXT,

  -- Form timestamps
  timestamp_raw TEXT,
  form_timestamp TIMESTAMPTZ,
  date_of_event DATE,
  incident_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_version INTEGER DEFAULT 1,

  -- Reporter and flight context
  report_by TEXT,
  reporter_name TEXT,
  email_address TEXT,
  reporter_email TEXT,
  jenis_maskapai TEXT,
  airlines TEXT,
  airline TEXT,
  flight_number TEXT,
  station TEXT,
  station_code TEXT,
  branch TEXT,
  hub TEXT,
  route TEXT,
  delay_code TEXT,

  -- Report dimensions
  category_report TEXT,
  category TEXT,
  main_category TEXT,
  area TEXT,
  service_business_type TEXT DEFAULT 'Joumpa Service',
  status TEXT DEFAULT 'OPEN',
  severity TEXT DEFAULT 'LOW',
  severity_level TEXT,

  -- Case detail
  report TEXT,
  title TEXT,
  description TEXT,
  root_caused TEXT,
  root_cause TEXT,
  action_taken TEXT,
  immediate_action TEXT,
  preventive_action TEXT,
  category_case_joumpa TEXT,
  joumpa_compliment_report_excellent_service TEXT,
  reservation_scheduling TEXT,
  pax_assistance_staff_service_performance TEXT,
  baggage_delivery_baggage_assistance TEXT,
  administration_payment_documentation_marketing TEXT,
  case_category TEXT,
  remarks_case TEXT,
  case_classification TEXT,
  identification_of_root TEXT,

  -- Evidence
  supporting_evidence TEXT,
  evidence_url TEXT,
  evidence_urls TEXT[],

  -- Flexible raw backup for schema drift
  raw_data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_sheet_id
  ON public.joumpa_reports_sync(sheet_id);

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_date_of_event
  ON public.joumpa_reports_sync(date_of_event DESC);

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_branch
  ON public.joumpa_reports_sync(branch)
  WHERE branch IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_airlines
  ON public.joumpa_reports_sync(airlines)
  WHERE airlines IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_category
  ON public.joumpa_reports_sync(category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_case_category
  ON public.joumpa_reports_sync(case_category)
  WHERE case_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_source_fingerprint
  ON public.joumpa_reports_sync(source_fingerprint)
  WHERE source_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_joumpa_reports_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

REVOKE ALL ON FUNCTION public.update_joumpa_reports_sync_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_joumpa_reports_sync_updated_at() TO service_role;

DROP TRIGGER IF EXISTS trigger_joumpa_reports_sync_updated_at ON public.joumpa_reports_sync;
CREATE TRIGGER trigger_joumpa_reports_sync_updated_at
  BEFORE UPDATE ON public.joumpa_reports_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_joumpa_reports_sync_updated_at();

ALTER TABLE public.joumpa_reports_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "joumpa_reports_sync_authenticated_read" ON public.joumpa_reports_sync;
CREATE POLICY "joumpa_reports_sync_authenticated_read"
  ON public.joumpa_reports_sync
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.joumpa_reports_sync TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.joumpa_reports_sync TO service_role;

COMMENT ON TABLE public.joumpa_reports_sync IS 'Synced Joumpa reports from the dedicated JOUMPA Google Sheet.';
COMMENT ON COLUMN public.joumpa_reports_sync.raw_data IS 'Original row payload keyed by Google Sheets header, kept for future schema drift.';
