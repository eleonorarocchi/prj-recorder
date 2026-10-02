import { chmodSync, closeSync, existsSync, openSync, realpathSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';
import 'dotenv/config';
import { resolveDatabasePath } from '../src/lib/server/db/config.js';

function isWithin(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function backupDatabase(databasePath: string, destinationPath: string): Promise<string> {
	const source = path.resolve(databasePath);
	const destination = path.resolve(destinationPath);
	if (source === destination) throw new Error('Backup destination must differ from the database.');
	if (!path.isAbsolute(destinationPath)) throw new Error('Backup destination must be an absolute path.');
	if (existsSync(destination)) throw new Error('Backup destination already exists.');
	if (!existsSync(source) || !statSync(source).isFile()) throw new Error('Source database file is unavailable.');

	const projectRoot = realpathSync(process.cwd());
	const destinationDirectory = realpathSync(path.dirname(destination));
	const realDestination = path.join(destinationDirectory, path.basename(destination));
	if (isWithin(projectRoot, realDestination)) throw new Error('Backup destination must be outside the project directory.');
	if (process.env.NODE_ENV === 'production') {
		const mount = path.resolve(process.env.PERSISTENT_DISK_MOUNT_PATH?.trim() || '/var/data');
		if (isWithin(mount, realDestination)) throw new Error('Production backup destination must be outside the persistent disk.');
	}

	let created = false;
	const sourceDb = new DatabaseSync(source, { readOnly: true });
	try {
		const reservation = openSync(realDestination, 'wx', 0o600);
		closeSync(reservation);
		created = true;
		await backup(sourceDb, realDestination);
		chmodSync(realDestination, 0o600);
		const backupDb = new DatabaseSync(realDestination, { readOnly: true });
		try {
			const integrity = backupDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined;
			if (integrity?.integrity_check !== 'ok') throw new Error('SQLite integrity check failed for backup.');
			const foreignKeyErrors = backupDb.prepare('PRAGMA foreign_key_check').all();
			if (foreignKeyErrors.length > 0) throw new Error('SQLite foreign key check failed for backup.');
			const tables = backupDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
			const tableNames = new Set(tables.map((row) => row.name));
			for (const required of ['__app_migrations', 'projects', 'notes', 'tags', 'project_tags']) {
				if (!tableNames.has(required)) throw new Error('Backup is missing an expected application table.');
			}
		} finally {
			backupDb.close();
		}
		return realDestination;
	} catch (error) {
		if (created) rmSync(realDestination, { force: true });
		throw error;
	} finally {
		sourceDb.close();
	}
}

async function main(): Promise<void> {
	const destination = process.argv[2];
	if (!destination) throw new Error('Usage: npm run db:backup -- <absolute-destination.sqlite>');
	const source = resolveDatabasePath();
	const created = await backupDatabase(source, destination);
	console.log(`SQLite backup created and verified: ${created}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'SQLite backup failed.');
		process.exitCode = 1;
	});
}
