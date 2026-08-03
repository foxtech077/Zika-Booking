-- AlterEnum: UserType becomes a single value 'user'. Existing guest/provider
-- rows are normalized to 'user' — hosting capability now lives on
-- Accreditation (host profile), not on the role enum.
BEGIN;

CREATE TYPE "UserType_new" AS ENUM ('user');

ALTER TABLE "User" ALTER COLUMN "userType" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "userType" TYPE "UserType_new" USING ('user'::"UserType_new");

ALTER TABLE "User" ALTER COLUMN "userType" SET DEFAULT 'user';

DROP TYPE "UserType";

ALTER TYPE "UserType_new" RENAME TO "UserType";

COMMIT;
