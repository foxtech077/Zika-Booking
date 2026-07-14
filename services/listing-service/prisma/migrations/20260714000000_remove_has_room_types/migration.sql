-- AlterTable: Drop has_room_types column from listings (all hotels now always have room types)
ALTER TABLE "listing"."listings" DROP COLUMN "has_room_types";
