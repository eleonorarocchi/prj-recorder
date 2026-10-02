import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupDatabase } from '../scripts/backup.js';
import { applyMigrations } from '../src/lib/server/db/migrate.js';
import { createProject } from '../src/lib/server/projects.js';
import { createNote } from '../src/lib/server/notes.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createDatabase(): { directory: string; source: string; projectId: number } {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'recorder-backup-'));
	temporaryDirectories.push(directory);
	const source = path.join(directory, 'source.sqlite');
	applyMigrations(source);
	const previousPath = process.env.DATABASE_PATH;
	const previousEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_PATH = source;
	try {
		const projectId = createProject({ clientName: 'Backup fixture', projectName: 'Recovery check', status: 'open', contacts: '', tags: ['release'] });
		createNote(projectId, '<p>Restore fixture</p>');
		return { directory, source, projectId };
	} finally {
		if (previousPath === undefined) delete process.env.DATABASE_PATH;
		else process.env.DATABASE_PATH = previousPath;
		if (previousEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = previousEnv;
	}
}

describe('SQLite backup command', () => {
	it('creates a consistent backup that restores application data and migration history', async () => {
		const { directory, source, projectId } = createDatabase();
		const destination = path.join(directory, 'verified.sqlite');
		await expect(backupDatabase(source, destination)).resolves.toBe(destination);

		const restored = new DatabaseSync(destination);
		try {
			expect(restored.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
			expect(restored.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
			expect(restored.prepare('SELECT client_name, project_name FROM projects WHERE id = ?').get(projectId)).toEqual({ client_name: 'Backup fixture', project_name: 'Recovery check' });
			expect(restored.prepare('SELECT body FROM notes WHERE project_id = ?').get(projectId)).toEqual({ body: '<p>Restore fixture</p>' });
			expect(restored.prepare('SELECT id FROM __app_migrations').all()).toHaveLength(1);
		} finally {
			restored.close();
		}
	});

	it('rejects relative, existing, source-equal and in-project destinations', async () => {
		const { directory, source } = createDatabase();
		const existing = path.join(directory, 'existing.sqlite');
		new DatabaseSync(existing).close();
		await expect(backupDatabase(source, 'relative.sqlite')).rejects.toThrow(/absolute/);
		await expect(backupDatabase(source, existing)).rejects.toThrow(/already exists/);
		await expect(backupDatabase(source, source)).rejects.toThrow(/differ/);
		await expect(backupDatabase(source, path.join(process.cwd(), 'unsafe.sqlite'))).rejects.toThrow(/outside the project/);
	});

	it('rejects destinations on the production persistent disk', async () => {
		const { source } = createDatabase();
		const previousEnv = process.env.NODE_ENV;
		const previousMount = process.env.PERSISTENT_DISK_MOUNT_PATH;
		process.env.NODE_ENV = 'production';
		process.env.PERSISTENT_DISK_MOUNT_PATH = path.parse(source).root;
		try {
			await expect(backupDatabase(source, path.join(path.parse(source).root, 'unsafe-backup.sqlite'))).rejects.toThrow(/outside the persistent disk/);
		} finally {
			if (previousEnv === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = previousEnv;
			if (previousMount === undefined) delete process.env.PERSISTENT_DISK_MOUNT_PATH;
			else process.env.PERSISTENT_DISK_MOUNT_PATH = previousMount;
		}
	});
});
