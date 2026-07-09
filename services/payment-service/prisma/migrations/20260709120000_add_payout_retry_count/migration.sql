-- AlterTable
ALTER TABLE "payments"."Payout" ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
