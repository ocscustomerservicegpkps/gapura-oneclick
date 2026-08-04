-- Enforce the documented material_links shape (array of {title, url} objects)
-- at the database boundary, matching lib/division-documents-material-links.ts.
CREATE OR REPLACE FUNCTION public.is_valid_material_links(links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(links) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(links) elem
      WHERE jsonb_typeof(elem) <> 'object'
         OR jsonb_typeof(elem->'title') IS DISTINCT FROM 'string'
         OR jsonb_typeof(elem->'url') IS DISTINCT FROM 'string'
    );
$$;

ALTER TABLE public.division_documents
  ADD CONSTRAINT division_documents_material_links_shape
  CHECK (public.is_valid_material_links(material_links));
