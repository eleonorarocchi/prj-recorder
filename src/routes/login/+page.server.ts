import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { signIn, signOut } from '../../auth.js';
import { isAllowedGithubUser } from '../../lib/server/github-allowlist.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
	const user = (await event.locals.auth())?.user;
	const allowed = Boolean(user && isAllowedGithubUser(user.id, env.GITHUB_ALLOWED_USER_ID));
	if (allowed) throw redirect(303, '/');
	return {
		denied: event.url.searchParams.has('error') || Boolean(user),
		returnTo: safeReturnTo(event.url.searchParams.get('returnTo'))
	};
};

function safeReturnTo(value: string | null): string {
	return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export const actions: Actions = { signin: signIn, logout: signOut };
