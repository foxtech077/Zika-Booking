-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'vehicle_registration';
ALTER TYPE "DocumentType" ADD VALUE 'hotel_operating_permit';
ALTER TYPE "DocumentType" ADD VALUE 'tourism_authority_certificate';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FuelPolicy" ADD VALUE 'full_to_empty';
ALTER TYPE "FuelPolicy" ADD VALUE 'pre_purchase';

-- AlterEnum
ALTER TYPE "FuelType" ADD VALUE 'lpg';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InsuranceType" ADD VALUE 'basic_third_party';
ALTER TYPE "InsuranceType" ADD VALUE 'premium_zero_excess';

-- AlterEnum
ALTER TYPE "Transmission" ADD VALUE 'semi_auto';

-- AlterTable
ALTER TABLE "ical_feeds" ADD COLUMN     "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_retry_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "price_per_day" DECIMAL(10,2);
