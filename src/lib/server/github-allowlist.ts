export function isAllowedGithubUser(profileId: unknown, configuredId = process.env.GITHUB_ALLOWED_USER_ID): boolean {
	if (typeof configuredId !== 'string' || !/^\d+$/.test(configuredId.trim())) return false;
	const id = typeof profileId === 'number' && Number.isSafeInteger(profileId) && profileId >= 0
		? String(profileId)
		: typeof profileId === 'string' && /^\d+$/.test(profileId) ? profileId : null;
	return id !== null && id === configuredId.trim();
}
