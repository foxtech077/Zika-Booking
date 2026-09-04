-- The original payout migration created scheduledAt as NOT NULL, while the
-- application intentionally creates pending payouts without a schedule.
ALTER TABLE "payments"."Payout"
  ALTER COLUMN "scheduledAt" DROP NOT NULL;

ALTER TABLE "payments"."Payout"
  ALTER COLUMN "status" SET DEFAULT 'pending';
