-- Migration: Add car-rental-specific fields to listings table
-- Run this once PostgreSQL is accessible (via Docker or native service)
-- After running: npx prisma migrate dev --name add_car_fields

DO $$ BEGIN CREATE TYPE "Transmission" AS ENUM ('manual', 'automatic'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "FuelType" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MileagePolicy" AS ENUM ('unlimited', 'limited'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS car_make        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS car_model       VARCHAR(80),
  ADD COLUMN IF NOT EXISTS car_year        INTEGER,
  ADD COLUMN IF NOT EXISTS transmission    "Transmission",
  ADD COLUMN IF NOT EXISTS fuel_type       "FuelType",
  ADD COLUMN IF NOT EXISTS seats           INTEGER,
  ADD COLUMN IF NOT EXISTS doors           INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS mileage_policy  "MileagePolicy",
  ADD COLUMN IF NOT EXISTS mileage_limit_km INTEGER;
