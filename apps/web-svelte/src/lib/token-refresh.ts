/**
 * Shared token-refresh module.
 *
 * Module-level singleton ensures that if multiple callers receive a 401
 * simultaneously (e.g. booking + payment requests), only ONE refresh request
 * is issued. All callers await the same promise and receive the same new
 * access token.
 */

import { browser } from '$app/environment';
import { setSession } from '$lib/stores/auth.svelte';

const TOKEN_KEY = 'kainook:access_token';

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Calls POST /api/auth/refresh (SvelteKit server route → auth-service proxy).
 * Returns the new access token, or null if the refresh token is
 * expired/invalid. Concurrent calls share a single in-flight promise.
 */
export async function refreshAccessToken(): Promise<string | null> {
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async () => {
		try {
			const res = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'same-origin'
			});

			if (!res.ok) return null;

			const body = (await res.json().catch(() => ({}))) as {
				data?: { tokens?: { accessToken?: string } };
			};

			const newToken: string | undefined = body?.data?.tokens?.accessToken;
			if (!newToken) return null;

			if (browser) {
				sessionStorage.setItem(TOKEN_KEY, newToken);
				localStorage.setItem(TOKEN_KEY, newToken);
			}

			// Refresh the persisted user profile too — the store rehydrates from
			// storage, so keep it in sync with the freshly-minted session.
			const { auth } = await import('$lib/stores/auth.svelte');
			if (auth.user) {
				setSession(newToken, auth.user);
			}

			return newToken;
		} catch {
			return null;
		}
	})().finally(() => {
		refreshInFlight = null;
	});

	return refreshInFlight;
}

/**
 * Best-effort JWT payload decode (client-side, no signature verification).
 */
export function decodeJwtPayload(
	token: string
): { exp?: number; type?: string; sub?: string } | null {
	if (typeof atob !== 'function') return null;
	try {
		const parts = token.split('.');
		if (parts.length < 2) return null;
		const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(json) as { exp?: number; type?: string; sub?: string };
	} catch {
		return null;
	}
}

/** True when the stored token is an account token (type "user"), not anonymous. */
export function hasAccountToken(token: string | null | undefined): boolean {
	if (!token) return false;
	return decodeJwtPayload(token)?.type === 'user';
}
