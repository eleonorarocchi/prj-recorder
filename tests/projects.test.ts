import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyMigrations } from '../src/lib/server/db/migrate.js';
import { createProject, deleteProject, escapeLike, getProject, listProjects, listTagSuggestions, normalizeProjectInput, ProjectError, updateProject } from '../src/lib/server/projects.js';

const tempDirs: string[] = [];
const originalPath = process.env.DATABASE_PATH;
const originalEnv = process.env.NODE_ENV;
function setupDb() {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'recorder-projects-'));
	tempDirs.push(directory);
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_PATH = path.join(directory, 'test.sqlite');
	applyMigrations(process.env.DATABASE_PATH);
	return process.env.DATABASE_PATH;
}
afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	if (originalPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = originalPath;
	if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
});
const input = (patch: Record<string, unknown> = {}) => ({ clientName: ' Acme ', projectName: ' Portal ', status: 'open', contacts: ' team@example.com ', tags: [' web ', 'design'], ...patch });

describe('project service', () => {
	it('creates, reads, updates tags and deletes with cascades', () => {
		const databasePath = setupDb();
		const id = createProject(input());
		const project = getProject(id)!;
		expect(project.client_name).toBe('Acme');
		expect(project.tags).toEqual(['design', 'web']);
		expect(listTagSuggestions()).toEqual(['design', 'web']);
		const sqlite = new DatabaseSync(databasePath);
		sqlite.prepare("UPDATE projects SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(id);
		sqlite.close();
		updateProject(id, input({ projectName: 'Portal 2', status: 'suspended', tags: ['web'] }));
		expect(getProject(id)?.project_name).toBe('Portal 2');
		expect(getProject(id)?.tags).toEqual(['web']);
		expect(getProject(id)?.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
		const dependent = new DatabaseSync(databasePath);
		dependent.prepare('INSERT INTO notes (project_id, body) VALUES (?, ?)').run(id, 'note');
		dependent.close();
		expect(deleteProject(id)).toBe(true);
		expect(getProject(id)).toBeNull();
		const check = new DatabaseSync(databasePath);
		expect(check.prepare('SELECT count(*) AS n FROM notes').get()?.n).toBe(0);
		check.close();
	});

	it('validates and maps uniqueness conflicts', () => {
		setupDb();
		expect(() => normalizeProjectInput(input({ clientName: '  ' }))).toThrow(ProjectError);
		expect(() => normalizeProjectInput(input({ status: 'wrong' }))).toThrow(ProjectError);
		expect(() => normalizeProjectInput(input({ tags: ['A', ' a '] }))).toThrow(/unique/);
		createProject(input());
		expect(() => createProject(input())).toThrowError(expect.objectContaining({ code: 'duplicate' }));
	});

	it('searches both columns with literal wildcards and stable order', () => {
		const databasePath = setupDb();
		const first = createProject(input({ clientName: 'A_100%', projectName: 'First' }));
		const second = createProject(input({ clientName: 'Other', projectName: 'A_100% portal' }));
		createProject(input({ clientName: 'Unrelated', projectName: 'none' }));
		createProject(input({ clientName: 'A-x100x', projectName: 'wildcard decoy' }));
		const sqlite = new DatabaseSync(databasePath);
		sqlite.prepare("UPDATE projects SET updated_at = '2025-01-01T00:00:00.000Z'").run();
		sqlite.close();
		expect(listProjects('a_100%').map((project) => project.id)).toEqual([second, first]);
		expect(escapeLike('%_\\')).toBe('\\%\\_\\\\');
		expect(listProjects('   ').map((project) => project.id)).toEqual([4, 3, 2, 1]);
	});

	it('rejects invalid and missing identifiers', () => {
		setupDb();
		expect(() => getProject(0)).toThrow(ProjectError);
		expect(() => updateProject(-2, input())).toThrow(ProjectError);
		expect(() => updateProject(999, input())).toThrow(/not found/i);
	});
});
