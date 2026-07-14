-- AlterTable: Add temporary_activation and geo_verification_due_at columns for apartment geo-location verification flow
ALTER TABLE "listing"."listings" 
  ADD COLUMN "temporary_activation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "geo_verification_due_at" TIMESTAMPTZ;
