import { prisma } from "../lib/prisma.js";
import { EUR_CHARGE_BUFFER_MULTIPLIER, isTaraCountry } from "@zika/types";

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
 * Resolve the conversion context for a target display currency.
 *
 * - No target, or target === base → `{ currency: base, rate: null }` (identity:
 *   localized values are the base values, labeled with the base currency).
 * - Rate available → `{ currency: target, rate }` (localized values convert).
 * - Rate missing/stale → `{ currency: null, rate: null }` (localized values are
 *   null — never show a base amount mislabeled as the target currency).
 */
export async function getLocalizedContext(
  baseCurrency: string,
  target: string | null | undefined
): Promise<{ currency: string | null; rate: number | null }> {
  const targetNorm = target?.toUpperCase() || null;
  const baseNorm = baseCurrency.toUpperCase();

  if (!targetNorm || targetNorm === baseNorm) {
    return { currency: baseNorm, rate: null };
  }

  const rate = await getExchangeRate(baseNorm, targetNorm);
  if (rate === null) {
    return { currency: null, rate: null };
  }

  return { currency: targetNorm, rate };
}

/**
 * Convert a set of amount fields from `baseCurrency` into `target`, producing
 * `localized` equivalents that never replace the originals.
 *
 * - Identity (no target / target === base): values are the base amounts and
 *   `currency` is the base currency.
 * - Conversion available: values are ceiling-rounded to the target currency's
 *   precision and `currency` is the target.
 * - Conversion unavailable (missing/stale rate): every value is `null` and
 *   `currency` is `null`, so callers never emit a mislabeled amount.
 * - Only a single rate lookup is performed per call.
 */
export async function getConvertedAmounts(
  baseCurrency: string,
  target: string | null | undefined,
  amounts: Record<string, number | null | undefined>
): Promise<{ currency: string | null; values: Record<string, number | null> }> {
  const ctx = await getLocalizedContext(baseCurrency, target);
  const values: Record<string, number | null> = {};

  for (const key of Object.keys(amounts)) {
    const v = amounts[key];
    if (v == null) {
      values[key] = null;
    } else if (ctx.currency === null) {
      // Conversion requested but unavailable — never emit a wrong amount.
      values[key] = null;
    } else if (ctx.rate !== null) {
      values[key] = ceilingForCurrency(v * ctx.rate, ctx.currency);
    } else {
      // Identity — same currency, no conversion applied.
      values[key] = v;
    }
  }

  return { currency: ctx.currency, values };
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

/**
 * The platform (charge) currency for a listing. Tara-supported countries are
 * charged in XAF (mobile money is always XAF); everywhere else the platform
 * money-of-record is EUR (Stripe). Guests are always charged directly from the
 * listing's base currency — never routed through a guest/home currency.
 */
export function resolvePlatformCurrency(country?: string | null): string {
  return isTaraCountry(country) ? "XAF" : "EUR";
}

export interface PlatformQuote {
  platformCurrency: string;
  /** Raw market rate: baseCurrency → platformCurrency (identity → 1). */
  rate: number | null;
  /** Unbuffered converted amount (for reference / display math). */
  rawAmount: number | null;
  /** Buffered converted amount: raw × bufferApplied, ceiling-rounded. */
  amount: number | null;
  /** Buffer multiplier applied (1.015 for EUR, 1 otherwise / identity). */
  bufferApplied: number;
}

/**
 * Compute a platform-currency quote for a base-currency amount, using only the
 * DB exchange-rate table. The +buffer is applied only when the platform
 * currency is EUR to absorb FX fluctuation between quote and charge time.
 *
 *   raw = baseAmount × rate
 *   buffered = raw × (1 + bufferPercentage)
 */
export async function getPlatformQuote(
  baseCurrency: string,
  platformCurrency: string,
  amount: number
): Promise<PlatformQuote> {
  const from = baseCurrency.toUpperCase();
  const to = platformCurrency.toUpperCase();

  if (from === to) {
    // Charging in the listing's own currency — no conversion, no buffer.
    return {
      platformCurrency: to,
      rate: 1,
      rawAmount: amount,
      amount,
      bufferApplied: 1,
    };
  }

  const bufferApplied = to === "EUR" ? EUR_CHARGE_BUFFER_MULTIPLIER : 1;
  const rate = await getExchangeRate(from, to);
  if (rate === null) {
    return { platformCurrency: to, rate: null, rawAmount: null, amount: null, bufferApplied };
  }

  const rawAmount = amount * rate;
  // Match the charge path exactly: the platform service ceilings the raw
  // conversion (via /internal/fx/eur-quote) and THEN applies the buffer, so
  // the displayed/booked amount always equals the amount actually charged.
  const buffered = ceilingForCurrency(ceilingForCurrency(rawAmount, to) * bufferApplied, to);
  return { platformCurrency: to, rate, rawAmount, amount: buffered, bufferApplied };
}

export interface PlatformSnapshot {
  platformCurrency: string;
  platformAmount: number | null;
  platformRate: number | null;
  bufferApplied: number;
  listingCurrencyAmount: number | null;
  localizedCurrency: string | null;
  localCurrencyAmount: number | null;
}

/**
 * Build the generic platform snapshot shared by the pricing previews and the
 * stored price breakdown. The platform amount is derived strictly from the
 * listing base currency — the guest's home currency is reference/display only
 * and never used for the charge.
 */
export async function buildPlatformSnapshot(opts: {
  baseCurrency: string;
  platformCurrency?: string;
  listingCountry?: string | null;
  guestCurrency?: string | null;
  amounts: Record<string, number | null | undefined>;
  totalKey?: string;
}): Promise<PlatformSnapshot> {
  const from = opts.baseCurrency.toUpperCase();
  const platform = opts.platformCurrency ?? resolvePlatformCurrency(opts.listingCountry);
  const totalKey = opts.totalKey ?? "totalAmount";
  const total = opts.amounts[totalKey] != null ? Number(opts.amounts[totalKey]) : null;

  const quote = total != null
    ? await getPlatformQuote(from, platform, total)
    : { platformCurrency: platform, rate: null, rawAmount: null, amount: null, bufferApplied: platform === "EUR" ? EUR_CHARGE_BUFFER_MULTIPLIER : 1 };

  const guestTarget = opts.guestCurrency?.toUpperCase() ?? null;
  const localized =
    guestTarget && guestTarget !== from
      ? await getConvertedAmounts(from, guestTarget, opts.amounts)
      : null;

  return {
    platformCurrency: quote.platformCurrency,
    platformAmount: quote.amount,
    platformRate: quote.rate,
    bufferApplied: quote.bufferApplied,
    listingCurrencyAmount: total,
    localizedCurrency: localized?.currency ?? null,
    localCurrencyAmount:
      localized && localized.values[totalKey] != null
        ? localized.values[totalKey]
        : null,
  };
}
