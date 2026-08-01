import { browser } from '$app/environment';

export interface AuthUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	userType: string;
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
			const state = parsed?.state;
			if (state?.user) return { user: state.user };
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

export function initAuth(): void {
	if (initialized || !browser) return;
	initialized = true;
	const { user: storedUser } = readPersisted();
	auth.user = storedUser;
	auth.isAuthenticated = !!storedUser || hasToken();
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
