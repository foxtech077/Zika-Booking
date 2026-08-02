-- Add a money/currency snapshot (listing/base detail + EUR transferred) captured
-- at payout time for historical reference.
ALTER TABLE payments."Payout" ADD COLUMN IF NOT EXISTS "price_breakdown_json" JSONB;