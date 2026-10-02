import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDatabaseDirectory, resolveDatabasePath } from '../src/lib/server/db/config.js';
import { assertDatabaseHealthy } from '../src/lib/server/db/index.js';
import { applyMigrations } from '../src/lib/server/db/migrate.js';
import { GET as healthGet } from '../src/routes/health/+server.js';

const tempDirs: string[] = [];
afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createMigratedDb() {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'recorder-test-'));
	tempDirs.push(dir);
	const sqlite = new DatabaseSync(path.join(dir, 'test.sqlite'));
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyMigrations(path.join(dir, 'test.sqlite'));
	sqlite.close();
	const migrated = new DatabaseSync(path.join(dir, 'test.sqlite'));
	migrated.exec('PRAGMA foreign_keys = ON');
	return { sqlite: migrated, databasePath: path.join(dir, 'test.sqlite') };
}

describe('SQLite foundation', () => {
	it('migrates idempotently, enforces unique/status and cascades dependent rows', () => {
		const { sqlite, databasePath } = createMigratedDb();
		applyMigrations(databasePath);
		sqlite.prepare("INSERT INTO projects (client_name, project_name, status) VALUES (?, ?, ?)").run('Acme', 'Portal', 'open');
		const projectId = Number(sqlite.prepare('SELECT id FROM projects').get()?.id);
		sqlite.prepare('INSERT INTO notes (project_id, body) VALUES (?, ?)').run(projectId, 'Update');
		sqlite.prepare("INSERT INTO tags (name) VALUES ('web')").run();
		const tagId = Number(sqlite.prepare('SELECT id FROM tags').get()?.id);
		sqlite.prepare('INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(projectId, tagId);
		expect(() => sqlite.prepare('INSERT INTO projects (client_name, project_name) VALUES (?, ?)').run('Acme', 'Portal')).toThrow();
		expect(() => sqlite.prepare("INSERT INTO projects (client_name, project_name, status) VALUES ('A', 'B', 'invalid')").run()).toThrow();
		sqlite.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
		expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()?.n).toBe(0);
		expect(sqlite.prepare('SELECT count(*) AS n FROM project_tags').get()?.n).toBe(0);
		expect(assertDatabaseHealthy(sqlite)).toBe(true);
		sqlite.close();
	});

	it('requires an absolute production database path below the persistent mount', () => {
		expect(() => resolveDatabasePath({ nodeEnv: 'production' })).toThrow(/DATABASE_PATH is required/);
		const mount = path.join(os.tmpdir(), 'recorder-mount');
		expect(() => resolveDatabasePath({ nodeEnv: 'production', databasePath: path.join(os.tmpdir(), 'outside.sqlite'), diskMountPath: mount })).toThrow(/below PERSISTENT/);
		const databasePath = path.join(mount, 'recorder.sqlite');
		expect(resolveDatabasePath({ nodeEnv: 'production', databasePath, diskMountPath: mount })).toBe(databasePath);
		const absentMount = path.join(os.tmpdir(), `recorder-missing-${Date.now()}`);
		expect(() => ensureDatabaseDirectory(path.join(absentMount, 'recorder.sqlite'), { nodeEnv: 'production', diskMountPath: absentMount })).toThrow(/Persistent disk mount is unavailable/);
	});

	it('health endpoint checks SQLite and does not expose connection errors', async () => {
		const dir = mkdtempSync(path.join(os.tmpdir(), 'recorder-health-'));
		tempDirs.push(dir);
		const previousPath = process.env.DATABASE_PATH;
		const previousEnvironment = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = 'test';
			process.env.DATABASE_PATH = path.join(dir, 'healthy.sqlite');
			applyMigrations(process.env.DATABASE_PATH);
			const healthy = await healthGet({} as never);
			expect(healthy.status).toBe(200);
			expect(await healthy.json()).toEqual({ status: 'healthy' });

			process.env.DATABASE_PATH = dir;
			const unhealthy = await healthGet({} as never);
			expect(unhealthy.status).toBe(503);
			expect(await unhealthy.json()).toEqual({ status: 'unhealthy' });
		} finally {
			if (previousPath === undefined) delete process.env.DATABASE_PATH;
			else process.env.DATABASE_PATH = previousPath;
			if (previousEnvironment === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = previousEnvironment;
		}
	});
});
