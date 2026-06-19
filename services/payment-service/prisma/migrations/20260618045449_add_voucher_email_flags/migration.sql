ALTER TABLE payments."Payment"
ADD COLUMN "voucherGenerated" BOOLEAN DEFAULT FALSE;

ALTER TABLE payments."Payment"
ADD COLUMN "confirmationEmailsSent" BOOLEAN DEFAULT FALSE;