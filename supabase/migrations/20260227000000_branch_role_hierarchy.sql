-- Update role constraint to include new branch roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'SUPER_ADMIN',
    'DIVISI_OS', 'DIVISI_OT', 'DIVISI_OP', 'DIVISI_UQ', 'DIVISI_HC', 'DIVISI_HT',
    'ANALYST',
    'MANAGER_CABANG',
    'STAFF_CABANG'
  ));

-- Normalize existing branch users based on email domain
UPDATE users
SET role = 'MANAGER_CABANG'
WHERE role IN ('CABANG','STAFF_CABANG','MANAGER_CABANG')
  AND email ILIKE '%@gapura.id';

UPDATE users
SET role = 'STAFF_CABANG'
WHERE role IN ('CABANG','MANAGER_CABANG','STAFF_CABANG')
  AND email NOT ILIKE '%@gapura.id';

-- Add performance index for station-based role queries
CREATE INDEX IF NOT EXISTS idx_users_station_role
  ON users(station_id, role)
  WHERE status = 'active';

-- Enforce manager email domain policy
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_manager_email_check;
ALTER TABLE users ADD CONSTRAINT users_manager_email_check
  CHECK (role <> 'MANAGER_CABANG' OR email ILIKE '%@gapura.id');
