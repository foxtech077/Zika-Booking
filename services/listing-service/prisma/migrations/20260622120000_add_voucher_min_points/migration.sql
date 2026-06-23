-- Add min_points_redemption column to vouchers table
-- This field allows a voucher to require a minimum number of loyalty points before it can be applied.

ALTER TABLE listing.vouchers
  ADD COLUMN IF NOT EXISTS "min_points_redemption" INTEGER;
