ALTER TABLE payments."Refund"
RENAME COLUMN "paymentId" TO payment_id;

ALTER TABLE payments."Refund"
RENAME COLUMN "bookingId" TO booking_id;

ALTER TABLE payments."Refund"
RENAME COLUMN "providerRefundId" TO provider_refund_id;

ALTER TABLE payments."Refund"
RENAME COLUMN "failureReason" TO failure_reason;

ALTER TABLE payments."Refund"
RENAME COLUMN "refundedAt" TO refunded_at;

ALTER TABLE payments."Refund"
RENAME COLUMN "createdAt" TO created_at;

ALTER TABLE payments."Refund"
RENAME COLUMN "updatedAt" TO updated_at;