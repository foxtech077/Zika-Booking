"use client";

import { getCountryForTimezone } from "countries-and-timezones";
import { getCurrencyForCountry } from "@/app/(provider)/dashboard/listings/[id]/edit/_forms/shared/countryCurrencyMap";
import { ALL_CURRENCIES } from "@/lib/currency";

/**
 * The default when the visitor's country cannot be determined or has no
 * currency we support.
 */
export const FALLBACK_CURRENCY = "EUR";

/**
 * Detects the visitor's local currency from the browser's IANA timezone
 * (e.g. "Asia/Kolkata" → IN → INR).
 *
 * Chosen over the geolocation API deliberately: the timezone is available
 * synchronously on first paint, needs no permission prompt the visitor can
 * dismiss or deny, and no reverse-geocoding service. Timezone country and
 * physical country diverge only for travellers whose device clock still
 * follows home — and "home currency" is arguably the better default for
 * exactly that group.
 */
export function detectLocalCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return FALLBACK_CURRENCY;

    const country = getCountryForTimezone(tz);
    if (!country?.id) return FALLBACK_CURRENCY;

    const code = getCurrencyForCountry(country.id);
    if (!code) return FALLBACK_CURRENCY;

    // Only offer a currency the dropdown itself lists — otherwise the header
    // would show a value the visitor cannot find or re-select.
    const supported = ALL_CURRENCIES.some((c) => c.code === code);
    return supported ? code : FALLBACK_CURRENCY;
  } catch {
    return FALLBACK_CURRENCY;
  }
}
