import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';
import { getCountry, type CountryInfo } from '$lib/countries';

export interface GeoCoords {
	lat: number;
	lng: number;
}

export type LocationSource = 'gps' | 'ip';

const COORDS_KEY = 'kainook:coords';
const COUNTRY_KEY = 'kainook:country';
const COUNTRY_SOURCE_KEY = 'kainook:country_source';
const COOKIE_NAME = 'kainook_coords';
const CURRENCY_COOKIE_NAME = 'kainook_currency';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** How the current country was chosen. A manual pick always outranks the
 *  logged-in profile country (which outranks IP detection). */
type CountrySource = 'manual' | 'profile' | 'ip';

export const location = $state<{
	coords: GeoCoords | null;
	source: LocationSource | null;
	country: CountryInfo | null;
	resolved: boolean;
}>({
	coords: readStoredCoords(),
	source: null,
	country: readStoredCountry(),
	resolved: false
});

let initStarted = false;

function readStoredCoords(): GeoCoords | null {
	if (!browser) return null;
	try {
		const raw = window.localStorage.getItem(COORDS_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as GeoCoords;
		if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed;
	} catch {
		// ignore malformed storage
	}
	return null;
}

function readStoredCountry(): CountryInfo | null {
	if (!browser) return null;
	try {
		const code = window.localStorage.getItem(COUNTRY_KEY);
		if (!code) return null;
		return getCountry(code);
	} catch {
		// ignore malformed storage
	}
	return null;
}

function readCountrySource(): CountrySource | null {
	if (!browser) return null;
	try {
		const v = window.localStorage.getItem(COUNTRY_SOURCE_KEY);
		if (v === 'manual' || v === 'profile' || v === 'ip') return v;
	} catch {
		// ignore malformed storage
	}
	return null;
}

function persistCountrySource(source: CountrySource): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(COUNTRY_SOURCE_KEY, source);
	} catch {
		// ignore
	}
}

function setCookie(c: GeoCoords): void {
	if (!browser) return;
	try {
		const value = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
		document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
	} catch {
		// ignore
	}
}

function persistCoords(c: GeoCoords): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(COORDS_KEY, JSON.stringify({ lat: c.lat, lng: c.lng }));
	} catch {
		// ignore
	}
	setCookie(c);
}

function persistCountry(code: string): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(COUNTRY_KEY, code);
	} catch {
		// ignore
	}
}

function persistCurrency(currency: string | null): void {
	if (!browser || !currency) return;
	try {
		document.cookie = `${CURRENCY_COOKIE_NAME}=${encodeURIComponent(currency)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
	} catch {
		// ignore
	}
}

function getCurrentPosition(): Promise<GeoCoords> {
	return new Promise((resolve, reject) => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			reject(new Error('Geolocation not supported'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				resolve({
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				}),
			(err) => reject(err),
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
		);
	});
}

interface IpLookupResult {
	coords: GeoCoords | null;
	countryCode: string | null;
}

const IP_PROVIDERS = [
	'https://ipapi.co/json/',
	'https://freeipapi.com/api/json',
	'https://ipwho.is/'
];

async function fetchByIp(): Promise<IpLookupResult | null> {
	for (const url of IP_PROVIDERS) {
		try {
			const res = await fetch(url, { headers: { Accept: 'application/json' } });
			if (!res.ok) continue;
			const data = (await res.json()) as Record<string, unknown>;

			const lat = Number(data.latitude ?? data.lat);
			const lng = Number(data.longitude ?? data.lon ?? data.lng);
			const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

			const rawCode = String(data.country_code ?? data.countryCode ?? data.country ?? '');
			const countryCode = /^[A-Za-z]{2}$/.test(rawCode) ? rawCode.toUpperCase() : null;

			if (coords || countryCode) return { coords, countryCode };
		} catch {
			// try the next provider
		}
	}
	return null;
}

/**
 * Resolves the visitor's location once per session, then stores it.
 * - Country, currency and flag metadata come from the IP lookup (or the stored
 *   choice) and are kept in localStorage so the UI can render them immediately.
 * - Coordinates always try the browser's geolocation first, then fall back to
 *   the last stored coords, and finally to IP-based coords. They are mirrored
 *   in a cookie the server reads (e.g. featured listings).
 */
export async function initLocation(): Promise<void> {
	if (!browser || initStarted) return;
	initStarted = true;

	const storedCoords = location.coords ?? readStoredCoords();
	const country = location.country ?? readStoredCountry();

	if (country) {
		location.country = country;
		persistCurrency(country.currency);
	}

	const ip = await fetchByIp();

	if (!country && ip?.countryCode) {
		const c = getCountry(ip.countryCode);
		if (c) {
			location.country = c;
			persistCountry(c.code);
			persistCurrency(c.currency);
			persistCountrySource('ip');
		}
	}

	let gps: GeoCoords | null = null;
	try {
		gps = await getCurrentPosition();
		location.source = 'gps';
	} catch {
		// geolocation denied or unavailable — fall back to stored coords, then IP
	}

	if (gps) {
		location.coords = gps;
		location.resolved = true;
		persistCoords(gps);
		await invalidateAll();
	} else if (storedCoords) {
		location.coords = storedCoords;
		location.resolved = true;
		setCookie(storedCoords);
	} else if (ip?.coords) {
		location.coords = ip.coords;
		location.source = 'ip';
		location.resolved = true;
		persistCoords(ip.coords);
		await invalidateAll();
	}
}

/** Overrides the displayed country from the picker and persists the choice. */
export function setCountry(code: string): void {
	const c = getCountry(code);
	if (!c) return;
	location.country = c;
	persistCountry(c.code);
	persistCurrency(c.currency);
	persistCountrySource('manual');
	void invalidateAll();
}

/**
 * Applies the logged-in user's profile country as the default browse location
 * (driving the display currency sent as `currency=` to the listing APIs). A
 * country the user picked manually always wins, so the profile default is
 * skipped when the stored source is already "manual".
 *
 * `invalidate` (default true) re-runs the current page's loads so the new
 * currency is picked up immediately. Login sets it to false: the navigation
 * that follows a successful login re-runs loads anyway, and calling
 * invalidateAll while that navigation is in flight would abort it.
 */
function applyCountry(code: string, source: CountrySource, { invalidate = true } = {}): void {
	const c = getCountry(code);
	if (!c) return;
	location.country = c;
	persistCountry(c.code);
	persistCurrency(c.currency);
	persistCountrySource(source);
	if (invalidate) void invalidateAll();
}

/**
 * Applies the logged-in user's profile country as the default browse location
 * (driving the display currency sent as `currency=` to the listing APIs). A
 * country the user picked manually always wins, so the profile default is
 * skipped when the stored source is already "manual".
 */
export function applyProfileCountry(
	code: string | null | undefined,
	opts?: { invalidate?: boolean }
): void {
	if (!browser || !code) return;
	if (readCountrySource() === 'manual') return;
	applyCountry(code, 'profile', opts);
}

/**
 * Explicitly re-applies the logged-in user's profile country, overriding any
 * manual choice — used by the "use my profile" reset in the country selector.
 */
export function resetToProfileCountry(code: string | null | undefined): void {
	if (!browser || !code) return;
	applyCountry(code, 'profile');
}

/**
 * Clears any manually picked country so the display currency reverts to the
 * visitor's actual location (re-derived from IP). The stored choice and its
 * source flag are removed; a logged-in profile country is only re-applied on
 * the next login.
 */
export async function clearCountry(): Promise<void> {
	if (!browser) return;
	try {
		window.localStorage.removeItem(COUNTRY_KEY);
		window.localStorage.removeItem(COUNTRY_SOURCE_KEY);
	} catch {
		// ignore
	}
	try {
		document.cookie = `${CURRENCY_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
	} catch {
		// ignore
	}
	location.country = null;

	const ip = await fetchByIp();
	if (ip?.countryCode) {
		const c = getCountry(ip.countryCode);
		if (c) {
			location.country = c;
			persistCountry(c.code);
			persistCurrency(c.currency);
			persistCountrySource('ip');
		}
	}
	void invalidateAll();
}
