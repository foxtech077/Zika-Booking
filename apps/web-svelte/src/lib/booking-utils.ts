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
