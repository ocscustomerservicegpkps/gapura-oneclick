insert into public.units (id, name, description)
values
  ('00000000-0000-0000-0000-000000000101', 'Ramp', 'Default branch work unit'),
  ('00000000-0000-0000-0000-000000000102', 'Passenger Service', 'Default branch work unit'),
  ('00000000-0000-0000-0000-000000000103', 'Cargo', 'Default branch work unit'),
  ('00000000-0000-0000-0000-000000000104', 'GSE', 'Default branch work unit'),
  ('00000000-0000-0000-0000-000000000105', 'Security', 'Default branch work unit'),
  ('00000000-0000-0000-0000-000000000106', 'Administrasi', 'Default branch work unit')
on conflict (id) do nothing;

insert into public.positions (id, name, level)
values
  ('00000000-0000-0000-0000-000000000201', 'Super Admin', 1),
  ('00000000-0000-0000-0000-000000000202', 'Analyst', 2),
  ('00000000-0000-0000-0000-000000000203', 'DIVISI OT', 3),
  ('00000000-0000-0000-0000-000000000204', 'DIVISI OP', 3),
  ('00000000-0000-0000-0000-000000000205', 'DIVISI UQ', 3),
  ('00000000-0000-0000-0000-000000000206', 'OS', 3),
  ('00000000-0000-0000-0000-000000000207', 'OSF', 3),
  ('00000000-0000-0000-0000-000000000208', 'OSL', 3),
  ('00000000-0000-0000-0000-000000000209', 'Staff', 10),
  ('00000000-0000-0000-0000-00000000020a', 'Officer', 9),
  ('00000000-0000-0000-0000-00000000020b', 'Supervisor', 8),
  ('00000000-0000-0000-0000-00000000020c', 'Manager', 7)
on conflict (id) do nothing;
