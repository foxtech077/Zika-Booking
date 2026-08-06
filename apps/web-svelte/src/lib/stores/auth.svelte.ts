import { browser } from '$app/environment';
import { applyProfileCountry } from '$lib/stores/location.svelte';

/**
 * Auth session state.
 *
 * Mirrors the `PublicUser` shape the auth service returns so the header and
 * booking flow can read profile fields without depending on the @zika CJS
 * packages. The access token is persisted under the same key the booking API
 * helpers read (`kainook:access_token`), so account sessions and anonymous
 * checkout share one storage slot.
 */

export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';

export interface AuthUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	status: UserStatus;
	userType: string;
	businessName?: string | null;
	country?: string | null;
	phone?: string | null;
	emailVerified: boolean;
	currentTier: string;
	loyaltyPoints: number;
	/** Host profile (Accreditation) status. Only 'approved' may manage listings. */
	hostStatus?: 'approved' | 'pending' | 'rejected' | null;
	/** Set by the API when the user has never accepted the Privacy Policy or
	 *  accepted a superseded version. Gates entry to the app. */
	requiresPrivacyAcceptance?: boolean;
	/** Set when the user has not yet accepted the Terms at checkout. Cleared by
	 *  a per-transaction POST /auth/accept-terms. */
	requiresTermsAcceptance?: boolean;
	privacyAcceptedAt?: string | Date | null;
	termsAcceptedAt?: string | Date | null;
}

const TOKEN_KEY = 'kainook:access_token';
const AUTH_STORAGE_KEY = 'kainook:web_auth';

export const auth = $state({
	user: null as AuthUser | null,
	isAuthenticated: false
});

let initialized = $state(false);

function readPersisted(): { user: AuthUser | null } {
	try {
		const raw = localStorage.getItem(AUTH_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed?.user) return { user: parsed.user };
		}
	} catch {
		// ignore malformed storage
	}
	return { user: null };
}

function readToken(): string | null {
	try {
		return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

/** True when the stored token is a real account token (JWT type "user"), not an
 *  anonymous checkout token. An anonymous session must still see Sign In and
 *  account-upgrade prompts, so it never counts as authenticated. */
function hasAccountToken(): boolean {
	const token = readToken();
	if (!token) return false;
	try {
		const parts = token.split('.');
		if (parts.length < 2) return false;
		const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
		const payload = JSON.parse(json) as { type?: string };
		return payload?.type === 'user';
	} catch {
		return false;
	}
}

function persistUser(user: AuthUser | null): void {
	if (!browser) return;
	try {
		if (user) {
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));
		} else {
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
	} catch {
		// ignore storage errors
	}
}

export function initAuth(): void {
	if (initialized || !browser) return;
	initialized = true;
	const { user: storedUser } = readPersisted();
	auth.user = storedUser ? normalizeUser(storedUser) : null;
	auth.isAuthenticated = !!storedUser || hasAccountToken();
}

/** Email addresses are case-insensitive — normalise to lowercase for display
 *  and matching (the auth service lowercases on registration too). */
function normalizeUser(user: AuthUser): AuthUser {
	if (user.email) return { ...user, email: user.email.trim().toLowerCase() };
	return user;
}

export function setSession(token: string, user: AuthUser): void {
	if (!browser) return;
	try {
		sessionStorage.setItem(TOKEN_KEY, token);
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		// ignore storage errors
	}
	// A freshly minted anonymous token must not outlive a login — otherwise the
	// booking request helpers would fall back to it and masquerade as the guest.
	const normalized = normalizeUser(user);
	persistUser(normalized);
	auth.user = normalized;
	auth.isAuthenticated = true;

	// A country selected on the user's profile becomes the default browse
	// location on login — it drives the display currency sent as `currency=`.
	// Applied synchronously with `invalidate: false`: the login/register
	// navigation that immediately follows re-runs the loads with the new
	// country/currency, and an invalidateAll fired during that navigation
	// would abort it, stranding the user on the auth page. A manual selection
	// always wins, and anonymous sessions never reach setSession.
	try {
		const profileCountry = normalized.country?.trim().toUpperCase();
		if (profileCountry) {
			applyProfileCountry(profileCountry, { invalidate: false });
		}
	} catch {
		// non-fatal — the profile country is only a default
	}
}

export function updateUser(updates: Partial<AuthUser>): void {
	if (!auth.user) return;
	const next = normalizeUser({ ...auth.user, ...updates });
	persistUser(next);
	auth.user = next;
}

export function clearSession(): void {
	if (!browser) return;
	try {
		sessionStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(AUTH_STORAGE_KEY);
	} catch {
		// ignore
	}
	auth.user = null;
	auth.isAuthenticated = false;
}

// Initialize once on the client at module load so the header renders the
// correct auth state on first paint (no flash of "Sign In" for logged-in users).
initAuth();
