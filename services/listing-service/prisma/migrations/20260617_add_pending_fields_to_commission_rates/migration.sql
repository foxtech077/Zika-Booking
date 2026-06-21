ALTER TABLE listing.commission_rates
ADD COLUMN IF NOT EXISTS pending_rate DECIMAL(6,4);

ALTER TABLE listing.commission_rates
ADD COLUMN IF NOT EXISTS pending_effective_from TIMESTAMP;

ALTER TABLE listing.commission_rates
ADD COLUMN IF NOT EXISTS pending_reason VARCHAR(500);