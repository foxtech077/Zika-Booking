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
