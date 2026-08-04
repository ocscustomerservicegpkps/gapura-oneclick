-- Diversify division roles (OCS rename + OT/UQ/OS wiring) and add in-app
-- notifications for new report comments.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_division_check;

-- The current DIVISI_OS users are the customer-service team -> rename to OCS.
-- The new DIVISI_OS (a copy of OCS) starts empty.
UPDATE users
SET role = 'DIVISI_OCS', division = 'OCS'
WHERE role = 'DIVISI_OS';

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'SUPER_ADMIN',
    'DIVISI_ESKALASI',
    'DIVISI_OCS', 'DIVISI_OS', 'DIVISI_OT', 'DIVISI_OP', 'DIVISI_UQ', 'DIVISI_HC', 'DIVISI_HT',
    'ANALYST',
    'MANAGER_CABANG',
    'STAFF_CABANG'
  ));

ALTER TABLE users ADD CONSTRAINT users_division_check
  CHECK (division IS NULL OR division IN (
    'GENERAL', 'OCS', 'OS', 'OT', 'OP', 'UQ', 'HC', 'HT'
  ));

-- In-app notifications for new report comments (bell / unread).
CREATE TABLE IF NOT EXISTS report_comment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id text NOT NULL,
  comment_id uuid NOT NULL REFERENCES report_comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_notif_user_unread
  ON report_comment_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_comment_notif_comment
  ON report_comment_notifications(comment_id);

-- App reads/writes via the service role, so deny direct client access by default.
ALTER TABLE report_comment_notifications ENABLE ROW LEVEL SECURITY;
