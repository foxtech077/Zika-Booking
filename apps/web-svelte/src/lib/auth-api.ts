import { AUTH_API_URL } from '$lib/config';
import type { AuthUser } from '$lib/stores/auth.svelte';

/**
 * Auth-service client.
 *
 * Fetch-based with `credentials: 'include'` so the httpOnly web_refresh_token
 * cookie is exchanged on login/register/oauth — the browser stores it and the
 * refresh proxy route relays it later.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export interface AuthTokens {
	accessToken: string;
	expiresIn: number;
}

export interface AuthResponse {
	user: AuthUser;
	tokens: AuthTokens;
	message?: string;
}

export interface ApiError {
	code?: string;
	message?: string;
	fields?: Record<string, string>;
}

export class AuthApiError extends Error {
	code?: string;
	fields?: Record<string, string>;
	status?: number;

	constructor(
		message: string,
		opts?: { code?: string; fields?: Record<string, string>; status?: number }
	) {
		super(message);
		this.code = opts?.code;
		this.fields = opts?.fields;
		this.status = opts?.status;
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...(init.headers as Record<string, string> | undefined)
		};
		if (init.body) headers['Content-Type'] = 'application/json';

		const res = await fetch(`${AUTH_API_URL}${path}`, {
			...init,
			headers,
			credentials: 'include',
			signal: controller.signal
		});

		const json = (await res.json().catch(() => ({}))) as {
			success?: boolean;
			data?: T;
			error?: ApiError;
		};

		if (!res.ok || json?.success === false) {
			throw new AuthApiError(json?.error?.message ?? `Request failed (${res.status})`, {
				code: json?.error?.code,
				fields: json?.error?.fields,
				status: res.status
			});
		}

		return json.data as T;
	} finally {
		clearTimeout(timer);
	}
}

export function login(payload: { email: string; password: string }): Promise<AuthResponse> {
	return request<AuthResponse>('/auth/login', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export function register(payload: {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	confirmPassword: string;
	acceptedPrivacy?: boolean;
}): Promise<Partial<AuthResponse> & { message?: string }> {
	return request('/auth/register', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export function verifyEmail(token: string): Promise<AuthResponse & { message: string }> {
	return request(`/auth/verify?token=${encodeURIComponent(token)}`, { method: 'GET' });
}

export function resendVerification(email: string): Promise<{ message?: string }> {
	return request('/auth/resend-verification', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export function acceptTerms(payload: {
	acceptedPrivacy?: boolean;
	acceptedTerms?: boolean;
}): Promise<{
	user: AuthUser;
	acceptedAt: string;
}> {
	return request('/auth/accept-terms', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export function forgotPassword(email: string): Promise<{ message?: string }> {
	return request('/auth/forgot-password', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export function resetPassword(payload: {
	token: string;
	password: string;
	confirmPassword: string;
}): Promise<AuthResponse & { message?: string }> {
	return request('/auth/reset-password', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export function oauthGoogle(idToken: string): Promise<AuthResponse> {
	return request('/auth/oauth/google', {
		method: 'POST',
		body: JSON.stringify({ idToken })
	});
}

export async function logout(): Promise<void> {
	try {
		await request<unknown>('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
	} catch {
		// best-effort — local session is cleared regardless
	}
}

// ── Inline validators (mirror @zika/validators rules) ─────────────────────────

export function validateEmail(email: string): string | null {
	if (!email) return 'Email address is required';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
	return null;
}

export function validatePassword(password: string): string | null {
	if (!password) return 'Password is required';
	if (password.length < 8) return 'Password must be at least 8 characters';
	if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
	if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
	if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
	return null;
}
