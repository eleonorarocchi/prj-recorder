import { error, fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard.js';
import { deleteProject, getProject, listTagSuggestions, ProjectError, updateProject } from '$lib/server/projects.js';
import { createNote, deleteNote, listNotes, NoteError, updateNote } from '$lib/server/notes.js';
import type { Actions, PageServerLoad } from './$types.js';
const parseTags = (value: FormDataEntryValue | null) => String(value ?? '').split(/[\n,]/).filter((tag) => tag.trim());
function routeId(value: string): number {
	if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw error(400, 'Invalid project id.');
	return Number(value);
}
export const load: PageServerLoad = async (event) => {
	await requireUser(event);
	const id = routeId(event.params.id);
	const project = getProject(id);
	if (!project) throw error(404, 'Project not found.');
	const noteStatus = event.url.searchParams.get('noteStatus');
	return { project, suggestions: listTagSuggestions(), notes: listNotes(id), noteStatus: ['created', 'updated', 'deleted'].includes(noteStatus ?? '') ? noteStatus : null };
};
export const actions: Actions = {
	update: async (event) => {
		await requireUser(event);
		const id = routeId(event.params.id);
		const form = await event.request.formData();
		try {
			updateProject(id, { clientName: form.get('clientName'), projectName: form.get('projectName'), status: form.get('status'), contacts: form.get('contacts'), tags: parseTags(form.get('tags')) });
			throw redirect(303, `/projects/${id}`);
		} catch (cause) {
			if (cause instanceof ProjectError) return fail(cause.code === 'duplicate' ? 409 : cause.code === 'not_found' ? 404 : 400, { message: cause.message });
			throw cause;
		}
	},
	delete: async (event) => {
		await requireUser(event);
		const id = routeId(event.params.id);
		if (!deleteProject(id)) throw error(404, 'Project not found.');
		throw redirect(303, '/');
	},
	noteCreate: async (event) => {
		await requireUser(event);
		const projectId = routeId(event.params.id);
		const body = (await event.request.formData()).get('body');
		try {
			createNote(projectId, body);
			throw redirect(303, `/projects/${projectId}?noteStatus=created#notes`);
		} catch (cause) {
			if (cause instanceof NoteError) return fail(cause.code === 'not_found' ? 404 : 400, { noteMessage: cause.message, noteBody: typeof body === 'string' ? body : '' });
			throw cause;
		}
	},
	noteUpdate: async (event) => {
		await requireUser(event);
		const projectId = routeId(event.params.id);
		const form = await event.request.formData();
		const noteIdValue = form.get('noteId');
		const noteId = typeof noteIdValue === 'string' && /^\d+$/.test(noteIdValue) ? Number(noteIdValue) : 0;
		const body = form.get('body');
		try {
			updateNote(projectId, noteId, body);
			throw redirect(303, `/projects/${projectId}?noteStatus=updated#notes`);
		} catch (cause) {
			if (cause instanceof NoteError) return fail(cause.code === 'not_found' ? 404 : 400, { noteMessage: cause.message, noteBody: typeof body === 'string' ? body : '', noteId: noteIdValue });
			throw cause;
		}
	},
	noteDelete: async (event) => {
		await requireUser(event);
		const projectId = routeId(event.params.id);
		const noteIdValue = (await event.request.formData()).get('noteId');
		const noteId = typeof noteIdValue === 'string' && /^\d+$/.test(noteIdValue) ? Number(noteIdValue) : 0;
		try {
			if (!deleteNote(projectId, noteId)) throw new NoteError('not_found', 'Note not found.');
			throw redirect(303, `/projects/${projectId}?noteStatus=deleted#notes`);
		} catch (cause) {
			if (cause instanceof NoteError) return fail(cause.code === 'not_found' ? 404 : 400, { noteMessage: cause.message, noteId: noteIdValue });
			throw cause;
		}
	}
};
