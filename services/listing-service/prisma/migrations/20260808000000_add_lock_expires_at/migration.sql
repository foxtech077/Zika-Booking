-- Add server-authoritative reservation lock expiry to bookings.
-- Used to enforce the confirmation grace window: webhooks arriving beyond
-- lock expiry + grace are auto-refunded instead of confirming the booking.

ALTER TABLE listing.bookings ADD COLUMN "lock_expires_at" TIMESTAMP(3);

-- Backfill legacy rows from created_at + 5-minute lock TTL so existing
-- pending_payment/confirmed bookings behave consistently with the grace rule.
UPDATE listing.bookings
SET "lock_expires_at" = "created_at" + INTERVAL '5 minutes'
WHERE "lock_expires_at" IS NULL;

-- Speed up the every-60s stale pending_payment sweep.
CREATE INDEX "bookings_status_created_at_idx" ON listing.bookings("status", "created_at");
