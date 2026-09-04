-- Add content_hash to the reports sync table.
--
-- The full Google Sheets sync rewrote all rows on every run because it queued
-- an UPDATE for every row whose sheet_id already existed, with no content
-- comparison. source_fingerprint cannot fill that role: it hashes only the ~15
-- identity fields used to distinguish two incidents, so edits to status,
-- evidence, notes, etc. leave it unchanged. content_hash covers the whole
-- written payload (minus the volatile timestamp columns) so the sync can skip
-- rows that are already up to date.
--
-- NULL on existing rows is intentional: the first sync after deploy updates
-- every row once to populate it, then settles into near-zero writes.

ALTER TABLE public.ground_handling_irregularity_report
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
