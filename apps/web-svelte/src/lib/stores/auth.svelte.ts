import { browser } from '$app/environment';

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
	/** Set by the API when the user has never accepted the Privacy Policy or
	 *  accepted a superseded version. Gates entry to the app. */
	requiresPrivacyAcceptance?: boolean;
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

function hasToken(): boolean {
	try {
		return !!(sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY));
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
	auth.user = storedUser;
	auth.isAuthenticated = !!storedUser || hasToken();
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
	persistUser(user);
	auth.user = user;
	auth.isAuthenticated = true;
}

export function updateUser(updates: Partial<AuthUser>): void {
	if (!auth.user) return;
	const next = { ...auth.user, ...updates };
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
