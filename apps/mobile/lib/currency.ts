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
