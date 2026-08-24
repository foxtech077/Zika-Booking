ALTER TABLE payments."RefundNotificationRetry"
ADD COLUMN IF NOT EXISTS "processing_started_at" TIMESTAMP(3);

-- Initialize legacy in-flight rows so they can be recovered by the lease
-- sweeper after the normal 15-minute lease timeout.
UPDATE payments."RefundNotificationRetry"
SET "processing_started_at" = COALESCE("last_attempt", "created_at")
WHERE status = 'processing'
  AND "processing_started_at" IS NULL;

-- Ensure older application versions also acquire a lease while they are
-- still running during a rolling deployment. New code writes this field
-- explicitly, but the trigger prevents legacy workers from creating null
-- leases that the recovery sweep cannot identify.
CREATE OR REPLACE FUNCTION payments.set_refund_processing_lease()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.status = 'processing'::payments."RefundRetryStatus" THEN
    NEW."processing_started_at" = CURRENT_TIMESTAMP;
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'processing'::payments."RefundRetryStatus"
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW."processing_started_at" = CURRENT_TIMESTAMP;
  ELSIF NEW.status <> 'processing'::payments."RefundRetryStatus" THEN
    NEW."processing_started_at" = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_processing_lease_trigger
ON payments."RefundNotificationRetry";

CREATE TRIGGER refund_processing_lease_trigger
BEFORE INSERT OR UPDATE OF status
ON payments."RefundNotificationRetry"
FOR EACH ROW
EXECUTE FUNCTION payments.set_refund_processing_lease();
