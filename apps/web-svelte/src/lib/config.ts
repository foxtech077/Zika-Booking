import { PUBLIC_LISTING_API_URL } from '$env/static/public';

export const LISTING_API_URL = PUBLIC_LISTING_API_URL;

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
