-- Add charge-time snapshot columns to listing.bookings so the ACTUAL money
-- moved at charge time (amount, currency, rate, timestamp) is stored as
-- first-class columns for historical auditing, not only inside
-- price_breakdown_json. These mirror payments.charged*.

ALTER TABLE listing.bookings
ADD COLUMN IF NOT EXISTS charged_amount DECIMAL(12,2);

ALTER TABLE listing.bookings
ADD COLUMN IF NOT EXISTS charged_currency CHAR(3);

ALTER TABLE listing.bookings
ADD COLUMN IF NOT EXISTS charged_rate DECIMAL(16,8);

ALTER TABLE listing.bookings
ADD COLUMN IF NOT EXISTS charged_at TIMESTAMPTZ;

-- Backfill the new columns for existing confirmed/completed bookings from the
-- jsonb price snapshot. Prefer the dedicated charged* keys, then the generic
-- platform snapshot, and fall back to the booking's own currency when neither
-- is present. COALESCE keeps any value already written to the column.
UPDATE listing.bookings
SET charged_amount   = COALESCE(
                          (price_breakdown_json->>'chargedAmount')::numeric,
                          (price_breakdown_json->'platform'->>'amount')::numeric,
                          charged_amount),
    charged_currency = COALESCE(
                          price_breakdown_json->>'chargedCurrency',
                          price_breakdown_json->'platform'->>'currency',
                          charged_currency),
    charged_rate     = COALESCE(
                          (price_breakdown_json->>'chargedRate')::numeric,
                          (price_breakdown_json->'platform'->>'rate')::numeric,
                          charged_rate),
    charged_at       = COALESCE(
                          (price_breakdown_json->>'chargedAt')::timestamptz,
                          charged_at)
WHERE status IN ('confirmed','checked_in','completed')
  AND price_breakdown_json IS NOT NULL;
