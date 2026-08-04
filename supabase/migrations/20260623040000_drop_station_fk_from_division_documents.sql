-- station_id is sourced from /api/master-data?type=stations, which merges the
-- stations table with a static airport list (codes not yet seeded in `stations`
-- get a synthetic id). A strict FK rejects those, so drop it; station_id stays
-- free text here, same as reports_sync.station_id elsewhere in the schema.
ALTER TABLE public.division_documents
    DROP CONSTRAINT IF EXISTS division_documents_station_id_fkey;
