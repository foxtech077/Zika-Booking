-- CreateEnum
CREATE TYPE "payments"."MerchantPayoutMethod" AS ENUM ('stripe_connect', 'mobile_money', 'bank_transfer', 'manual');

-- CreateEnum
CREATE TYPE "payments"."PayoutStatus" AS ENUM ('pending', 'scheduled', 'processing', 'paid', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "payments"."Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT,
    "country" TEXT,
    "payoutMethod" "payments"."MerchantPayoutMethod" NOT NULL DEFAULT 'manual',
    "stripeConnectAccountId" TEXT,
    "mobileMoneyNumber" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."Payout" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payments"."PayoutStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "providerPayoutId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_userId_key" ON "payments"."Merchant"("userId");
CREATE INDEX "Merchant_userId_idx" ON "payments"."Merchant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_bookingId_key" ON "payments"."Payout"("bookingId");
CREATE INDEX "Payout_status_scheduledAt_idx" ON "payments"."Payout"("status", "scheduledAt");
CREATE INDEX "Payout_merchantId_idx" ON "payments"."Payout"("merchantId");
CREATE INDEX "Payout_providerId_idx" ON "payments"."Payout"("providerId");

-- AddForeignKey
ALTER TABLE "payments"."Payout" ADD CONSTRAINT "Payout_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "payments"."Merchant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
