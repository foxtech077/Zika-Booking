-- Update refund_amount to be non-null with a default value
UPDATE listing.bookings
SET refund_amount = 0
WHERE refund_amount IS NULL;

ALTER TABLE listing.bookings
ALTER COLUMN refund_amount SET DEFAULT 0;

ALTER TABLE listing.bookings
ALTER COLUMN refund_amount SET NOT NULL;

-- Create BookingRefundEvent table
CREATE TABLE listing.booking_refund_events (
    id UUID NOT NULL,
    booking_id UUID NOT NULL,
    refund_id TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT booking_refund_events_pkey PRIMARY KEY (id)
);

-- Unique constraint for webhook idempotency
CREATE UNIQUE INDEX booking_refund_events_refund_id_key
ON listing.booking_refund_events(refund_id);