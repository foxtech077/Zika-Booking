-- Add loyalty points columns to platform_settings table
ALTER TABLE listing.platform_settings
  ADD COLUMN IF NOT EXISTS points_to_currency_ratio INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS min_points_redemption    INTEGER NOT NULL DEFAULT 500;

-- Add loyalty points columns to bookings table (if not already present)
ALTER TABLE listing.bookings
  ADD COLUMN IF NOT EXISTS redeem_points   INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_points   INTEGER     NOT NULL DEFAULT 0;
