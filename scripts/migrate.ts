import 'dotenv/config';
import { resolveDatabasePath } from '../src/lib/server/db/config.js';
import { applyMigrations } from '../src/lib/server/db/migrate.js';

applyMigrations(resolveDatabasePath());
