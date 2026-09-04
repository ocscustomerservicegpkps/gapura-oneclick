-- report_comments.report_id had no index.
--
-- lib/server/report-comments.ts looks comments up by report_id on every report
-- list page, the Joumpa list and the admin stats view, so each of those did a
-- sequential scan of the whole table plus a users join.

CREATE INDEX IF NOT EXISTS idx_report_comments_report_id
    ON public.report_comments (report_id);
