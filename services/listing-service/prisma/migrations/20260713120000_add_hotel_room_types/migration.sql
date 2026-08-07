-- AlterTable: Add has_room_types column to listings
ALTER TABLE "listing"."listings" ADD COLUMN "has_room_types" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add room_type_id column to bookings
ALTER TABLE "listing"."bookings" ADD COLUMN "room_type_id" TEXT;

-- CreateTable: Create hotel_room_types table
CREATE TABLE "listing"."hotel_room_types" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "room_type" "listing"."RoomType" NOT NULL,
    "description" TEXT,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "unit_count" INTEGER NOT NULL DEFAULT 1,
    "max_guests" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_room_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Create index on listing_id for hotel_room_types
CREATE INDEX "hotel_room_types_listing_id_idx" ON "listing"."hotel_room_types"("listing_id");

-- AddForeignKey: Add foreign key from hotel_room_types to listings
ALTER TABLE "listing"."hotel_room_types" ADD CONSTRAINT "hotel_room_types_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "listing"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Add foreign key from bookings to hotel_room_types
ALTER TABLE "listing"."bookings" ADD CONSTRAINT "bookings_room_type_id_fkey"
    FOREIGN KEY ("room_type_id") REFERENCES "listing"."hotel_room_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: Create HotelRoomType records for existing hotel listings
-- Only for listings that have a roomType set (indicating they were configured as hotels)
INSERT INTO "listing"."hotel_room_types" (
    "id",
    "listing_id",
    "name",
    "room_type",
    "price_per_night",
    "unit_count",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    l."id",
    INITCAP(REPLACE(l."room_type"::TEXT, '_', ' ')) || ' Room',
    l."room_type",
    COALESCE(l."price_per_night", 0),
    COALESCE(l."unit_count", 1),
    0,
    true,
    NOW(),
    NOW()
FROM "listing"."listings" l
WHERE l."category" = 'hotel'
  AND l."room_type" IS NOT NULL
  AND l."deleted_at" IS NULL;

-- Update has_room_types flag for listings that now have room types
UPDATE "listing"."listings" l
SET "has_room_types" = true
WHERE l."category" = 'hotel'
  AND l."room_type" IS NOT NULL
  AND l."deleted_at" IS NULL
  AND EXISTS (
      SELECT 1 FROM "listing"."hotel_room_types" hrt
      WHERE hrt."listing_id" = l."id"
  );
