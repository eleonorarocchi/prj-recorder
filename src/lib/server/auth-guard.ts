import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isAllowedGithubUser } from './github-allowlist.js';

export async function requireUser(event: RequestEvent, endpoint = false) {
	const session = await event.locals.auth();
	const allowed = Boolean(session?.user && isAllowedGithubUser(session.user.id, env.GITHUB_ALLOWED_USER_ID));
	if (!allowed && process.env.NODE_ENV !== 'production') {
		console.info('[auth] protected route check', {
			path: event.url.pathname,
			sessionUserPresent: Boolean(session?.user),
			sessionUserIdPresent: Boolean(session?.user?.id),
			allowed
		});
	}
	if (!allowed) {
		if (endpoint) throw error(401, 'Unauthorized');
		throw redirect(303, `/login?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return session.user;
}
