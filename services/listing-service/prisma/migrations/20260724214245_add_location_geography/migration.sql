-- Add geography column (schema-qualified type to be safe)
ALTER TABLE listing.listings ADD COLUMN IF NOT EXISTS location public.geography(Point, 4326);

-- Backfill existing lat/lng data into the geography column
UPDATE listing.listings
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::public.geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Drop the old decimal lat/lng columns (no IF EXISTS — if they're missing something is wrong)
ALTER TABLE listing.listings DROP COLUMN lat;
ALTER TABLE listing.listings DROP COLUMN lng;
