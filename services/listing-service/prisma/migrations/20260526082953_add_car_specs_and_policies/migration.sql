-- CreateEnum
CREATE TYPE "CarCategory" AS ENUM ('Economy', 'Compact', 'SUV', 'Minivan', 'Pickup', 'Luxury', 'Electric', 'Convertible');

-- CreateEnum
CREATE TYPE "DriveType" AS ENUM ('2WD', '4WD', 'AWD');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('basic', 'standard', 'premium', 'comprehensive');

-- CreateEnum
CREATE TYPE "FuelPolicy" AS ENUM ('full_to_full', 'same_to_same', 'free_tank');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'insurance_certificate';
ALTER TYPE "DocumentType" ADD VALUE 'roadworthiness_certificate';

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "air_conditioning" BOOLEAN,
ADD COLUMN     "airport_pickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "car_category" "CarCategory",
ADD COLUMN     "colour" VARCHAR(30),
ADD COLUMN     "cross_border_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivery_fee" DECIMAL(10,2),
ADD COLUMN     "delivery_radius_km" INTEGER,
ADD COLUMN     "drive_type" "DriveType",
ADD COLUMN     "engine_size" VARCHAR(20),
ADD COLUMN     "extra_km_rate" DECIMAL(10,2),
ADD COLUMN     "fuel_policy" "FuelPolicy",
ADD COLUMN     "insurance_type" "InsuranceType",
ADD COLUMN     "licence_plate" VARCHAR(20),
ADD COLUMN     "minimum_driver_age" INTEGER,
ADD COLUMN     "minimum_rental_days" INTEGER,
ADD COLUMN     "odometer_reading" INTEGER,
ADD COLUMN     "pickup_hours_from" VARCHAR(5),
ADD COLUMN     "pickup_hours_to" VARCHAR(5),
ADD COLUMN     "return_same_location" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "roadside_assistance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "security_deposit" DECIMAL(10,2);
