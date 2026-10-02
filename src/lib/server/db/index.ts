import { DatabaseSync } from 'node:sqlite';
import { ensureDatabaseDirectory, resolveDatabasePath } from './config.js';

export function openDatabase(databasePath = resolveDatabasePath()) {
	ensureDatabaseDirectory(databasePath);
	const sqlite = new DatabaseSync(databasePath);
	sqlite.exec('PRAGMA foreign_keys = ON');
	return { sqlite, close: () => sqlite.close() };
}

export function assertDatabaseHealthy(database: DatabaseSync): boolean {
	return database.prepare('SELECT 1').get() !== undefined;
}
