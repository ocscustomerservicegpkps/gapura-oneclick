-- Add Weekly/Monthly/Survey report tabs to ocs_tab_records.
-- Also adds 'joumpa_uplifting', which the app already references
-- (OCSRecordsTabs.tsx, ocs-records API) but was missing from this constraint.
ALTER TABLE public.ocs_tab_records DROP CONSTRAINT ocs_tab_records_tab_check;
ALTER TABLE public.ocs_tab_records ADD CONSTRAINT ocs_tab_records_tab_check
  CHECK (tab IN ('reminder', 'joumpa', 'joumpa_uplifting', 'rca', 'weekly_report', 'monthly_report', 'survey_report'));
