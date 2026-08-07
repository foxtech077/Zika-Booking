-- Add immutable country-code snapshots for country-scoped admin authorization.

ALTER TABLE payments."Payment" ADD COLUMN "country_code" CHAR(2);
ALTER TABLE payments."Payout" ADD COLUMN "country_code" CHAR(2);

-- Backfill from the listing country via the booking's listing. Resolves via the
-- booking reference suffix (KAIN-XXXXXX-CC) as a fallback where the join fails.
UPDATE payments."Payment" p
SET "country_code" = b.country_code
FROM (
  SELECT b."id" AS booking_id, l."country" AS country_code
  FROM listing.bookings b
  JOIN listing.listings l ON l.id = b.listing_id
) b
WHERE p."bookingId" = b.booking_id
  AND p."country_code" IS NULL;

UPDATE payments."Payout" po
SET "country_code" = b.country_code
FROM (
  SELECT b."id" AS booking_id, l."country" AS country_code
  FROM listing.bookings b
  JOIN listing.listings l ON l.id = b.listing_id
) b
WHERE po."bookingId" = b.booking_id
  AND po."country_code" IS NULL;
