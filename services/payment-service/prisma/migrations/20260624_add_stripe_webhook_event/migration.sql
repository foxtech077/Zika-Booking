-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS payments;

-- Create StripeWebhookEvent table
CREATE TABLE IF NOT EXISTS payments."StripeWebhookEvent" (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);