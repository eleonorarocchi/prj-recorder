import { fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard.js';
import { createProject, listTagSuggestions, ProjectError } from '$lib/server/projects.js';
import type { Actions, PageServerLoad } from './$types.js';
const parseTags = (value: FormDataEntryValue | null) => String(value ?? '').split(/[\n,]/).filter((tag) => tag.trim());
export const load: PageServerLoad = async (event) => { await requireUser(event); return { suggestions: listTagSuggestions() }; };
export const actions: Actions = { default: async (event) => {
	await requireUser(event);
	const form = await event.request.formData();
	try {
		const id = createProject({ clientName: form.get('clientName'), projectName: form.get('projectName'), status: form.get('status'), contacts: form.get('contacts'), tags: parseTags(form.get('tags')) });
		throw redirect(303, `/projects/${id}`);
	} catch (cause) {
		if (cause instanceof ProjectError) return fail(cause.code === 'duplicate' ? 409 : 400, { message: cause.message });
		throw cause;
	}
} };
