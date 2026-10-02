import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { env } from '$env/dynamic/private';
import { isAllowedGithubUser } from './lib/server/github-allowlist.js';

export { isAllowedGithubUser };

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: process.env.AUTH_TRUST_HOST === 'true' || process.env.NODE_ENV !== 'production',
	providers: [GitHub({ authorization: { params: { scope: 'read:user' } } })],
	callbacks: {
		signIn({ profile }) {
			const allowed = isAllowedGithubUser(profile?.id, env.GITHUB_ALLOWED_USER_ID);
			if (process.env.NODE_ENV !== 'production') {
				console.info('[auth] GitHub allowlist check', {
					login: typeof profile?.login === 'string' ? profile.login : null,
					profileIdPresent: profile?.id !== undefined && profile?.id !== null,
					configuredIdValid: typeof env.GITHUB_ALLOWED_USER_ID === 'string'
						&& /^\d+$/.test(env.GITHUB_ALLOWED_USER_ID.trim()),
					allowed
				});
			}
			return allowed;
		},
		jwt({ token, profile }) {
			if (profile && isAllowedGithubUser(profile.id, env.GITHUB_ALLOWED_USER_ID)) token.sub = String(profile.id);
			return token;
		},
		session({ session, token }) {
			if (session.user && token.sub) session.user.id = token.sub;
			return session;
		}
	},
	session: { strategy: 'jwt' }
});
