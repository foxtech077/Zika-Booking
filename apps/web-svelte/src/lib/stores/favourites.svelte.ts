import { browser } from '$app/environment';
import { getFavourites } from '$lib/account-api';
import { auth } from '$lib/stores/auth.svelte';

/**
 * Favourites / wishlist state.
 *
 * The listing service only enriches search/detail responses with
 * `isFavourited` when the request carries the access token, and the SSR
 * listing loads can't reach the client token storage. Instead of relying on
 * that server field, the hearts read from this store: the signed-in user's
 * favourites are fetched once per session and kept reactive, so a favourited
 * listing still shows as favourited after a refresh (the client re-renders
 * once the list loads). This mirrors apps/web's useFavourites hook.
 */
export const favourites = $state({
	/** Listing ids currently favourited by the signed-in user. */
	ids: new Set<string>(),
	/** True while the first per-user fetch is in flight. */
	loading: false,
	/** The user id the current set was loaded for (null = not loaded). */
	loadedFor: null as string | null
});

function currentUserId(): string | null {
	return auth.user?.id ?? null;
}

/**
 * Loads the signed-in user's favourites into the store. No-op for guests and
 * idempotent per user, so calling it from multiple pages is safe.
 */
export async function loadFavourites(): Promise<void> {
	if (!browser) return;
	if (!auth.isAuthenticated) {
		// A logged-out (or anonymous) session must not see stale favourites.
		favourites.ids = new Set();
		favourites.loadedFor = null;
		return;
	}
	const userId = currentUserId();
	if (!userId || favourites.loadedFor === userId) return;
	favourites.loadedFor = userId;
	favourites.loading = true;
	try {
		const items = await getFavourites();
		favourites.ids = new Set(items.map((f) => f.listingId).filter(Boolean));
	} catch {
		// Non-fatal — hearts stay unfilled rather than breaking the page.
		favourites.ids = new Set();
	} finally {
		favourites.loading = false;
	}
}

/** True when the given listing is in the signed-in user's favourites. */
export function isFavourited(listingId: string): boolean {
	return favourites.ids.has(listingId);
}

/** Adds/removes a listing id locally, mirroring a completed toggle. */
export function setFavourite(listingId: string, on: boolean): void {
	const next = new Set(favourites.ids);
	if (on) next.add(listingId);
	else next.delete(listingId);
	favourites.ids = next;
}
