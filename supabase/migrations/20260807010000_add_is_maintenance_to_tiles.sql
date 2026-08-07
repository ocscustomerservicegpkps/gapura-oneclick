-- Add is_maintenance column to quick_access_tiles
-- When enabled, clicking the tile shows a "Sedang Dalam Maintenance" dialog

ALTER TABLE public.quick_access_tiles
    ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN NOT NULL DEFAULT false;
