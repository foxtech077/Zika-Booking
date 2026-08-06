import { formatMoney } from '$lib/currency-display';

/** Human-readable cancellation policies (mirrors apps/web's POLICY_LABEL). */
export const CANCELLATION_POLICY_LABEL: Record<string, string> = {
	flexible: 'Flexible — free cancellation until 48 hours before check-in',
	moderate: 'Moderate — full refund up to 7 days before, 50% from 48 hours before',
	strict: 'Strict — 50% refund up to 14 days before',
	non_refundable: 'Non-refundable'
};

/** Formats a YYYY-MM-DD pair as e.g. "12 Aug – 15 Aug 2026". */
export function fmtDates(start: string, end: string): string {
	const fmt = (s: string): string => {
		if (!s) return '';
		const [y, m, d] = s.split('-').map(Number);
		if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return s;
		return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	};
	const a = fmt(start);
	const b = fmt(end);
	if (a && b) return `${a} – ${b}`;
	return a || b || '—';
}

export interface PlatformInfo {
	platformCurrency: string;
	platformAmount: number;
	listingCurrency: string;
	listingTotal: number;
	platformRate: number | null;
}

/**
 * Derive the platform (charge) currency and amount from a pricing preview,
 * falling back to the listing currency/total for older previews that lack a
 * platform snapshot.
 */
export function derivePlatform(
	pp:
		| { platformCurrency?: string; platformAmount?: number; platformRate?: number }
		| null
		| undefined,
	listingCurrency: string,
	listingTotal: number
): PlatformInfo {
	return {
		platformCurrency: pp?.platformCurrency ?? listingCurrency,
		platformAmount: pp?.platformAmount != null ? pp.platformAmount : listingTotal,
		listingCurrency,
		listingTotal,
		platformRate: pp?.platformRate ?? null
	};
}

/** Format an amount in a platform currency ("EUR 22,580.50", "XAF 1"). */
export function fmtPlatform(amount: number, currency: string): string {
	return formatMoney(amount, currency);
}
