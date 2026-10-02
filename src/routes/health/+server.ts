import { json } from '@sveltejs/kit';
import { openDatabase, assertDatabaseHealthy } from '$lib/server/db/index.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = () => {
	try {
		const { sqlite, close } = openDatabase();
		try {
			if (!assertDatabaseHealthy(sqlite)) throw new Error('Database health check failed.');
		} finally {
			close();
		}
		return json({ status: 'healthy' });
	} catch {
		return json({ status: 'unhealthy' }, { status: 503 });
	}
};
