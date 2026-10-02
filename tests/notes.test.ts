import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyMigrations } from '../src/lib/server/db/migrate.js';
import { createProject } from '../src/lib/server/projects.js';
import { createNote, deleteNote, listNotes, NoteError, sanitizeNoteBody, updateNote } from '../src/lib/server/notes.js';
import { actions, load } from '../src/routes/projects/[id]/+page.server.js';

const tempDirs: string[] = [];
const originalPath = process.env.DATABASE_PATH;
const originalEnv = process.env.NODE_ENV;
const originalAllowedUser = process.env.GITHUB_ALLOWED_USER_ID;

function setupDb() {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'recorder-notes-'));
	tempDirs.push(directory);
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_PATH = path.join(directory, 'test.sqlite');
	applyMigrations(process.env.DATABASE_PATH);
	const firstProject = createProject({ clientName: 'Acme', projectName: 'First', status: 'open', contacts: '', tags: [] });
	const secondProject = createProject({ clientName: 'Acme', projectName: 'Second', status: 'open', contacts: '', tags: [] });
	return { databasePath: process.env.DATABASE_PATH, firstProject, secondProject };
}

afterEach(() => {
	for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
	if (originalPath === undefined) delete process.env.DATABASE_PATH;
	else process.env.DATABASE_PATH = originalPath;
	if (originalEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalEnv;
	if (originalAllowedUser === undefined) delete process.env.GITHUB_ALLOWED_USER_ID;
	else process.env.GITHUB_ALLOWED_USER_ID = originalAllowedUser;
});

function routeEvent(projectId: number, formData: FormData, authenticated = true) {
	process.env.GITHUB_ALLOWED_USER_ID = '123';
	return {
		params: { id: String(projectId) },
		url: new URL(`http://localhost/projects/${projectId}`),
		locals: { auth: async () => authenticated ? { user: { id: '123' } } : null },
		request: new Request(`http://localhost/projects/${projectId}`, { method: 'POST', body: formData })
	} as never;
}

describe('note service', () => {
	it('creates, lists, updates and deletes notes with database timestamps', () => {
		const { databasePath, firstProject } = setupDb();
		const firstId = createNote(firstProject, '<p><strong>First</strong> note</p>');
		const secondId = createNote(firstProject, '<p>Second note</p>');
		expect(listNotes(firstProject).map((note) => note.id)).toEqual([secondId, firstId]);
		expect(listNotes(firstProject)[1].body).toContain('<strong>First</strong>');
		expect(listNotes(firstProject)[0].created_at).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);

		const db = new DatabaseSync(databasePath);
		db.prepare("UPDATE notes SET created_at = '2000-01-01T00:00:00.000Z', updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(firstId);
		const originalCreatedAt = String(db.prepare('SELECT created_at FROM notes WHERE id = ?').get(firstId)?.created_at);
		db.close();

		updateNote(firstProject, firstId, '<p>Updated <em>content</em></p>');
		const updated = listNotes(firstProject).find((note) => note.id === firstId)!;
		expect(updated.created_at).toBe(originalCreatedAt);
		expect(updated.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
		expect(updated.body).toContain('<em>content</em>');
		expect(deleteNote(firstProject, secondId)).toBe(true);
		expect(deleteNote(firstProject, secondId)).toBe(false);
	});

	it('uses id descending as a stable tie-breaker and scopes notes to their project', () => {
		const { databasePath, firstProject, secondProject } = setupDb();
		const earlierId = createNote(firstProject, '<p>Earlier id</p>');
		const laterId = createNote(firstProject, '<p>Later id</p>');
		const db = new DatabaseSync(databasePath);
		db.prepare("UPDATE notes SET created_at = '2025-01-01T00:00:00.000Z' WHERE id IN (?, ?)").run(earlierId, laterId);
		db.close();
		expect(listNotes(firstProject).map((note) => note.id)).toEqual([laterId, earlierId]);
		expect(listNotes(secondProject)).toEqual([]);
		expect(() => updateNote(secondProject, earlierId, '<p>Cross-project</p>')).toThrowError(expect.objectContaining({ code: 'not_found' }));
		expect(deleteNote(secondProject, earlierId)).toBe(false);
	});

	it('rejects malformed IDs, invalid input and notes for missing projects', () => {
		setupDb();
		expect(() => listNotes(0)).toThrow(NoteError);
		expect(() => updateNote(1, Number.MAX_SAFE_INTEGER + 1, '<p>Valid</p>')).toThrow(NoteError);
		expect(() => createNote(999, '<p>Missing project</p>')).toThrowError(expect.objectContaining({ code: 'not_found' }));
		expect(() => createNote(1, null)).toThrow(NoteError);
		expect(() => createNote(1, '<p><br></p>')).toThrow(/required/);
		expect(() => createNote(1, 'x'.repeat(50_001))).toThrow(/50,000/);
		expect(() => updateNote(1, 999, '<p>Missing note</p>')).toThrowError(expect.objectContaining({ code: 'not_found' }));
	});

	it('keeps supported formatting and removes active or unapproved HTML', () => {
		const clean = sanitizeNoteBody('<p class="x" onclick="alert(1)"><strong>Safe</strong> <em>text</em></p><script>alert(1)</script><a href="javascript:alert(2)" target="_blank">bad link</a><a href="https://example.com">good link</a><svg><script>alert(3)</script></svg>');
		expect(clean).toContain('<strong>Safe</strong>');
		expect(clean).toContain('<em>text</em>');
		expect(clean).toContain('href="https://example.com"');
		expect(clean).not.toMatch(/onclick|javascript:|target=|<script|<svg|class=/i);
		expect(() => sanitizeNoteBody('<math><mtext> </mtext></math>')).toThrow(/required/);
		expect(sanitizeNoteBody('<a href="//evil.example">link</a>')).not.toContain('href=');
	});

	it('loads notes and handles authorized create, update and delete actions', async () => {
		const { firstProject } = setupDb();
		const loaded = await load(routeEvent(firstProject, new FormData()) as never);
		expect((loaded as { notes: unknown[] }).notes).toEqual([]);

		const createForm = new FormData();
		createForm.set('body', '<p>Created from action</p>');
		await expect(actions.noteCreate!(routeEvent(firstProject, createForm) as never)).rejects.toMatchObject({ status: 303, location: `/projects/${firstProject}?noteStatus=created#notes` });
		const note = listNotes(firstProject)[0];
		expect(note.body).toContain('Created from action');

		const updateForm = new FormData();
		updateForm.set('noteId', String(note.id));
		updateForm.set('body', '<p>Updated from action</p>');
		await expect(actions.noteUpdate!(routeEvent(firstProject, updateForm) as never)).rejects.toMatchObject({ status: 303, location: `/projects/${firstProject}?noteStatus=updated#notes` });
		expect(listNotes(firstProject)[0].body).toContain('Updated from action');

		const deleteForm = new FormData();
		deleteForm.set('noteId', String(note.id));
		await expect(actions.noteDelete!(routeEvent(firstProject, deleteForm) as never)).rejects.toMatchObject({ status: 303, location: `/projects/${firstProject}?noteStatus=deleted#notes` });
		expect(listNotes(firstProject)).toEqual([]);
	});

	it('blocks anonymous page loads and note actions before database access', async () => {
		const previousPath = process.env.DATABASE_PATH;
		process.env.DATABASE_PATH = process.cwd();
		const body = new FormData();
		body.set('body', '<p>Must not be saved</p>');
		try {
			await expect(load(routeEvent(1, body, false) as never)).rejects.toMatchObject({ status: 303, location: '/login?returnTo=%2Fprojects%2F1' });
			await expect(actions.noteCreate!(routeEvent(1, body, false) as never)).rejects.toMatchObject({ status: 303 });
		} finally {
			if (previousPath === undefined) delete process.env.DATABASE_PATH;
			else process.env.DATABASE_PATH = previousPath;
		}
	});
});
