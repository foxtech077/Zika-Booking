import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The auth service emails reset links to `${WEB}/reset-password?token=...`
 * (the apps/web URL). This app keeps its reset screen at /auth/reset-password,
 * so any emailed link landing here is forwarded on, preserving the token.
 */
export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	const qs = token ? `?token=${encodeURIComponent(token)}` : '';
	redirect(308, `/auth/reset-password${qs}`);
};
