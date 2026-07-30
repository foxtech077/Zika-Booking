-- Legal acceptance record (Todo#2 rows 7, 8, 9).
--
-- Stores *when* and *which version* of the Terms & Conditions and Privacy Policy
-- each user accepted, so acceptance can be evidenced rather than merely enforced
-- by a client-side checkbox.
--
-- Deliberately nullable with no backfill: existing rows are left NULL because we
-- have no record of what they actually accepted, and inventing one would defeat
-- the purpose of the audit trail. Users without a record are prompted by the
-- in-app consent screen on their next sign-in.

-- AlterTable
ALTER TABLE auth."User" ADD COLUMN     "termsAcceptedAt"   TIMESTAMP(3);
ALTER TABLE auth."User" ADD COLUMN     "termsVersion"      VARCHAR(20);
ALTER TABLE auth."User" ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE auth."User" ADD COLUMN     "privacyVersion"    VARCHAR(20);
