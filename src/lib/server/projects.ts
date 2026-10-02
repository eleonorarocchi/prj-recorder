import { openDatabase } from '$lib/server/db/index.js';
import type { DatabaseSync } from 'node:sqlite';

export const projectStatuses = ['open', 'suspended', 'closed'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectInput = { clientName: unknown; projectName: unknown; status: unknown; contacts: unknown; tags: unknown };
export type Project = {
	id: number; client_name: string; project_name: string; status: ProjectStatus; contacts: string | null;
	created_at: string; updated_at: string; tags: string[];
};
export class ProjectError extends Error {
	constructor(public code: 'invalid' | 'not_found' | 'duplicate', message: string) { super(message); }
}

const textField = (value: unknown, name: string, required: boolean, max: number): string | null => {
	if (value === null || value === undefined) {
		if (required) throw new ProjectError('invalid', `${name} is required.`);
		return null;
	}
	if (typeof value !== 'string') throw new ProjectError('invalid', `${name} must be text.`);
	const normalized = value.trim();
	if (!normalized && required) throw new ProjectError('invalid', `${name} is required.`);
	if (normalized.length > max) throw new ProjectError('invalid', `${name} must be at most ${max} characters.`);
	return normalized || null;
};

export function normalizeProjectInput(input: ProjectInput) {
	const clientName = textField(input.clientName, 'Client', true, 200)!;
	const projectName = textField(input.projectName, 'Project', true, 200)!;
	const status = input.status;
	if (typeof status !== 'string' || !projectStatuses.includes(status as ProjectStatus)) throw new ProjectError('invalid', 'Choose a valid status.');
	const contacts = textField(input.contacts, 'Contacts', false, 4000);
	if (!Array.isArray(input.tags) || input.tags.length > 30) throw new ProjectError('invalid', 'Provide at most 30 tags.');
	const tags = input.tags.map((tag) => textField(tag, 'Tag', true, 50)!);
	if (new Set(tags.map((tag) => tag.toLocaleLowerCase('en-US'))).size !== tags.length) throw new ProjectError('invalid', 'Tags must be unique.');
	return { clientName, projectName, status: status as ProjectStatus, contacts, tags };
}

export function escapeLike(value: string): string { return value.replace(/[\\%_]/g, '\\$&'); }
function asProject(row: Record<string, unknown>, tags: string[]): Project {
	return { id: Number(row.id), client_name: String(row.client_name), project_name: String(row.project_name), status: row.status as ProjectStatus,
		contacts: row.contacts === null ? null : String(row.contacts), created_at: String(row.created_at), updated_at: String(row.updated_at), tags };
}
function tagNames(db: DatabaseSync, projectId: number): string[] {
	return (db.prepare('SELECT t.name FROM tags t JOIN project_tags pt ON pt.tag_id = t.id WHERE pt.project_id = ? ORDER BY t.name COLLATE NOCASE').all(projectId) as Array<{ name: string }>).map((row) => row.name);
}
function mapSqlite(error: unknown): never {
	if (error instanceof Error && /projects_client_project_unique|UNIQUE constraint failed: projects\.client_name/.test(error.message)) throw new ProjectError('duplicate', 'A project with this client and project name already exists.');
	throw error;
}
function withDb<T>(fn: (db: DatabaseSync) => T): T {
	const { sqlite, close } = openDatabase();
	try { return fn(sqlite); } finally { close(); }
}

export function listProjects(query = ''): Project[] {
	return withDb((db) => {
		const needle = query.trim();
		const rows = (needle
			? db.prepare("SELECT * FROM projects WHERE client_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR project_name LIKE ? ESCAPE '\\' COLLATE NOCASE ORDER BY updated_at DESC, id DESC").all(`%${escapeLike(needle)}%`, `%${escapeLike(needle)}%`)
			: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC, id DESC').all()) as Array<Record<string, unknown>>;
		return rows.map((row) => asProject(row, tagNames(db, Number(row.id))));
	});
}

export function getProject(id: number): Project | null {
	if (!Number.isInteger(id) || id < 1) throw new ProjectError('invalid', 'Invalid project id.');
	return withDb((db) => {
		const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
		return row ? asProject(row, tagNames(db, id)) : null;
	});
}

function writeTags(db: DatabaseSync, projectId: number, names: string[]) {
	db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(projectId);
	for (const name of names) {
		db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(name);
		const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
		db.prepare('INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(projectId, tag.id);
	}
}

export function createProject(input: ProjectInput): number {
	const data = normalizeProjectInput(input);
	try {
		return withDb((db) => {
			db.exec('BEGIN');
			try {
				const result = db.prepare('INSERT INTO projects (client_name, project_name, status, contacts) VALUES (?, ?, ?, ?)').run(data.clientName, data.projectName, data.status, data.contacts);
				const id = Number(result.lastInsertRowid);
				writeTags(db, id, data.tags);
				db.exec('COMMIT');
				return id;
			} catch (error) { db.exec('ROLLBACK'); throw error; }
		});
	} catch (error) { return mapSqlite(error); }
}

export function updateProject(id: number, input: ProjectInput): void {
	if (!Number.isInteger(id) || id < 1) throw new ProjectError('invalid', 'Invalid project id.');
	const data = normalizeProjectInput(input);
	try {
		withDb((db) => {
			db.exec('BEGIN');
			try {
				const result = db.prepare("UPDATE projects SET client_name = ?, project_name = ?, status = ?, contacts = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(data.clientName, data.projectName, data.status, data.contacts, id);
				if (Number(result.changes) === 0) throw new ProjectError('not_found', 'Project not found.');
				writeTags(db, id, data.tags);
				db.exec('COMMIT');
			} catch (error) { db.exec('ROLLBACK'); throw error; }
		});
	} catch (error) { return mapSqlite(error); }
}

export function deleteProject(id: number): boolean {
	if (!Number.isInteger(id) || id < 1) throw new ProjectError('invalid', 'Invalid project id.');
	return withDb((db) => Number(db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes) > 0);
}

export function listTagSuggestions(): string[] {
	return withDb((db) => (db.prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE LIMIT 100').all() as Array<{ name: string }>).map((row) => row.name));
}
