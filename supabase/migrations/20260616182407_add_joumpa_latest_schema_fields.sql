ALTER TABLE public.joumpa_reports_sync
  ADD COLUMN IF NOT EXISTS final_remarks TEXT,
  ADD COLUMN IF NOT EXISTS kps_remarks TEXT,
  ADD COLUMN IF NOT EXISTS customer_satisfaction_score TEXT,
  ADD COLUMN IF NOT EXISTS customer_satisfaction_label TEXT,
  ADD COLUMN IF NOT EXISTS customer_joumpa TEXT,
  ADD COLUMN IF NOT EXISTS detail_customer_joumpa TEXT,
  ADD COLUMN IF NOT EXISTS corporate TEXT,
  ADD COLUMN IF NOT EXISTS customer_company_profile_corporate TEXT,
  ADD COLUMN IF NOT EXISTS detail_customer_corporate TEXT,
  ADD COLUMN IF NOT EXISTS non_corporate TEXT,
  ADD COLUMN IF NOT EXISTS customer_background_non_corporate TEXT,
  ADD COLUMN IF NOT EXISTS detail_customer_non_corporate TEXT,
  ADD COLUMN IF NOT EXISTS case_joumpa TEXT,
  ADD COLUMN IF NOT EXISTS airport_name TEXT,
  ADD COLUMN IF NOT EXISTS airport_code TEXT,
  ADD COLUMN IF NOT EXISTS branch_code TEXT;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_case_joumpa
  ON public.joumpa_reports_sync(case_joumpa)
  WHERE case_joumpa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_joumpa_reports_sync_customer_joumpa
  ON public.joumpa_reports_sync(customer_joumpa)
  WHERE customer_joumpa IS NOT NULL;
