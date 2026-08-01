import countries from 'world-countries';

export interface CountryInfo {
	code: string;
	name: string;
	flag: string;
	currency: string | null;
}

export const ALL_COUNTRIES: CountryInfo[] = countries
	.map((c) => ({
		code: c.cca2,
		name: c.name.common,
		flag: c.flag,
		currency: Object.keys(c.currencies ?? {})[0] ?? null
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

const byCode = new Map<string, CountryInfo>(ALL_COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryInfo | null {
	return byCode.get(code) ?? null;
}
