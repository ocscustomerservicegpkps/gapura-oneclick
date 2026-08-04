-- Branch roles are chosen from the registration form's Position dropdown
-- (Manager -> MANAGER_CABANG, Staff -> STAFF_CABANG), not derived from the
-- email domain, so the @gapura.id requirement on MANAGER_CABANG no longer
-- applies and would reject valid managers who sign up with another address.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_manager_email_check;
