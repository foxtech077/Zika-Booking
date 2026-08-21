CREATE TYPE "payments"."ManualRefundStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "payments"."ManualRefund" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payments"."ManualRefundStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "refund_reference" TEXT,
    "note" TEXT,
    "failure_reason" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualRefund_payment_id_key" ON "payments"."ManualRefund"("payment_id");
CREATE UNIQUE INDEX "ManualRefund_idempotency_key_key" ON "payments"."ManualRefund"("idempotency_key");
CREATE INDEX "ManualRefund_status_created_at_idx" ON "payments"."ManualRefund"("status", "created_at" DESC);
CREATE INDEX "ManualRefund_booking_id_idx" ON "payments"."ManualRefund"("booking_id");

ALTER TABLE "payments"."ManualRefund"
  ADD CONSTRAINT "ManualRefund_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"."Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
