import { ALL_COUNTRIES } from "../constants/countries";

// Derived from ALL_COUNTRIES — covers every supported country
export const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {};
for (const c of ALL_COUNTRIES) {
  if (!COUNTRY_CURRENCY_MAP[c.code]) {
    COUNTRY_CURRENCY_MAP[c.code] = { code: c.currency, symbol: c.symbol };
  }
}

// currency-code → symbol (used as Intl.NumberFormat fallback for exotic currencies)
const CURRENCY_SYMBOL_MAP: Record<string, string> = {};
for (const c of ALL_COUNTRIES) {
  if (!CURRENCY_SYMBOL_MAP[c.currency]) {
    CURRENCY_SYMBOL_MAP[c.currency] = c.symbol;
  }
}

export function getCurrencyForCountry(countryCode?: string | null): { code: string; symbol: string } {
  if (!countryCode) return { code: "USD", symbol: "$" };
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] ?? { code: "USD", symbol: "$" };
}

// Deduped list of every currency in ALL_COUNTRIES, for a currency-choice picker
// (as opposed to COUNTRY_CURRENCY_MAP, which is keyed by country). USD/EUR/GBP
// pinned first since they're the most commonly picked regardless of the
// guest's own country.
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

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    const symbol = CURRENCY_SYMBOL_MAP[currency.toUpperCase()] ?? currency;
    return `${symbol}${amount.toFixed(0)}`;
  }
}
