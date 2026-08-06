import { createPostgresDatabase } from './database.js';
import { runMigrations } from './migrator.js';

const database = createPostgresDatabase({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true',
  applicationName: 'sg-2-1-migrator'
});

try {
  await database.start();
  const result = await runMigrations(database);
  process.stdout.write(`${JSON.stringify({ status: 'migrations-complete', ...result })}\n`);
} finally {
  await database.close();
}
