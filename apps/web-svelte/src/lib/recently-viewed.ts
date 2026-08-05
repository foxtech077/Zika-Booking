import { browser } from '$app/environment';
import type { ListingCategory } from '$lib/listing-api';

/**
 * Guest-side "recently viewed" history.
 *
 * Signed-in users have server-side history (GET/POST /guests/me/recently-viewed).
 * Guests have no account, so we keep a small local-most-recent list in
 * localStorage; the home page and the listing detail page read/write it.
 */

export interface LocalViewedListing {
	id: string;
	name: string;
	category: ListingCategory;
	town: string;
	country: string;
	pricePerNight: number;
	currency: string;
	primaryPhotoUrl: string | null;
	viewedAt: string;
}

const STORAGE_KEY = 'kainook:recently_viewed';
const MAX_ITEMS = 12;

function read(): LocalViewedListing[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as LocalViewedListing[]) : [];
	} catch {
		return [];
	}
}

function write(items: LocalViewedListing[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch {
		// ignore storage errors (private mode / quota)
	}
}

export function getLocalRecentlyViewed(): LocalViewedListing[] {
	return read();
}

export function addLocalRecentlyViewed(
	item: Omit<LocalViewedListing, 'viewedAt'>
): LocalViewedListing[] {
	const next = [
		{ ...item, viewedAt: new Date().toISOString() },
		...read().filter((x) => x.id !== item.id)
	].slice(0, MAX_ITEMS);
	write(next);
	return next;
}
