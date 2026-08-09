import { ALL_COUNTRIES } from "@/lib/countries";

// Deduped list of every currency in ALL_COUNTRIES, for a currency-choice
// dropdown. USD/EUR/GBP pinned first since they're the most commonly picked
// regardless of the visitor's own country. Mirrors apps/mobile/lib/currency.ts.
const PINNED_CODES = ["USD", "EUR", "GBP"];

export const ALL_CURRENCIES: { code: string; symbol: string }[] = (() => {
  const seen = new Set<string>();
  const rest: { code: string; symbol: string }[] = [];
  for (const c of ALL_COUNTRIES) {
    if (seen.has(c.currency)) continue;
    seen.add(c.currency);
    rest.push({ code: c.currency, symbol: c.symbol });
  }
  const pinned = PINNED_CODES
    .map((code) => rest.find((c) => c.code === code))
    .filter((c): c is { code: string; symbol: string } => !!c);
  const remaining = rest
    .filter((c) => !PINNED_CODES.includes(c.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return [...pinned, ...remaining];
})();

/**
 * "~" prefix for a converted/localized amount, per the BE-agreed convention:
 * a price shown in the listing's own currency is exact; a price converted
 * into the guest's chosen display currency is always an approximation.
 * Pass the `localizedCurrency` field the backend returns alongside a
 * conversion (null/undefined when no conversion was requested or available).
 */
export function approxPrefix(localizedCurrency: string | null | undefined): string {
  return localizedCurrency ? "~" : "";
}
