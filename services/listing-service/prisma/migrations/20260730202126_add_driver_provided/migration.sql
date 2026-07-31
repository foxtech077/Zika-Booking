-- Add driver_provided flag to listings
ALTER TABLE listing.listings ADD COLUMN IF NOT EXISTS driver_provided BOOLEAN NOT NULL DEFAULT false;
