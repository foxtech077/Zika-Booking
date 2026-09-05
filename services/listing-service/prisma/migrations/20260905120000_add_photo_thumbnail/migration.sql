-- Client-uploaded preview, stored under listings/:id/thumbnails/.
-- Nullable so existing rows stay valid and every read falls back to cdn_url.
ALTER TABLE listing.listing_photos ADD COLUMN IF NOT EXISTS thumb_url VARCHAR(500);
