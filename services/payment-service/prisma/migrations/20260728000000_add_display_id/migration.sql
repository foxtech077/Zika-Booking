-- Create sequence for payment display ID numbers
CREATE SEQUENCE IF NOT EXISTS payments.payment_seq START WITH 1 INCREMENT BY 1;

-- Add displayId column to Payment table (nullable for existing records)
ALTER TABLE payments."Payment" ADD COLUMN "display_id" TEXT;

-- Create unique index on display_id (only non-null values must be unique)
CREATE UNIQUE INDEX "Payment_display_id_key" ON payments."Payment"("display_id") WHERE "display_id" IS NOT NULL;
