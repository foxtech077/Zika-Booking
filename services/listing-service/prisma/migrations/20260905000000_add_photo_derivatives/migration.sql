-- Resized renditions of each listing photo, generated asynchronously by the
-- "photo-derivatives" job. Nullable so existing rows stay valid and every
-- consumer can fall back to the original cdn_url until the backfill lands.
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS thumb_url VARCHAR(500);
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS card_url  VARCHAR(500);
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS full_url  VARCHAR(500);
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS width     INTEGER;
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS height    INTEGER;
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS derived_at TIMESTAMP(3);

-- Drives the backfill's "not yet processed" scan.
CREATE INDEX IF NOT EXISTS listing_photos_derived_at_idx
  ON listing.listing_photos (derived_at);
