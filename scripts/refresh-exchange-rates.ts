/**
 * Manual script to refresh exchange rates in the database.
 *
 * Usage:
 *   pnpm tsx scripts/refresh-exchange-rates.ts          # only refresh if stale
 *   pnpm tsx scripts/refresh-exchange-rates.ts --force   # always refresh
 */

import { PrismaClient } from "../services/listing-service/src/generated/index.js";

const STALENESS_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
const BASE_CURRENCY = "USD";

interface ApiRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL?.replace("schema=auth", "schema=listing") },
  },
});

async function isRatesStale(): Promise<boolean> {
  const oldestRate = await prisma.exchangeRate.findFirst({
    orderBy: { expiresAt: "asc" },
    select: { expiresAt: true },
  });
  if (!oldestRate) return true;
  return oldestRate.expiresAt < new Date();
}

async function refresh(): Promise<void> {
  console.log("[ExchangeRate] Fetching rates from API...");

  const response = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rates: ${response.statusText}`);
  }

  const data = (await response.json()) as ApiRateResponse;
  const rates = data.rates;
  if (!rates) {
    throw new Error("No rates returned from API");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + STALENESS_THRESHOLD_MS);

  let inserted = 0;
  let updated = 0;

  for (const [currency, rate] of Object.entries(rates)) {
    if (currency === BASE_CURRENCY) continue;

    const existing = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
        },
      },
    });

    if (existing) {
      await prisma.exchangeRate.update({
        where: { id: existing.id },
        data: { rate, fetchedAt: now, expiresAt },
      });
      updated++;
    } else {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currency,
          rate,
          fetchedAt: now,
          expiresAt,
        },
      });
      inserted++;
    }
  }

  console.log(`[ExchangeRate] Done: ${inserted} inserted, ${updated} updated (${Object.keys(rates).length} total currencies)`);
}

async function main() {
  const force = process.argv.includes("--force");

  if (!force) {
    const stale = await isRatesStale();
    if (!stale) {
      console.log("[ExchangeRate] Rates are still fresh, skipping refresh. Use --force to override.");
      await prisma.$disconnect();
      return;
    }
    console.log("[ExchangeRate] Rates are stale, refreshing...");
  } else {
    console.log("[ExchangeRate] Force refresh requested.");
  }

  await refresh();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[ExchangeRate] Fatal error:", err);
  process.exit(1);
});
