"use client";

import { useEffect, useRef, useState } from "react";
import { listingApi } from "@/lib/listing-api";
import { formatCurrency } from "@/lib/utils";

/**
 * Admin EUR conversion.
 *
 * Every transaction moves money as EUR (Stripe) or XAF (Tara mobile money, which
 * is pegged to EUR), so the admin portal shows amounts in EUR. These helpers
 * convert { currency → amount } batches to EUR server-side (POST /admin/fx/to-eur)
 * and cache the resulting rate map for the session.
 */

export type EurRates = Record<string, number>;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: { rates: EurRates; at: number } = { rates: {}, at: 0 };

/** Load EUR conversion rates for a set of currencies (cached, best-effort). */
export function useEurRates(currencies?: (string | null | undefined)[]): EurRates {
  const [rates, setRates] = useState<EurRates>(cache.rates);
  const keyRef = useRef<string | null>(null);

  const key = [...new Set((currencies ?? []).filter(Boolean).map((c) => c!.toUpperCase()))]
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) return;
    if (key === keyRef.current) return;
    keyRef.current = key;

    if (Object.keys(cache.rates).length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
      setRates(cache.rates);
      return;
    }

    let cancelled = false;
    const requested = key.split(",");
    listingApi
      .post("/admin/fx/to-eur", {
        amounts: Object.fromEntries(requested.map((c) => [c, 1])),
      })
      .then((res) => {
        const data = res.data?.data;
        const nextRates: EurRates = data?.rates ?? {};
        if (cancelled) return;
        cache = { rates: { ...cache.rates, ...nextRates }, at: Date.now() };
        setRates((prev) => ({ ...prev, ...nextRates }));
      })
      .catch(() => {
        /* rate unavailable — callers fall back to native currency */
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return rates;
}

/** Convert an amount to EUR using the rate map. Returns null when unavailable. */
export function toEur(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  rates: EurRates,
): number | null {
  if (amount == null || isNaN(Number(amount))) return null;
  if (!currency) return null;
  const up = currency.toUpperCase();
  if (up === "EUR") return Number(amount);
  const rate = rates[up];
  if (rate == null) return null;
  return Number((Number(amount) * rate).toFixed(2));
}

/** XAF (Central African CFA franc) is pegged to the euro at a fixed rate. */
const XAF_PER_EUR = 655.957;

/**
 * Convert an actual charge amount (already expressed in the charge currency —
 * EUR for Stripe, XAF for Tara) to the money-of-record EUR, reproducing what
 * actually moved at charge time rather than a current-rate approximation.
 */
export function chargedToEur(
  chargedAmount: number | string | null | undefined,
  chargedCurrency: string | null | undefined,
  rates: EurRates,
): number | null {
  const num = Number(chargedAmount);
  if (chargedAmount == null || isNaN(num)) return null;
  const c = (chargedCurrency ?? "").toUpperCase();
  if (c === "EUR") return Number(num.toFixed(2));
  if (c === "XAF") return Number((num / XAF_PER_EUR).toFixed(2));
  const r = rates?.[c];
  if (r != null) return Number((num * r).toFixed(2));
  return null;
}

/**
 * Convert a per-component amount (expressed in the booking's listing/base
 * currency) to EUR using the charge-time snapshot rate (chargedCurrency +
 * chargedRate captured at confirmation). This reproduces the actual money moved
 * at charge time for components like payouts / commission, which are only
 * stored in the listing currency. Falls back to the current-rate conversion
 * when no snapshot is available.
 */
export function toEurAtCharge(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  chargedCurrency: string | null | undefined,
  chargedRate: number | string | null | undefined,
  rates: EurRates,
): number | null {
  const num = Number(amount);
  if (amount == null || isNaN(num)) return null;
  const c = (chargedCurrency ?? "").toUpperCase();
  const rate = chargedRate != null ? Number(chargedRate) : null;
  if (c && rate != null && rate > 0) {
    const inChargeCurrency = num * rate;
    if (c === "EUR") return Number(inChargeCurrency.toFixed(2));
    if (c === "XAF") return Number((inChargeCurrency / XAF_PER_EUR).toFixed(2));
    const r = rates?.[c];
    if (r != null) return Number((inChargeCurrency * r).toFixed(2));
  }
  return toEur(num, currency, rates);
}

/**
 * Format an amount as EUR. Returns null when the conversion is unavailable so
 * callers can fall back to the native currency instead of mislabeling.
 */
export function formatEur(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  rates: EurRates,
  opts: Intl.NumberFormatOptions = {},
): string | null {
  const eur = toEur(amount, currency, rates);
  if (eur == null) return null;
  return formatCurrency(eur, "EUR", opts);
}

/**
 * Renders the EUR equivalent with the native amount muted beside it, e.g.
 * "€94.50 (KES 13,000)". Falls back to native formatting when the FX rate is
 * unavailable.
 */
export function EurValue({
  amount,
  currency,
  rates,
  className,
  nativeClassName = "text-slate-400",
  opts,
}: {
  amount: number | string | null | undefined;
  currency: string | null | undefined;
  rates: EurRates;
  className?: string;
  nativeClassName?: string;
  opts?: Intl.NumberFormatOptions;
}) {
  if (amount == null || isNaN(Number(amount))) return <span className={className}>—</span>;
  const eur = toEur(amount, currency, rates);
  if (eur == null) {
    return <span className={className}>{formatCurrency(Number(amount), currency ?? "USD")}</span>;
  }
  return (
    <span className={className}>
      {formatCurrency(eur, "EUR", opts)}
      {currency && currency.toUpperCase() !== "EUR" && (
        <span className={`ml-1 ${nativeClassName}`}>({formatCurrency(Number(amount), currency)})</span>
      )}
    </span>
  );
}