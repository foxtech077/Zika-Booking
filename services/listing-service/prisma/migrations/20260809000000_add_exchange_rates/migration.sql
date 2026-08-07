-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS listing.exchange_rates (
    id TEXT NOT NULL,

    "fromCurrency" CHAR(3) NOT NULL,
    "toCurrency" CHAR(3) NOT NULL,

    rate DECIMAL(16,8) NOT NULL,

    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY (id)
);

-- Unique index from Prisma
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_fromCurrency_toCurrency_key"
ON listing.exchange_rates("fromCurrency", "toCurrency");
