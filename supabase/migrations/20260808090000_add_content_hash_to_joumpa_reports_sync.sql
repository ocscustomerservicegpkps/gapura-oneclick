-- Add content_hash to the Joumpa sync table.
--
-- sync-joumpa-scheduler.mjs upserted every parsed row on every run with no
-- content comparison, so each run rewrote the whole table — clobbering any
-- app-side edit that landed between runs and burning writes for nothing.
-- source_fingerprint cannot gate that: it hashes only the identity fields used
-- to tell two reports apart, so edits to action_taken, final_remarks, severity,
-- evidence, etc. leave it unchanged. content_hash covers the whole written
-- payload (minus the volatile timestamp columns), matching the column of the
-- same name on ground_handling_irregularity_report.
--
-- NULL on existing rows is intentional: the first sync after deploy writes
-- every row once to populate it, then settles into near-zero writes.

ALTER TABLE public.joumpa_reports_sync
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
