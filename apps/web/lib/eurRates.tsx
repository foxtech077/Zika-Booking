"use client";

import { useEffect, useRef, useState } from "react";
import { listingApi } from "@/lib/listing-api";

/**
 * Provider-scoped EUR conversion.
 *
 * The money of record is EUR (Stripe) or XAF (Tara — pegged to EUR at a fixed
 * ratio), so provider dashboards show financial aggregates in EUR. Each booking
 * or payout remains in its original currency and is converted individually via
 * this batch rate map before summing — never summed raw across currencies.
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

    const needed = key.split(",");
    const cacheIsFresh = Object.keys(cache.rates).length > 0 && Date.now() - cache.at < CACHE_TTL_MS;
    const cacheHasAll = needed.every((c) => cache.rates[c] != null);
    if (cacheIsFresh && cacheHasAll) {
      setRates(cache.rates);
      return;
    }

    let cancelled = false;
    listingApi
      .get("/provider/fx/to-eur", { params: { currencies: key } })
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
 * Sum an array of {amount, currency} entries into EUR. Entries whose currency
 * has no rate are excluded (never mixed as native amounts).
 */
export function sumToEur(
  entries: { amount?: number | string | null; currency?: string | null }[],
  rates: EurRates,
): number {
  return entries.reduce((sum, entry) => {
    const eur = toEur(entry.amount, entry.currency, rates);
    return sum + (eur ?? 0);
  }, 0);
}