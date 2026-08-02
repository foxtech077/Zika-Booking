-- Add a money/currency snapshot (display + localized + EUR charged) captured
-- at booking/payment time for historical reference and reconciliation.
ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS "price_breakdown_json" JSONB;