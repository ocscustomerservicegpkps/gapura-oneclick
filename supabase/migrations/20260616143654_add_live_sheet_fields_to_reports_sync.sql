ALTER TABLE public.reports_sync
  ADD COLUMN IF NOT EXISTS service_business_type TEXT,
  ADD COLUMN IF NOT EXISTS remarks_case TEXT,
  ADD COLUMN IF NOT EXISTS case_category TEXT,
  ADD COLUMN IF NOT EXISTS severity_level TEXT,
  ADD COLUMN IF NOT EXISTS case_cgo TEXT,
  ADD COLUMN IF NOT EXISTS supporting_evidence TEXT,
  ADD COLUMN IF NOT EXISTS category_case_joumpa TEXT,
  ADD COLUMN IF NOT EXISTS reservation_scheduling TEXT,
  ADD COLUMN IF NOT EXISTS pax_assistance_staff_service_performance TEXT,
  ADD COLUMN IF NOT EXISTS baggage_delivery_baggage_assistance TEXT,
  ADD COLUMN IF NOT EXISTS administration_payment_documentation_marketing TEXT,
  ADD COLUMN IF NOT EXISTS gse_available_requirement TEXT,
  ADD COLUMN IF NOT EXISTS gse_requirement TEXT,
  ADD COLUMN IF NOT EXISTS gse_motorized TEXT,
  ADD COLUMN IF NOT EXISTS gse_non_motorized TEXT,
  ADD COLUMN IF NOT EXISTS category_case_gse TEXT,
  ADD COLUMN IF NOT EXISTS category_case_cargo TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_sync_service_business_type
  ON public.reports_sync(service_business_type)
  WHERE service_business_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_sync_remarks_case
  ON public.reports_sync(remarks_case)
  WHERE remarks_case IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_sync_case_category
  ON public.reports_sync(case_category)
  WHERE case_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_sync_category_case_gse
  ON public.reports_sync(category_case_gse)
  WHERE category_case_gse IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_sync_category_case_cargo
  ON public.reports_sync(category_case_cargo)
  WHERE category_case_cargo IS NOT NULL;
