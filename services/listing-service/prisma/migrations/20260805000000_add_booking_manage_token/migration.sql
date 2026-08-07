-- Add a secret magic-link token for anonymous bookings. Minted at booking
-- creation for anon_* guests only; used to view/cancel the booking without an
-- account. Never cleared — stays valid until checkout + 24h.
ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS "manage_token" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_manage_token_key" ON listing.bookings("manage_token");
