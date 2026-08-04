-- The "Authenticated Upload" policy on storage.objects, left in place by
-- 20260711175009_harden_storage_view_and_functions.sql, gave any authenticated
-- browser session (anon-key + login) standing INSERT access to storage. All
-- application uploads go through Next.js API routes using the service-role
-- client, so this standing grant is unnecessary and widens the attack surface.
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
