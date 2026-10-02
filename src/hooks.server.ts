import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth.js';
import { isAllowedGithubUser } from './lib/server/github-allowlist.js';

const authorizationHandle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	if (pathname === '/health' || pathname === '/login' || pathname.startsWith('/auth/')) return resolve(event);
	const session = await event.locals.auth();
	if (!session?.user || !isAllowedGithubUser(session.user.id, env.GITHUB_ALLOWED_USER_ID)) {
		if (pathname.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
		throw redirect(303, `/login?returnTo=${encodeURIComponent(pathname + event.url.search)}`);
	}
	return resolve(event);
};

export const handle = sequence(authHandle, authorizationHandle);
