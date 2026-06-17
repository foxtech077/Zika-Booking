-- CreateEnum
CREATE TYPE "AccreditationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "Accreditation" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "AccreditationStatus" NOT NULL DEFAULT 'pending',
    "businessName" VARCHAR(255),
    "registrationNo" VARCHAR(100),
    "taxId" VARCHAR(100),
    "documentsUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accreditation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Accreditation_providerId_key" ON "Accreditation"("providerId");

-- CreateIndex
CREATE INDEX "Accreditation_status_idx" ON "Accreditation"("status");

-- AddForeignKey
ALTER TABLE "Accreditation" ADD CONSTRAINT "Accreditation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
