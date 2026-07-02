-- Remove the unique constraint on payment_id
ALTER TABLE payments."Refund"
DROP CONSTRAINT IF EXISTS "Refund_payment_id_key";

-- Add idempotency_key column
ALTER TABLE payments."Refund"
ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- Create unique index on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_idempotency_key_key"
ON payments."Refund"("idempotency_key");

-- Create RefundRetryStatus enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'RefundRetryStatus'
          AND n.nspname = 'payments'
    ) THEN
        CREATE TYPE payments."RefundRetryStatus" AS ENUM (
            'pending',
            'processing',
            'completed',
            'failed'
        );
    END IF;
END $$;

-- Create RefundNotificationRetry table
CREATE TABLE IF NOT EXISTS payments."RefundNotificationRetry" (
    id UUID NOT NULL,
    refund_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    provider TEXT NOT NULL,
    refunded_at TIMESTAMP(3) NOT NULL,
    status payments."RefundRetryStatus" NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt TIMESTAMP(3),
    next_attempt TIMESTAMP(3),
    failed_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundNotificationRetry_pkey" PRIMARY KEY (id)
);

-- Unique index on refund_id
CREATE UNIQUE INDEX IF NOT EXISTS "RefundNotificationRetry_refund_id_key"
ON payments."RefundNotificationRetry"(refund_id);