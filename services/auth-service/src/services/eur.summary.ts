import { prisma } from "../lib/prisma.js";
import { xafToEur } from "@zika/types";

/**
 * EUR aggregation helpers for dashboard summaries.
 *
 * Rule: financial aggregates are expressed in EUR (the money of record).
 *  - EUR → identity
 *  - XAF → fixed parity peg (1 EUR = 655.957 XAF)
 *  - everything else → current DB cross-rate from listing.exchange_rates
 *    (USD→EUR / USD→X). The auth-service's Prisma client only knows the auth
 *    schema, so the rate table is read via raw SQL like the existing dashboard
 *    queries that touch listing.* and payments.*.
 */

export async function getEurRatesMap(
  currencies: (string | null | undefined)[],
): Promise<Map<string, number>> {
  const unique = [...new Set(currencies.filter(Boolean).map((c) => c!.toUpperCase()))];
  const map = new Map<string, number>();
  const needed = unique.filter((c) => c !== "EUR" && c !== "XAF");
  if (needed.length === 0) return map;

  const rows = await prisma.$queryRaw<{ toCurrency: string; rate: string }[]>`
    SELECT "toCurrency", rate::text AS rate
    FROM listing.exchange_rates
    WHERE "fromCurrency" = 'USD' AND "toCurrency" = ANY(${[...needed, "EUR"]}::text[])
      AND "expiresAt" >= NOW()
  `;

  const usdRates = new Map<string, number>();
  for (const r of rows) usdRates.set(r.toCurrency, Number(r.rate));
  const eurUsd = usdRates.get("EUR");
  if (eurUsd == null || !Number.isFinite(eurUsd) || eurUsd <= 0) return map;

  for (const c of needed) {
    const xUsd = usdRates.get(c);
    if (xUsd != null && Number.isFinite(xUsd) && xUsd > 0) {
      map.set(c, eurUsd / xUsd);
    }
  }
  return map;
}

export function toEur(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  rates: Map<string, number>,
): number | null {
  if (amount == null || isNaN(Number(amount))) return null;
  const up = (currency ?? "").toUpperCase();
  if (!up) return null;
  if (up === "EUR") return Number(amount);
  if (up === "XAF") return xafToEur(Number(amount));
  const rate = rates.get(up);
  if (rate == null) return null;
  return Number(amount) * rate;
}

export interface PaymentRevenue {
  revenueEur: number;
  refundsEur: number;
  paymentsCount: number;
}

/**
 * Aggregate captured/partially-refunded payment revenue in EUR, with refunds
 * deducted. Uses the stored charge snapshot (chargedAmount/chargedCurrency) so
 * aggregates reflect what actually moved, converts XAF→EUR at the fixed peg and
 * every other currency via the current DB rate.
 */
export async function computePaymentRevenueEur(opts: {
  start?: Date;
  end?: Date;
  countryScope?: string[];
}): Promise<PaymentRevenue> {
  const params: (string | Date | string[])[] = [];
  const conditions: string[] = [`p.status IN ('captured','partially_refunded')`];

  if (opts.start) {
    params.push(opts.start);
    conditions.push(`p."createdAt" >= $${params.length}`);
  }
  if (opts.end) {
    params.push(opts.end);
    conditions.push(`p."createdAt" <= $${params.length}`);
  }

  let joinSql = "";
  if (opts.countryScope && opts.countryScope.length > 0) {
    params.push(opts.countryScope);
    const idx = params.length;
    joinSql = `JOIN listing.bookings b ON p."bookingId" = b.id
               JOIN listing.listings l ON b.listing_id = l.id
                 AND l.country = ANY($${idx}::text[])`;
  }

  const where = conditions.join(" AND ");

  const paymentRows = await prisma.$queryRawUnsafe<{ currency: string; total: string | null }[]>(`
    SELECT COALESCE(p."chargedCurrency", p.currency) AS currency,
           SUM(COALESCE(p."chargedAmount", p.amount))::text AS total
    FROM payments."Payment" p
    ${joinSql}
    WHERE ${where}
    GROUP BY COALESCE(p."chargedCurrency", p.currency)
  `, ...params);

  const refundRows = await prisma.$queryRawUnsafe<{ currency: string; total: string | null }[]>(`
    SELECT r.currency AS currency, SUM(r.amount)::text AS total
    FROM payments."Refund" r
    JOIN payments."Payment" p ON r."payment_id" = p.id
    ${joinSql}
    WHERE r.status <> 'failed' AND ${where}
    GROUP BY r.currency
  `, ...params);

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM payments."Payment" p
    ${joinSql}
    WHERE ${where}
  `, ...params);

  const rates = await getEurRatesMap([
    ...paymentRows.map((r) => r.currency),
    ...refundRows.map((r) => r.currency),
  ]);

  const sumEur = (rows: { currency: string; total: string | null }[]): number =>
    rows.reduce((sum, r) => sum + (toEur(r.total, r.currency, rates) ?? 0), 0);

  return {
    revenueEur: sumEur(paymentRows),
    refundsEur: sumEur(refundRows),
    paymentsCount: Number(countRows[0]?.count ?? 0),
  };
}

export interface BookingFinanceTotals {
  revenueEur: number;
  refundsEur: number;
  voucherDiscountsEur: number;
  commissionEur: number;
  payoutEur: number;
  bookingsCount: number;
}

/**
 * Aggregate a set of confirmed/completed booking rows into EUR. Each booking's
 * money fields are converted using its charge-time snapshot
 * (priceBreakdownJson.chargedCurrency/chargedRate) when present, else the
 * current DB rate; XAF uses the fixed peg. Refunds are deducted from revenue.
 */
export async function aggregateBookingFinance(
  rows: {
    currency: string;
    totalAmount: unknown;
    commissionAmount: unknown;
    providerPayout: unknown;
    voucherDiscount: unknown;
    refundAmount: unknown;
    priceBreakdownJson: unknown;
  }[],
): Promise<BookingFinanceTotals> {
  const eurRates = await getEurRatesMap(rows.map((r) => r.currency));

  const snapshotOf = (r: (typeof rows)[number]) => {
    const pb = (r.priceBreakdownJson ?? {}) as Record<string, unknown>;
    return {
      chargedAmount: pb.chargedAmount != null ? Number(pb.chargedAmount) : null,
      chargedCurrency: pb.chargedCurrency != null ? String(pb.chargedCurrency) : null,
      chargedRate: pb.chargedRate != null ? Number(pb.chargedRate) : null,
    };
  };
  const toEurBooking = (r: (typeof rows)[number], value: unknown): number => {
    const amt = Number(value ?? 0);
    const snap = snapshotOf(r);
    const chargeCur = snap.chargedCurrency?.toUpperCase() ?? null;
    const chargeRate = snap.chargedRate;
    if (chargeCur && chargeRate != null && chargeRate > 0) {
      return toEur(amt * chargeRate, chargeCur, eurRates) ?? 0;
    }
    return toEur(amt, r.currency, eurRates) ?? 0;
  };
  // Guest revenue prefers the stored buffered charged total (the actual amount
  // captured), which includes the FX buffer — this reconciles with the payments
  // summary. Commission/payout/refunds stay rate-based (providers settle at the
  // raw market rate, refunds are tracked in the charge currency).
  const chargedTotalEur = (r: (typeof rows)[number]): number | null => {
    const snap = snapshotOf(r);
    if (snap.chargedAmount != null && snap.chargedCurrency) {
      return toEur(snap.chargedAmount, snap.chargedCurrency, eurRates) ?? 0;
    }
    // Legacy rows without a snapshot fall back to the rate-based conversion.
    return toEurBooking(r, r.totalAmount);
  };

  return {
    revenueEur: rows.reduce((s, r) => s + (chargedTotalEur(r) ?? 0), 0),
    refundsEur: rows.reduce((s, r) => s + toEurBooking(r, r.refundAmount), 0),
    voucherDiscountsEur: rows.reduce((s, r) => s + toEurBooking(r, r.voucherDiscount), 0),
    commissionEur: rows.reduce((s, r) => s + toEurBooking(r, r.commissionAmount), 0),
    payoutEur: rows.reduce((s, r) => s + toEurBooking(r, r.providerPayout), 0),
    bookingsCount: rows.length,
  };
}