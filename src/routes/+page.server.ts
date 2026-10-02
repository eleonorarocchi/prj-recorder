import { fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard.js';
import { createProject, deleteProject, listProjects, listTagSuggestions, ProjectError } from '$lib/server/projects.js';
import type { Actions, PageServerLoad } from './$types.js';
const parseTags = (value: FormDataEntryValue | null) => String(value ?? '').split(/[\n,]/).filter((tag) => tag.trim());

export const load: PageServerLoad = async (event) => {
	await requireUser(event);
	const query = event.url.searchParams.get('q')?.slice(0, 200) ?? '';
	return { projects: listProjects(query), suggestions: listTagSuggestions(), query, user: (await event.locals.auth())?.user ?? null };
};

export const actions: Actions = {
	create: async (event) => {
		await requireUser(event);
		const form = await event.request.formData();
		try {
			const id = createProject({ clientName: form.get('clientName'), projectName: form.get('projectName'), status: form.get('status'), contacts: form.get('contacts'), tags: parseTags(form.get('tags')) });
			throw redirect(303, `/projects/${id}`);
		} catch (cause) {
			if (cause instanceof ProjectError) return fail(cause.code === 'duplicate' ? 409 : 400, { message: cause.message });
			throw cause;
}
	},
	delete: async (event) => {
		await requireUser(event);
		const id = Number((await event.request.formData()).get('id'));
		try {
			if (!deleteProject(id)) return fail(404, { message: 'Project not found.' });
			return { deleted: true };
		} catch (cause) {
			if (cause instanceof ProjectError) return fail(400, { message: cause.message });
			throw cause;
		}
	}
};
