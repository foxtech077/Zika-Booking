import { browser } from '$app/environment';

/**
 * Post-checkout review context.
 *
 * After a successful payment the review screen URL can be preloaded with the
 * booking id/listing, but the checkout redirect doesn't carry those params.
 * The context is stashed here (localStorage) at payment capture and consumed
 * by the reviews page as a fallback when no ?bookingId is present, mirroring
 * apps/web's zika:review_context handling.
 */

const REVIEW_CONTEXT_KEY = 'kainook:review_context';

export interface ReviewContext {
	bookingId: string;
	listingId?: string;
	listingName?: string;
}

export function readReviewContext(): ReviewContext | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(REVIEW_CONTEXT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ReviewContext;
		return parsed?.bookingId ? parsed : null;
	} catch {
		return null;
	}
}

export function storeReviewContext(ctx: ReviewContext): void {
	if (!browser) return;
	try {
		localStorage.setItem(REVIEW_CONTEXT_KEY, JSON.stringify(ctx));
	} catch {
		// ignore storage errors
	}
}

export function clearReviewContext(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(REVIEW_CONTEXT_KEY);
	} catch {
		// ignore storage errors
	}
}
