import { browser } from '$app/environment';
import { AUTH_API_URL } from '$lib/config';
import { refreshAccessToken, hasAccountToken } from '$lib/token-refresh';
import { clearSession } from '$lib/stores/auth.svelte';

export { hasAccountToken };

/**
 * Shared HTTP client for the listing + payment services.
 *
 * Replicates the interceptor behaviour the Next.js app had in axios:
 *   • attaches the access token from sessionStorage/localStorage
 *   • on 401, recovers once:
 *       - account token → refresh via the auth-service proxy, retry
 *       - anonymous / no token → mint a fresh anonymous token (same stable
 *         sub), retry
 *   • otherwise rethrows the API error with `.code` and `.status` set.
 */

const TOKEN_KEY = 'kainook:access_token';
const DEVICE_ID_KEY = 'kainook:device_id';
const REQUEST_TIMEOUT_MS = 12_000;

export function getToken(): string | null {
	if (!browser) return null;
	try {
		return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

export function setToken(token: string): void {
	if (!browser) return;
	try {
		sessionStorage.setItem(TOKEN_KEY, token);
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		// ignore storage errors
	}
}

export function clearToken(): void {
	if (!browser) return;
	try {
		sessionStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(TOKEN_KEY);
	} catch {
		// ignore storage errors
	}
}

export interface ApiErrorBody {
	code?: string;
	message?: string;
	fields?: Record<string, string>;
}

export class ApiError extends Error {
	code?: string;
	status?: number;
	fields?: Record<string, string>;

	constructor(
		message: string,
		opts?: { code?: string; status?: number; fields?: Record<string, string> }
	) {
		super(message);
		this.code = opts?.code;
		this.status = opts?.status;
		this.fields = opts?.fields;
	}
}

type RequestInitWithRetry = RequestInit & { _retried?: boolean };

/**
 * Core request helper for authenticated listing/payment endpoints.
 * @param baseUrl service base (e.g. LISTING_API_URL, PAYMENT_API_URL)
 * @param url full URL path (may be absolute or relative to baseUrl)
 */
export async function apiRequest<T>(
	baseUrl: string,
	url: string,
	init: RequestInitWithRetry = {}
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...(init.headers as Record<string, string> | undefined)
		};
		// Only advertise a JSON body when one is actually sent — a body-less
		// request (e.g. DELETE lock) with Content-Type set fails Fastify with
		// FST_ERR_CTP_EMPTY_JSON_BODY.
		if (init.body) headers['Content-Type'] = 'application/json';
		const token = getToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const target = url.startsWith('http') ? url : `${baseUrl}${url}`;
		const res = await fetch(target, { ...init, headers, signal: controller.signal });
		const json = (await res.json().catch(() => ({}))) as {
			success?: boolean;
			data?: unknown;
			error?: ApiErrorBody;
		};
		if (!res.ok || json?.success === false) {
			const code = json?.error?.code;
			const message = json?.error?.message ?? `Request failed (${res.status})`;
			// A 401 means the bearer token expired (or is invalid). Recover once:
			//   • account token → refresh it via the auth-service proxy, retry
			//   • anonymous / no token → mint a fresh anonymous token (same
			//     stable sub), retry
			// Never on the token-mint endpoint itself, and never twice.
			if (res.status === 401 && !init._retried && !url.includes('/auth/anonymous-token')) {
				const hadAccountToken = hasAccountToken(getToken());
				init._retried = true;
				if (hadAccountToken) {
					const newToken = await refreshAccessToken();
					if (newToken) {
						init.headers = {
							...(init.headers as Record<string, string>),
							Authorization: `Bearer ${newToken}`
						};
						return apiRequest<T>(baseUrl, url, init);
					}
					clearSession();
				} else {
					clearToken();
					const { accessToken } = await requestAnonymousToken(baseUrl);
					if (accessToken) {
						init.headers = {
							...(init.headers as Record<string, string>),
							Authorization: `Bearer ${accessToken}`
						};
						return apiRequest<T>(baseUrl, url, init);
					}
				}
			}
			throw new ApiError(message, { code, status: res.status, fields: json?.error?.fields });
		}
		return json.data as T;
	} finally {
		clearTimeout(timer);
	}
}

/** Best-effort JWT payload decode (client-side, no signature verification). */
function decodeJwtPayload(token: string): { exp?: number; type?: string; sub?: string } | null {
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

/** True when the token is missing, malformed, not anonymous, or past its exp. */
export function isAnonymousTokenValid(token: string | null | undefined): boolean {
	if (!token) return false;
	const payload = decodeJwtPayload(token);
	if (!payload || payload.type !== 'anonymous' || !payload.exp) return false;
	return payload.exp * 1000 > Date.now();
}

/** Returns a stable device id so re-minted anonymous tokens keep the same sub. */
export function getOrCreateDeviceId(): string {
	if (!browser) return '';
	try {
		let id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
		return id;
	} catch {
		return '';
	}
}

/** Mints a stateless anonymous access token for checkout (no sign-in). */
export async function requestAnonymousToken(
	baseUrl = AUTH_API_URL
): Promise<{ accessToken: string; expiresIn: number }> {
	const deviceId = getOrCreateDeviceId();
	const data = await apiRequest<{ accessToken: string; expiresIn: number }>(
		baseUrl,
		'/auth/anonymous-token',
		{
			method: 'POST',
			body: JSON.stringify(deviceId ? { deviceId } : {})
		}
	);
	setToken(data.accessToken);
	return data;
}
