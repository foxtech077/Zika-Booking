/**
 * Shared token-refresh module.
 *
 * Module-level singleton ensures that if multiple callers receive a 401
 * simultaneously (e.g. booking + payment requests), only ONE refresh request
 * is issued. All callers await the same promise and receive the same new
 * access token.
 */

import { browser } from '$app/environment';
import { setSession, type AuthUser } from '$lib/stores/auth.svelte';

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
				data?: { tokens?: { accessToken?: string }; user?: AuthUser };
			};

			const newToken: string | undefined = body?.data?.tokens?.accessToken;
			if (!newToken) return null;

			if (browser) {
				sessionStorage.setItem(TOKEN_KEY, newToken);
				localStorage.setItem(TOKEN_KEY, newToken);
			}

			// The auth service returns a fresh user alongside the rotated tokens,
			// so persist it.
			const { auth } = await import('$lib/stores/auth.svelte');
			const freshUser = body?.data?.user ?? auth.user;
			if (freshUser) {
				setSession(newToken, freshUser);
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
 * Used only to distinguish account vs anonymous tokens — host status is a
 * regular profile field now, not read from the JWT.
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
