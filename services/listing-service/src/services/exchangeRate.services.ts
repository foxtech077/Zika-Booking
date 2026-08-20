import { prisma } from "../lib/prisma.js";
import { isTaraCountry, ZERO_DECIMAL_CURRENCIES, xafToEur } from "@zika/types";

const STALENESS_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const BASE_CURRENCY = "USD";

const FETCH_TIMEOUT_MS = 10_000;
const FX_USER_AGENT = "Kainook-FX/1.0";

interface RateSource {
  name: string;
  url: string;
  kind: "fawazahmed" | "open";
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function rateSources(): RateSource[] {
  return [
    {
      name: "exchange-api-jsdelivr",
      // Pin to today's date instead of @latest so we don't depend on the
      // CDN's latest-tag cache lag. If today's package isn't published yet,
      // this 404s and we fall through to the next source.
      url: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${todayUtc()}/v1/currencies/usd.min.json`,
      kind: "fawazahmed",
    },
    {
      name: "exchange-api-pages",
      url: "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
      kind: "fawazahmed",
    },
    {
      name: "open-er-api",
      url: "https://open.er-api.com/v6/latest/USD",
      kind: "open",
    },
  ];
}

async function fetchSource(source: RateSource): Promise<{ date: string; rates: Record<string, number> } | null> {
  let data: any;
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": FX_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn(`[ExchangeRate] Source ${source.name} unreachable:`, err instanceof Error ? err.message : err);
    return null;
  }

  const rates = source.kind === "fawazahmed"
    ? data?.usd
    : data?.rates;

  if (!rates || typeof rates !== "object") {
    console.warn(`[ExchangeRate] Source ${source.name} returned no rates.`);
    return null;
  }

  if (source.kind === "fawazahmed") {
    if (typeof data.date !== "string" || data.date !== todayUtc()) {
      console.warn(`[ExchangeRate] Source ${source.name} date mismatch (got ${data.date}, expected ${todayUtc()}).`);
      return null;
    }
  } else if (typeof data.time_last_update_utc === "string") {
    const updateDate = data.time_last_update_utc.slice(0, 10);
    if (updateDate < todayUtc()) {
      console.warn(`[ExchangeRate] Source ${source.name} rates stale (last update ${updateDate}).`);
    }
  }

  const normalized: Record<string, number> = {};
  for (const [code, value] of Object.entries(rates) as [string, unknown][]) {
    const upper = code.toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) continue;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) continue;
    // Skip values that would overflow the numeric rate column (max < 1e10).
    if (Math.abs(n) >= 1e10) continue;
    normalized[upper] = n;
  }

  if (Object.keys(normalized).length === 0) {
    console.warn(`[ExchangeRate] Source ${source.name} returned no valid rates.`);
    return null;
  }

  return { date: data.date ?? todayUtc(), rates: normalized };
}

/**
 * Fetch the latest USD-based rates with a 3-tier fallback chain:
 * 1. fawazahmed0 exchange-api on jsdelivr (accepted only if the response date is today).
 * 2. fawazahmed0 exchange-api on Cloudflare pages (same validation).
 * 3. open.er-api — last resort, accepted regardless of how fresh its data is.
 */
export async function fetchRatesWithFallback(): Promise<{ source: string; date: string; rates: Record<string, number> }> {
  for (const source of rateSources()) {
    const result = await fetchSource(source);
    if (result) {
      console.log(`[ExchangeRate] Fetched rates from ${source.name} (${result.date})`);
      return { source: source.name, ...result };
    }
  }
  throw new Error("All exchange-rate sources failed.");
}

// Re-export from shared types for backward compatibility.
// Prefer importing from @zika/types directly in new code.
export { ZERO_DECIMAL_CURRENCIES } from "@zika/types";

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

let refreshInFlight: Promise<{ inserted: number; updated: number }> | null = null;

/**
 * Refresh the exchange-rate table from the fallback chain.
 * Serializes concurrent callers (repeatable job + on-demand refresh) into a
 * single run, and writes every rate atomically via a transaction.
 */
export function refreshExchangeRates(): Promise<{ inserted: number; updated: number }> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<{ inserted: number; updated: number }> {
  const { source, date, rates } = await fetchRatesWithFallback();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STALENESS_THRESHOLD_MS);

  const entries = Object.entries(rates)
    .map(([currency, rate]) => ({
      fromCurrency: BASE_CURRENCY,
      toCurrency: currency,
      rate,
      fetchedAt: now,
      expiresAt,
    }));

  const [, created] = await prisma.$transaction([
    prisma.exchangeRate.deleteMany({ where: { fromCurrency: BASE_CURRENCY } }),
    prisma.exchangeRate.createMany({ data: entries }),
  ]);

  console.log(
    `[ExchangeRate] Refreshed rates (source=${source}, date=${date}): ${created.count} inserted (drop-and-insert)`
  );

  return { inserted: created.count, updated: 0 };
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
    if (from === BASE_CURRENCY) {
      rateMap.set(from, targetRate);
      continue;
    }
    const fromRate = usdRates.get(from);
    if (fromRate) {
      rateMap.set(from, targetRate / fromRate);
    }
  }

  return rateMap;
}

/**
 * Convert an amount into EUR for dashboard aggregation.
 *
 * Rule: aggregates are expressed in EUR (the money of record).
 *  - EUR → identity
 *  - XAF → fixed parity peg (1 EUR = 655.957 XAF)
 *  - everything else → current DB cross-rate (USD→EUR / USD→X)
 * Returns null when the rate is unavailable — callers omit the record rather
 * than fabricate a number.
 */
export function convertToEur(
  amount: number | null | undefined,
  currency: string | null | undefined,
  eurRates: Map<string, number>,
): number | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const up = (currency ?? "").toUpperCase();
  if (!up) return null;
  if (up === "EUR") return Number(amount);
  if (up === "XAF") return xafToEur(Number(amount));
  const rate = eurRates.get(up);
  if (rate == null) return null;
  return Number(amount) * rate;
}

/**
 * Fetch the EUR-per-unit rate map for a set of currencies (one batched query,
 * XAF handled by the fixed peg so it never depends on API rounding).
 */
export async function getEurRatesMap(
  currencies: (string | null | undefined)[],
): Promise<Map<string, number>> {
  const unique = [...new Set((currencies ?? []).filter(Boolean).map((c) => c!.toUpperCase()))];
  const map = new Map<string, number>();
  const nonPegged = unique.filter((c) => c !== "EUR" && c !== "XAF");
  if (nonPegged.length > 0) {
    const batch = await getRatesBatch(nonPegged, "EUR");
    for (const c of nonPegged) {
      const r = batch.get(c);
      if (r != null) map.set(c, r);
    }
  }
  return map;
}

/**
 * Convert a booking money field (expressed in the listing/base currency) to
 * EUR. Prefers the charge-time snapshot (chargedCurrency + chargedRate recorded
 * at confirmation) because that reproduces what actually moved; falls back to
 * the current DB rate for legacy rows without a snapshot.
 */
export function bookingAmountToEur(
  amount: number | null | undefined,
  bookingCurrency: string | null | undefined,
  eurRates: Map<string, number>,
  snapshot?: { chargedCurrency?: string | null; chargedRate?: number | null } | null,
): number | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const chargeCur = snapshot?.chargedCurrency?.toUpperCase() ?? null;
  const chargeRate = snapshot?.chargedRate != null ? Number(snapshot.chargedRate) : null;
  if (chargeCur && chargeRate != null && chargeRate > 0) {
    return convertToEur(Number(amount) * chargeRate, chargeCur, eurRates);
  }
  return convertToEur(Number(amount), bookingCurrency, eurRates);
}

/**
 * Convert a refund/charge amount (already expressed in the charge currency —
 * EUR for Stripe, XAF for Tara) to EUR.
 */
export function chargeAmountToEur(
  amount: number | null | undefined,
  chargeCurrency: string | null | undefined,
  eurRates: Map<string, number>,
): number | null {
  return convertToEur(Number(amount ?? 0), chargeCurrency, eurRates);
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
  /** Converted amount: raw converted, ceiling-rounded for the target. */
  amount: number | null;
  /** Buffer multiplier applied (always 1 — no buffer). */
  bufferApplied: number;
}

/**
 * Compute a platform-currency quote for a base-currency amount, using only the
 * DB exchange-rate table. No buffer is applied to any conversion — the quote
 * is the exact converted amount, ceiling-rounded to the target's decimals.
 *
 *   raw = baseAmount × rate
 *   converted = ceil(raw)
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

  const bufferApplied = 1;
  const rate = await getExchangeRate(from, to);
  if (rate === null) {
    return { platformCurrency: to, rate: null, rawAmount: null, amount: null, bufferApplied };
  }

  const rawAmount = amount * rate;
  // Match the charge path exactly: the platform service ceilings the raw
  // conversion (via /internal/fx/eur-quote), so the displayed/booked amount
  // always equals the amount actually charged.
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
    : { platformCurrency: platform, rate: null, rawAmount: null, amount: null, bufferApplied: 1 };

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
