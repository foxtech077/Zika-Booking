export function cn(...classes: Array<string | false | null | undefined>): string {
	return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string): string {
	if (!name) return '';
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]!.toUpperCase())
		.join('');
}

export function formatPrice(value: number, currency = 'KES'): string {
	return `${currency} ${Number(value || 0).toLocaleString()}`;
}

import countries from 'world-countries';

/** Symbols collected from the world-countries package (e.g. AFN → ؋, NGN → ₦). */
const CURRENCY_SYMBOLS: Record<string, string> = (() => {
	const map: Record<string, string> = {};
	for (const c of countries) {
		for (const [code, cur] of Object.entries(c.currencies ?? {})) {
			const symbol = (cur as { symbol?: string } | undefined)?.symbol;
			if (symbol) map[code] = symbol;
		}
	}
	return map;
})();

/** Returns the localized currency symbol (e.g. "₹ ", "Sh ") for an ISO code. */
export function currencySymbol(currency: string): string {
	const mapped = CURRENCY_SYMBOLS[currency];
	if (mapped) return `${mapped} `;
	try {
		const parts = new Intl.NumberFormat('en', {
			style: 'currency',
			currency,
			maximumFractionDigits: 0
		}).formatToParts(0);
		const sym = parts.find((p) => p.type === 'currency')?.value;
		if (sym) return `${sym} `;
	} catch {
		// unknown currency code — fall back to the ISO code
	}
	return `${currency} `;
}

export function todayString(): string {
	const d = new Date();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDate(
	iso: string | null | undefined,
	opts: Intl.DateTimeFormatOptions = {}
): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '—';
	return d.toLocaleDateString('en', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		...opts
	});
}

/** Compact relative time, e.g. "2h ago", "3d ago", "just now". */
export function formatRelativeTime(iso: string | null | undefined): string {
	if (!iso) return '';
	const then = new Date(iso).getTime();
	if (isNaN(then)) return '';
	const diff = Date.now() - then;
	if (diff < 60_000) return 'just now';
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w ago`;
	return formatDate(iso);
}
