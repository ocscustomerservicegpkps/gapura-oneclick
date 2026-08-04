-- Prevent deleting a user from silently cascading away performance links they
-- created; require the link to be reassigned or removed explicitly first.
ALTER TABLE public.performance_links
  DROP CONSTRAINT IF EXISTS performance_links_created_by_fkey;

ALTER TABLE public.performance_links
  ADD CONSTRAINT performance_links_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;
