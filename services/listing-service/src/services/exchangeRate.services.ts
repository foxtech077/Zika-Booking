import { prisma } from "../lib/prisma.js";

const STALENESS_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
const BASE_CURRENCY = "USD";

// Currencies with 0 decimal places (no cents/subunits)
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "KMF", "KRW", "KZT",
  "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
  "XAF", "XOF", "XPF", "JPY",
]);

/**
 * Round UP (ceiling) a converted price to the correct precision for the target currency.
 * 0-decimal currencies → round up to whole number
 * 2-decimal currencies → round up to 2 decimals
 */
export function ceilingForCurrency(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return Math.ceil(amount);
  }
  return Math.ceil(amount * 100) / 100;
}

interface ApiRateResponse {
  result: string;
  base_code: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

export async function refreshExchangeRates(): Promise<{ inserted: number; updated: number }> {
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

  const entries = Object.entries(rates);

  for (const [currency, rate] of entries) {
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

  console.log(
    `[ExchangeRate] Refreshed rates: ${inserted} inserted, ${updated} updated (${entries.length} total)`
  );

  return { inserted, updated };
}

export async function isRatesStale(): Promise<boolean> {
  const oldestRate = await prisma.exchangeRate.findFirst({
    orderBy: { expiresAt: "asc" },
    select: { expiresAt: true },
  });

  if (!oldestRate) return true;
  return oldestRate.expiresAt <= new Date();
}

/**
 * Returns ms until the oldest rate expires (+ 1 minute buffer).
 * Returns 0 if rates don't exist or are already stale.
 */
export async function getRefreshDelay(): Promise<number> {
  const oldestRate = await prisma.exchangeRate.findFirst({
    orderBy: { expiresAt: "asc" },
    select: { expiresAt: true },
  });

  if (!oldestRate) return 0;

  const delay = oldestRate.expiresAt.getTime() - Date.now() + 60_000; // +1 min buffer
  return Math.max(0, delay);
}

export async function getExchangeRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Try direct rate
  const direct = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: fromUpper,
        toCurrency: toUpper,
      },
    },
    select: { rate: true, expiresAt: true },
  });

  if (direct && direct.expiresAt >= new Date()) {
    return Number(direct.rate);
  }

  // Try cross-rate: FROM -> USD -> TO
  if (fromUpper !== BASE_CURRENCY) {
    const fromUsd = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: BASE_CURRENCY,
          toCurrency: fromUpper,
        },
      },
      select: { rate: true, expiresAt: true },
    });

    if (fromUsd && fromUsd.expiresAt >= new Date()) {
      const toUsd = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency: BASE_CURRENCY,
            toCurrency: toUpper,
          },
        },
        select: { rate: true, expiresAt: true },
      });

      if (toUsd && toUsd.expiresAt >= new Date()) {
        return Number(toUsd.rate) / Number(fromUsd.rate);
      }
    }
  }

  return null;
}

export async function convertFromDb(
  amount: number,
  from: string,
  to: string
): Promise<number | null> {
  const rate = await getExchangeRate(from, to);
  if (rate === null) return null;
  return amount * rate;
}

/**
 * Convert a set of amount fields from `baseCurrency` into `target`, producing
 * `localized` equivalents that never replace the originals.
 *
 * - If no target, target === baseCurrency, or the rate is missing/stale
 *   (`getExchangeRate` returns null), the values are returned unchanged.
 * - Otherwise each non-null value is ceiling-rounded to the target currency's
 *   precision via `ceilingForCurrency`.
 * - Only a single rate lookup is performed per call.
 */
export async function getConvertedAmounts(
  baseCurrency: string,
  target: string | null | undefined,
  amounts: Record<string, number | null | undefined>
): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const targetNorm = target?.toUpperCase() || null;
  const baseNorm = baseCurrency.toUpperCase();

  const convertAll = (rate: number) => {
    for (const key of Object.keys(amounts)) {
      const v = amounts[key];
      out[key] = v == null ? null : ceilingForCurrency(v * rate, targetNorm!);
    }
  };

  if (!targetNorm || targetNorm === baseNorm) {
    for (const key of Object.keys(amounts)) out[key] = amounts[key] ?? null;
    return out;
  }

  const rate = await getExchangeRate(baseNorm, targetNorm);
  if (rate === null) {
    for (const key of Object.keys(amounts)) out[key] = amounts[key] ?? null;
    return out;
  }

  convertAll(rate);
  return out;
}

/**
 * Strict DB-only rate for converting a currency into EUR for charging/payout.
 * Returns null when the rate is stale or missing so the caller can fail with
 * TEMPORARILY_UNAVAILABLE instead of using a fallback or a wrong amount.
 */
export async function getEurRateOrNull(from: string): Promise<number | null> {
  const fromNorm = from.toUpperCase();
  if (fromNorm === "EUR") return 1;
  return getExchangeRate(fromNorm, "EUR");
}

/**
 * Fetch rates for multiple source currencies → one target currency in a single query.
 * All rates are USD-based, so: rate(from→to) = rate(USD→to) / rate(USD→from)
 * Returns a map like { "KES": 155.28, "NGN": 1540.5, ... }
 */
export async function getRatesBatch(
  fromCurrencies: string[],
  toCurrency: string
): Promise<Map<string, number>> {
  const unique = [...new Set(fromCurrencies.map((c) => c.toUpperCase()))];
  const to = toCurrency.toUpperCase();
  const now = new Date();

  // Remove target currency from the list (rate is 1)
  const toIdx = unique.indexOf(to);
  if (toIdx !== -1) unique.splice(toIdx, 1);

  const rateMap = new Map<string, number>();
  rateMap.set(to, 1);

  if (unique.length === 0) return rateMap;

  // Single query: fetch all USD→X rates for needed currencies
  const rows = await prisma.exchangeRate.findMany({
    where: {
      fromCurrency: "USD",
      toCurrency: { in: [...unique, to] },
      expiresAt: { gte: now },
    },
    select: { toCurrency: true, rate: true },
  });

  const usdRates = new Map<string, number>();
  for (const row of rows) {
    usdRates.set(row.toCurrency, Number(row.rate));
  }

  const targetRate = usdRates.get(to);
  if (!targetRate) return rateMap;

  for (const from of unique) {
    const fromRate = usdRates.get(from);
    if (fromRate) {
      rateMap.set(from, targetRate / fromRate);
    }
  }

  return rateMap;
}
