import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDatabaseDirectory } from './config.js';

export function applyMigrations(databasePath: string, migrationsFolder = './drizzle'): void {
	ensureDatabaseDirectory(databasePath);
	const sqlite = new DatabaseSync(databasePath);
	sqlite.exec('PRAGMA foreign_keys = ON');
	try {
		sqlite.exec(`CREATE TABLE IF NOT EXISTS __app_migrations (
			id TEXT PRIMARY KEY NOT NULL,
			hash TEXT NOT NULL,
			applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		)`);
		const select = sqlite.prepare('SELECT hash FROM __app_migrations WHERE id = ?');
		const insert = sqlite.prepare('INSERT INTO __app_migrations (id, hash) VALUES (?, ?)');
		const migrationFiles = fs.readdirSync(migrationsFolder)
			.filter((file) => /^\d+_.+\.sql$/.test(file))
			.sort();
		for (const file of migrationFiles) {
			const sql = fs.readFileSync(path.join(migrationsFolder, file), 'utf8');
			const hash = createHash('sha256').update(sql).digest('hex');
			const previous = select.get(file) as { hash: string } | undefined;
			if (previous) {
				if (previous.hash !== hash) throw new Error(`Applied migration ${file} has changed.`);
				continue;
			}
			sqlite.exec('BEGIN IMMEDIATE');
			try {
				sqlite.exec(sql);
				insert.run(file, hash);
				sqlite.exec('COMMIT');
			} catch (error) {
				sqlite.exec('ROLLBACK');
				throw error;
			}
		}
	} finally {
		sqlite.close();
	}
}
