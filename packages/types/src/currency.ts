/**
 * Shared currency / FX constants used by the booking and payment services.
 *
 * EUR is the platform money-of-record for Stripe charges. A small buffer is
 * added to the converted amount to absorb exchange-rate fluctuation between
 * the moment a price is quoted and the moment the card is charged (a
 * minutes-long window, so a modest buffer suffices).
 */

/** Percentage buffer applied on top of the raw EUR-converted charge amount. */
export const EUR_CHARGE_BUFFER = 0.005;

/** Multiplier derived from the buffer, i.e. rawAmount × (1 + buffer). */
export const EUR_CHARGE_BUFFER_MULTIPLIER = 1 + EUR_CHARGE_BUFFER;

/** Small buffer applied to Tara XAF conversions to absorb FX fluctuation. */
export const TARA_CHARGE_BUFFER = 0.005;
export const TARA_CHARGE_BUFFER_MULTIPLIER = 1 + TARA_CHARGE_BUFFER;

/**
 * XAF (Central African CFA franc) is pegged to the euro at a fixed rate.
 * Used for converting Tara charges/disbursements to EUR in dashboards.
 */
export const XAF_PER_EUR = 655.957;

/** Convert XAF to EUR using the fixed parity peg. */
export function xafToEur(amountXaf: number): number {
  return Number(amountXaf) / XAF_PER_EUR;
}

/**
 * Currencies with 0 decimal places (no cents/subunits).
 * Single source of truth — import from here instead of maintaining
 * per-service copies.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "KMF", "KRW", "KZT",
  "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
  "XAF", "XOF", "XPF", "JPY",
]);

/** True when the currency has 0 decimal places. */
export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}
