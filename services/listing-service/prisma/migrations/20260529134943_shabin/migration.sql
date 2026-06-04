/*
  Warnings:

  - You are about to drop the `listing_bed_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listing_blocked_dates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listing_house_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listing_nearby_landmarks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listing_seasonal_prices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "listing_bed_configs" DROP CONSTRAINT "listing_bed_configs_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_blocked_dates" DROP CONSTRAINT "listing_blocked_dates_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_house_rules" DROP CONSTRAINT "listing_house_rules_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_nearby_landmarks" DROP CONSTRAINT "listing_nearby_landmarks_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_seasonal_prices" DROP CONSTRAINT "listing_seasonal_prices_listing_id_fkey";

-- DropIndex
DROP INDEX "listing_moderation_log_listing_id_created_at_idx";

-- DropIndex
DROP INDEX "listing_review_tasks_listing_id_created_at_idx";

-- DropIndex
DROP INDEX "listings_provider_id_status_idx";

-- DropIndex
DROP INDEX "listings_status_category_idx";

-- AlterTable
ALTER TABLE "listing_moderation_log" ALTER COLUMN "actor_role" SET DATA TYPE VARCHAR(50);

-- DropTable
DROP TABLE "listing_bed_configs";

-- DropTable
DROP TABLE "listing_blocked_dates";

-- DropTable
DROP TABLE "listing_house_rules";

-- DropTable
DROP TABLE "listing_nearby_landmarks";

-- DropTable
DROP TABLE "listing_seasonal_prices";
