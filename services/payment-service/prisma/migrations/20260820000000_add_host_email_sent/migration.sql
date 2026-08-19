-- Add a dedicated flag tracking delivery of the provider (host) confirmation
-- email. Previously host-email delivery was gated by `confirmationEmailsSent`
-- (the guest flag), so any host-email failure was permanently masked once the
-- guest email flipped that flag. The payment service now tracks each email
-- independently and retries via a durable queue.

ALTER TABLE payments."Payment"
ADD COLUMN "hostEmailSent" BOOLEAN DEFAULT FALSE;

-- Backfill: under the old code, whenever the guest email was sent the host
-- email was attempted in the same run. Copy that signal so historical
-- successes are not re-sent on deploy (otherwise the reconciliation sweep
-- would blast every provider with "new booking" emails for past bookings).
-- Rows where the guest email was never sent (the genuinely broken subset
-- this change fixes) stay false and get retried.
UPDATE payments."Payment"
SET "hostEmailSent" = "confirmationEmailsSent"
WHERE status = 'captured';
