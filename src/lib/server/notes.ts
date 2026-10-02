import sanitizeHtml from 'sanitize-html';
import { openDatabase } from '$lib/server/db/index.js';
import type { DatabaseSync } from 'node:sqlite';

const MAX_NOTE_LENGTH = 50_000;
const NOTE_HTML_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
	allowedAttributes: { a: ['href'] },
	allowedSchemes: ['http', 'https', 'mailto'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard'
};

export type Note = {
	id: number;
	project_id: number;
	body: string;
	created_at: string;
	updated_at: string;
};

export class NoteError extends Error {
	constructor(public code: 'invalid' | 'not_found', message: string) {
		super(message);
		this.name = 'NoteError';
	}
}

function assertId(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new NoteError('invalid', `Invalid ${name}.`);
	}
}

function hasVisibleText(html: string): boolean {
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').trim().length > 0;
}

function sanitizeHtmlBody(value: string): string {
	return sanitizeHtml(value, NOTE_HTML_OPTIONS).trim();
}

export function sanitizeNoteBody(value: unknown): string {
	if (typeof value !== 'string') throw new NoteError('invalid', 'Note content must be text.');
	if (value.length > MAX_NOTE_LENGTH) throw new NoteError('invalid', `Note content must be at most ${MAX_NOTE_LENGTH.toLocaleString('en-US')} characters.`);
	const clean = sanitizeHtmlBody(value);
	if (!hasVisibleText(clean)) throw new NoteError('invalid', 'Note content is required.');
	return clean;
}

function asNote(row: Record<string, unknown>): Note {
	return {
		id: Number(row.id),
		project_id: Number(row.project_id),
		body: sanitizeHtmlBody(String(row.body)),
		created_at: String(row.created_at),
		updated_at: String(row.updated_at)
	};
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
	const { sqlite, close } = openDatabase();
	try {
		return fn(sqlite);
	} finally {
		close();
	}
}

function assertProjectExists(db: DatabaseSync, projectId: number): void {
	if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) {
		throw new NoteError('not_found', 'Project not found.');
	}
}

export function listNotes(projectId: number): Note[] {
	assertId(projectId, 'project id');
	return withDb((db) => {
		assertProjectExists(db, projectId);
		const rows = db.prepare('SELECT * FROM notes WHERE project_id = ? ORDER BY created_at DESC, id DESC').all(projectId) as Array<Record<string, unknown>>;
		return rows.map(asNote);
	});
}

export function createNote(projectId: number, body: unknown): number {
	assertId(projectId, 'project id');
	const cleanBody = sanitizeNoteBody(body);
	return withDb((db) => {
		assertProjectExists(db, projectId);
		const result = db.prepare('INSERT INTO notes (project_id, body) VALUES (?, ?)').run(projectId, cleanBody);
		return Number(result.lastInsertRowid);
	});
}

export function updateNote(projectId: number, noteId: number, body: unknown): void {
	assertId(projectId, 'project id');
	assertId(noteId, 'note id');
	const cleanBody = sanitizeNoteBody(body);
	withDb((db) => {
		const result = db.prepare("UPDATE notes SET body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND id = ?").run(cleanBody, projectId, noteId);
		if (Number(result.changes) === 0) throw new NoteError('not_found', 'Note not found.');
	});
}

export function deleteNote(projectId: number, noteId: number): boolean {
	assertId(projectId, 'project id');
	assertId(noteId, 'note id');
	return withDb((db) => Number(db.prepare('DELETE FROM notes WHERE project_id = ? AND id = ?').run(projectId, noteId).changes) > 0);
}
