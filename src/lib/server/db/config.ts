import path from 'node:path';
import fs from 'node:fs';

export interface DatabaseConfigInput {
	databasePath?: string;
	diskMountPath?: string;
	nodeEnv?: string;
}

export function resolveDatabasePath(input: DatabaseConfigInput = {
	databasePath: process.env.DATABASE_PATH,
	diskMountPath: process.env.PERSISTENT_DISK_MOUNT_PATH,
	nodeEnv: process.env.NODE_ENV
}): string {
	const production = input.nodeEnv === 'production';
	const configuredPath = input.databasePath?.trim();
	if (production && !configuredPath) throw new Error('DATABASE_PATH is required in production.');

	const resolvedPath = path.resolve(configuredPath || './data/recorder.sqlite');
	if (production) {
		if (!path.isAbsolute(configuredPath!)) throw new Error('DATABASE_PATH must be absolute in production.');
		const mount = path.resolve(input.diskMountPath?.trim() || '/var/data');
		const relative = path.relative(mount, resolvedPath);
		if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
			throw new Error('DATABASE_PATH must be a file below PERSISTENT_DISK_MOUNT_PATH.');
		}
	}
	return resolvedPath;
}

export function ensureDatabaseDirectory(
	databasePath: string,
	input: Pick<DatabaseConfigInput, 'diskMountPath' | 'nodeEnv'> = {
		diskMountPath: process.env.PERSISTENT_DISK_MOUNT_PATH,
		nodeEnv: process.env.NODE_ENV
	}
): void {
	const mount = path.resolve(input.diskMountPath?.trim() || '/var/data');
	if (input.nodeEnv === 'production') {
		try {
			if (!fs.statSync(mount).isDirectory()) throw new Error();
		} catch {
			throw new Error('Persistent disk mount is unavailable.');
		}
	}
	fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}
