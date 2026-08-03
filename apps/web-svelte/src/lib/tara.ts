/**
 * Tara Mobile Money — supported countries and eligibility rules.
 *
 * Mirrors `@zika/types` (packages/types/src/tara.ts) so the web-svelte app can
 * stay ESM-friendly without depending on that package's CommonJS build.
 */

const TARA_COUNTRIES = new Set([
	'BJ',
	'BF',
	'CM',
	'CG',
	'CD',
	'CI',
	'GA',
	'KE',
	'RW',
	'SN',
	'SL',
	'UG',
	'TZ',
	'GH',
	'ZM'
]);

/** True when the ISO-3166-1 alpha-2 country code is a Tara-supported country. */
export function isTaraCountry(countryCode: string | null | undefined): boolean {
	return typeof countryCode === 'string' && TARA_COUNTRIES.has(countryCode.toUpperCase().trim());
}
