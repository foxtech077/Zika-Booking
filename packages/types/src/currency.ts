/**
 * Shared currency / FX constants used by the booking and payment services.
 *
 * EUR is the platform money-of-record for Stripe charges. A small buffer is
 * added to the converted amount to absorb exchange-rate fluctuation between
 * the moment a price is shown/quoted and the moment the card is charged.
 */

/** Percentage buffer applied on top of the raw EUR-converted charge amount. */
export const EUR_CHARGE_BUFFER = 0.015;

/** Multiplier derived from the buffer, i.e. rawAmount × (1 + buffer). */
export const EUR_CHARGE_BUFFER_MULTIPLIER = 1 + EUR_CHARGE_BUFFER;
