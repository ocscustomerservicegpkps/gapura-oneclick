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

-- Create policy to allow public access to videos
CREATE POLICY "Public videos access"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- Create policy to allow authenticated uploads
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
WITH (bucket_id = 'videos')
USING (auth.role() = 'authenticated');

-- Create policy to allow users to delete their own uploads
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'videos' AND auth.uid()::text = owner_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_videos 
ON storage.objects (bucket_id, name) 
WHERE bucket_id = 'videos';

COMMENT ON TABLE storage.buckets IS 'Storage bucket for video uploads';
