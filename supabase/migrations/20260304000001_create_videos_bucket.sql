-- Migration: Create videos storage bucket
-- Run this migration to create a separate bucket for video uploads

-- Check if bucket exists first
DO $$
BEGIN
  -- Try to create bucket
  INSERT INTO storage.buckets (id, name, public)
  VALUES (
    'videos',
    'videos',
    true
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- Postgres has no CREATE POLICY ... IF NOT EXISTS, so each policy is dropped
-- first; otherwise re-running this migration aborts on the existing name.
DROP POLICY IF EXISTS "Public videos access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;

-- Create policy to allow public access to videos
CREATE POLICY "Public videos access"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- Create policy to allow authenticated uploads.
--
-- Previously written as `WITH (bucket_id = 'videos') USING (auth.role() = ...)`,
-- which is not valid policy syntax on two counts: the clause is WITH CHECK, and
-- USING does not apply to FOR INSERT (there is no existing row to test). That
-- made the whole migration fail to apply, so this bucket had no upload policy
-- at all. The role restriction belongs in TO, not in a USING expression.
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Create policy to allow users to delete their own uploads
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = owner_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_videos 
ON storage.objects (bucket_id, name) 
WHERE bucket_id = 'videos';

COMMENT ON TABLE storage.buckets IS 'Storage bucket for video uploads';
