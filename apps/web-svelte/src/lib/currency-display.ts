// Multi-currency display helpers.
//
// Pricing on the platform has three layers:
//   - listing (base) currency — what the host lists (e.g. AED)
//   - display (local) currency — the guest's country currency (e.g. INR)
//   - platform (charge) currency — EUR for Stripe, XAF for Tara mobile money
//
// Money is always rendered ISO-code-first ("INR 701,015", "AED 27,000",
// "EUR 22,580.50") — never a currency symbol — so Arabic/RTL symbol characters
// (e.g. AED's "د.إ") can never corrupt an LTR layout. Only the platform amount
// is ever shown with the euro symbol ("€22,580.50 EUR") because it is the
// authoritative charge figure.
//
// The display (local) amount is an ESTIMATE only when a conversion exists
// between what the user sees and what they are charged: estimate = display
// currency !== platform currency. The platform amount itself is never an
// estimate.

import { isTaraCountry } from '$lib/tara';

/** Mirrors packages/types/src/currency.ts (EUR_CHARGE_BUFFER_MULTIPLIER). */
const EUR_CHARGE_BUFFER_MULTIPLIER = 1.015;

/** Currencies with 0 decimal places (no cents/subunits) — mirrors the listing service. */
const ZERO_DECIMAL_CURRENCIES = new Set([
	'BIF',
	'CLP',
	'DJF',
	'GNF',
	'ISK',
	'KMF',
	'KRW',
	'KZT',
	'MGA',
	'PYG',
	'RWF',
	'UGX',
	'VND',
	'VUV',
	'XAF',
	'XOF',
	'XPF',
	'JPY'
]);

export interface MoneyFormatOptions {
	/** Prefix the value with "~" (estimate in the display currency). */
	approx?: boolean;
	/** Prefix the value with "≈" (roughly-equivalent reference amount). */
	equiv?: boolean;
	/** Render as "€22,580.50 EUR" (euro symbol + ISO). Only applies to EUR. */
	symbol?: boolean;
}

/** Fraction digits for a currency code (0 for zero-decimal currencies, else 2). */
function decimalsFor(code: string): number {
	return ZERO_DECIMAL_CURRENCIES.has(code.toUpperCase()) ? 0 : 2;
}

/**
 * Format an amount as ISO-code-first text with deterministic en-US grouping.
 * Trailing ".00" is dropped on whole values to reduce visual clutter; real
 * fractions (e.g. 2,103,045.27) are kept. Returns "—" for null/NaN amounts.
 */
export function formatMoney(
	amount: number | null | undefined,
	code: string | null | undefined,
	opts: MoneyFormatOptions = {}
): string {
	const value = Number(amount);
	if (amount == null || !Number.isFinite(value)) return '—';
	const cur = (code ?? 'KES').toUpperCase();
	const decimals = decimalsFor(cur);
	const hasFraction = Math.abs(value % 1) > 1e-9;
	const group = value.toLocaleString('en-US', {
		minimumFractionDigits: hasFraction ? decimals : 0,
		maximumFractionDigits: decimals
	});
	const prefix = opts.approx ? '~' : opts.equiv ? '≈' : '';
	if (opts.symbol && cur === 'EUR') return `${prefix}€${group} EUR`;
	return `${prefix}${cur} ${group}`;
}

/** The authoritative platform amount as "€22,580.50 EUR" (never an estimate). */
export function eurMoney(amount: number | null | undefined): string {
	return formatMoney(amount, 'EUR', { symbol: true });
}

/**
 * The platform (charge) currency for a listing — mirrors the listing service's
 * resolvePlatformCurrency: XAF for Tara mobile-money countries, EUR otherwise.
 */
export function resolvePlatformCurrency(country: string | null | undefined): 'EUR' | 'XAF' {
	return isTaraCountry(country) ? 'XAF' : 'EUR';
}

/**
 * Apply the EUR charge buffer to a raw converted amount (matching the booking
 * service's getPlatformQuote). EUR charges absorb FX fluctuation between quote
 * and charge time; XAF is not buffered.
 */
export function withChargeBuffer(amount: number, to: string): number {
	const cur = (to ?? '').toUpperCase();
	if (cur === 'EUR') return Math.ceil(amount * EUR_CHARGE_BUFFER_MULTIPLIER * 100) / 100;
	if (ZERO_DECIMAL_CURRENCIES.has(cur)) return Math.ceil(amount);
	return Math.ceil(amount * 100) / 100;
}

/** Format an FX rate for an audit note, e.g. 0.2518. */
export function formatRate(rate: number | null | undefined): string {
	if (rate == null || !Number.isFinite(Number(rate))) return '';
	return Number(rate)
		.toFixed(4)
		.replace(/\.?0+$/, '');
}
