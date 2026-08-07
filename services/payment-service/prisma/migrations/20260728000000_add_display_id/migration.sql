-- Create sequence for payment display ID numbers
CREATE SEQUENCE IF NOT EXISTS payments.payment_seq START WITH 1 INCREMENT BY 1;

-- Add displayId column to Payment table (nullable for existing records)
ALTER TABLE payments."Payment" ADD COLUMN "displayId" TEXT;

-- Create unique index on displayId (only non-null values must be unique)
CREATE UNIQUE INDEX "Payment_displayId_key" ON payments."Payment"("displayId") WHERE "displayId" IS NOT NULL;
