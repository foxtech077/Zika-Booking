-- DropForeignKey
ALTER TABLE "Accreditation" DROP CONSTRAINT "Accreditation_providerId_fkey";

-- DropTable
DROP TABLE "Accreditation";

-- DropEnum
DROP TYPE "AccreditationStatus";
