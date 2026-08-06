import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AUTH_API_URL } from '$lib/config';

/**
 * Same-origin proxy for the auth service.
 *
 * The browser never talks to the auth API directly — every call goes through
 * this route so the httpOnly `web_refresh_token` Set-Cookie lands on the
 * frontend's own origin. Without it the auth service's SameSite=Lax cookie is
 * rejected by the browser because the frontend and api.kainook.com are
 * cross-site, which silently breaks session refresh.
 *
 * The upstream Set-Cookie is sanitized (any `Domain` attribute is stripped) so
 * the cookie is stored for the frontend host rather than a foreign domain.
 */
async function proxyRequest(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const path = event.params.path ?? '';
	const url = `${AUTH_API_URL}/${path}${event.url.search}`;

	const headers = new Headers();
	const cookie = event.request.headers.get('cookie');
	if (cookie) headers.set('cookie', cookie);
	const contentType = event.request.headers.get('content-type');
	if (contentType) headers.set('content-type', contentType);
	const accept = event.request.headers.get('accept');
	if (accept) headers.set('accept', accept);
	const authorization = event.request.headers.get('authorization');
	if (authorization) headers.set('authorization', authorization);

	const method = event.request.method;
	const hasBody = method !== 'GET' && method !== 'HEAD';

	let upstream: Response;
	try {
		upstream = await fetch(url, {
			method,
			headers,
			body: hasBody ? await event.request.text() : undefined
		});
	} catch {
		return json(
			{
				success: false,
				error: { code: 'AUTH_SERVICE_UNREACHABLE', message: 'Unable to reach the auth service.' }
			},
			{ status: 502 }
		);
	}

	const body = await upstream.arrayBuffer();
	const res = new Response(body, { status: upstream.status });

	const contentTypeOut = upstream.headers.get('content-type');
	if (contentTypeOut) res.headers.set('content-type', contentTypeOut);

	const setCookies =
		typeof upstream.headers.getSetCookie === 'function'
			? upstream.headers.getSetCookie()
			: upstream.headers.get('set-cookie')
				? [upstream.headers.get('set-cookie')!]
				: [];
	for (const sc of setCookies) {
		// Strip any foreign Domain attribute so the cookie is stored on this origin.
		res.headers.append('set-cookie', sc.replace(/;\s*Domain=[^;]*/gi, ''));
	}

	return res;
}

export const GET: RequestHandler = (event) => proxyRequest(event);
export const POST: RequestHandler = (event) => proxyRequest(event);
export const PUT: RequestHandler = (event) => proxyRequest(event);
export const PATCH: RequestHandler = (event) => proxyRequest(event);
export const DELETE: RequestHandler = (event) => proxyRequest(event);
