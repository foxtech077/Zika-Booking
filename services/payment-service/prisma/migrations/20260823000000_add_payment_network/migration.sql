-- Add network column to Payment. Records which mobile money network was used
-- for a Tara charge (e.g. "wave"). NULL (empty) for Stripe payments and for
-- existing Tara rows where no network was selected at checkout.
ALTER TABLE "payments"."Payment" ADD COLUMN "network" TEXT;
