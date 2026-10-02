import { describe, expect, it } from 'vitest';
import { isAllowedGithubUser } from '../src/lib/server/github-allowlist.js';
import { requireUser } from '../src/lib/server/auth-guard.js';
import { actions as projectActions, load as projectLoad } from '../src/routes/+page.server.js';

describe('GitHub authorization', () => {
	it('matches only a well-formed configured numeric id', () => {
		expect(isAllowedGithubUser(123, '123')).toBe(true);
		expect(isAllowedGithubUser('123', '123')).toBe(true);
		expect(isAllowedGithubUser('124', '123')).toBe(false);
		expect(isAllowedGithubUser(123, undefined)).toBe(false);
		expect(isAllowedGithubUser(undefined, '123')).toBe(false);
		expect(isAllowedGithubUser('abc', '123')).toBe(false);
		expect(isAllowedGithubUser('123', '12x')).toBe(false);
	});

	it('redirects anonymous page requests and rejects anonymous endpoints', async () => {
		const event = { locals: { auth: async () => null }, url: new URL('http://localhost/projects/7?q=x') } as never;
		await expect(requireUser(event)).rejects.toMatchObject({ status: 303, location: '/login?returnTo=%2Fprojects%2F7%3Fq%3Dx' });
		await expect(requireUser(event, true)).rejects.toMatchObject({ status: 401 });
	});

	it('blocks anonymous project loads and create actions before database access', async () => {
		const previousPath = process.env.DATABASE_PATH;
		process.env.DATABASE_PATH = process.cwd();
		const event = {
			locals: { auth: async () => null },
			url: new URL('http://localhost/'),
			request: new Request('http://localhost/', { method: 'POST', body: new URLSearchParams({ clientName: 'A', projectName: 'B', status: 'open', tags: '' }) })
		} as never;
		try {
			await expect(projectLoad(event)).rejects.toMatchObject({ status: 303 });
			await expect(projectActions.create?.(event as never)).rejects.toMatchObject({ status: 303 });
		} finally { if (previousPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = previousPath; }
	});

	it('returns the authenticated public user', async () => {
		const previous = process.env.GITHUB_ALLOWED_USER_ID;
		process.env.GITHUB_ALLOWED_USER_ID = '123';
		const user = { id: '123', name: 'Recorder' };
		const event = { locals: { auth: async () => ({ user }) }, url: new URL('http://localhost/') } as never;
		try { await expect(requireUser(event)).resolves.toEqual(user); }
		finally { if (previous === undefined) delete process.env.GITHUB_ALLOWED_USER_ID; else process.env.GITHUB_ALLOWED_USER_ID = previous; }
	});
});
