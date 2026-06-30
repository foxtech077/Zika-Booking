ALTER TABLE "payments"."Payout"
ALTER COLUMN "scheduledAt" DROP NOT NULL;

ALTER TABLE "payments"."Payout"
ALTER COLUMN "status" SET DEFAULT 'pending';