import {
	PUBLIC_LISTING_API_URL,
	PUBLIC_AUTH_API_URL,
	PUBLIC_PAYMENT_API_URL,
	PUBLIC_PROVIDER_URL
} from '$env/static/public';

export const LISTING_API_URL = PUBLIC_LISTING_API_URL;

export const AUTH_API_URL = PUBLIC_AUTH_API_URL;

export const PAYMENT_API_URL = PUBLIC_PAYMENT_API_URL;

/** Base URL of the provider dashboard (the apps/web/provider deployment). The
 *  header's Create/Manage Listings entries link there; the dashboard lives in
 *  a separate app, not this one. */
export const PROVIDER_URL = PUBLIC_PROVIDER_URL || 'https://www.kainook.com';

export const DEFAULT_COORDS = { lat: -1.2921, lng: 36.8219 };

export interface Coords {
	lat: number;
	lng: number;
}

export function parseCoordsCookie(raw: string | null | undefined): Coords | null {
	if (!raw) return null;
	try {
		const [latStr, lngStr] = decodeURIComponent(raw).split(',');
		const lat = Number(latStr);
		const lng = Number(lngStr);
		if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
	} catch {
		// ignore malformed cookie
	}
	return null;
}

export const LISTING_IMAGE_FALLBACK =
	'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80';
