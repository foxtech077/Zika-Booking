-- Add charged amount/currency for Tara mobile-money payments.
-- Tara always charges in XAF (converted from the listing currency when needed),
-- so the effective charge may differ from the booking's original amount/currency.
ALTER TABLE payments."Payment" ADD COLUMN "chargedAmount" DECIMAL(12, 2);

ALTER TABLE payments."Payment" ADD COLUMN "chargedCurrency" CHAR(3);
