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