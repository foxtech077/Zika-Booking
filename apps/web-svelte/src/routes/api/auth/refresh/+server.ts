import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AUTH_API_URL } from '$lib/config';

/**
 * POST /api/auth/refresh
 *
 * Proxies the refresh-token call to the auth service so the browser never
 * needs to make a cross-origin request with credentials. The httpOnly
 * `web_refresh_token` cookie arrives from the browser, gets forwarded
 * server-side, and the rotated Set-Cookie header from the auth service is
 * forwarded back so the browser always holds the latest refresh token.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const refreshToken = cookies.get('web_refresh_token');

	if (!refreshToken) {
		return json(
			{ success: false, error: { code: 'NO_TOKEN', message: 'No refresh token.' } },
			{ status: 401 }
		);
	}

	let upstream: Response;
	try {
		upstream = await fetch(`${AUTH_API_URL}/auth/refresh`, {
			method: 'POST',
			headers: {
				Cookie: `web_refresh_token=${refreshToken}`
			}
		});
	} catch {
		return json(
			{ success: false, error: { code: 'REFRESH_FAILED', message: 'Token refresh failed.' } },
			{ status: 500 }
		);
	}

	const body = await upstream.json().catch(() => ({}));

	// Forward the rotated refresh-token cookie to the browser.
	const setCookie = upstream.headers.get('set-cookie');
	if (setCookie) {
		return new Response(JSON.stringify(body), {
			status: upstream.status,
			headers: { 'content-type': 'application/json', 'set-cookie': setCookie }
		});
	}

	return json(body, { status: upstream.status });
};
