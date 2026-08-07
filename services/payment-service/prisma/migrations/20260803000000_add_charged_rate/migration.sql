-- Add the exchange rate used at charge time (listingCurrency → chargedCurrency).
-- Stored alongside chargedAmount/chargedCurrency for future reference so the
-- EUR (Stripe) / XAF (Tara) charge can be reconciled back to the booking.
ALTER TABLE payments."Payment" ADD COLUMN "chargedRate" DECIMAL(16, 8);
