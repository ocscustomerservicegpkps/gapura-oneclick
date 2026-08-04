-- Registration and admin user-creation both check-then-insert on `nik` with
-- no DB constraint backing it, so two concurrent requests for the same NIK
-- can both pass the pre-insert check and create duplicate rows. `nik` is
-- always normalized to uppercase by both call sites before insert, so a
-- plain unique constraint (no functional index) is sufficient.
ALTER TABLE public.users
  ADD CONSTRAINT users_nik_key UNIQUE (nik);
