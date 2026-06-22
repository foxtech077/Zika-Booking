/*
  Warnings:

  - Made the column `voucherGenerated` on table `Payment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `confirmationEmailsSent` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "voucherGenerated" SET NOT NULL,
ALTER COLUMN "confirmationEmailsSent" SET NOT NULL;
