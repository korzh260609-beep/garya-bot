import { createPostgresDatabase } from '../persistence/database.js';
import { runMigrations } from '../persistence/migrator.js';
import { createRenderWebApplication } from './renderWebApplication.js';
import { createProductionHarnessWithPDK4 } from './productionHarnessWithPDK4.js';

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

async function runLegacyCompatibleBootMigrations(env = process.env) {
  if (!truthy(env.RUN_MIGRATIONS_ON_BOOT)) return null;
  const connectionString = String(env.DATABASE_URL ?? '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is required when RUN_MIGRATIONS_ON_BOOT is enabled');

  const database = createPostgresDatabase({
    connectionString,
    ssl: String(env.DATABASE_SSL ?? '').trim().toLowerCase() === 'true',
    applicationName: 'sg-2-1-render-boot-migrator'
  });

  try {
    await database.start();
    const result = await runMigrations(database);
    process.stdout.write(`${JSON.stringify({ status: 'render-boot-migrations-complete', applied: result.applied.length, total: result.total })}\n`);
    return result;
  } finally {
    await database.close();
  }
}

await runLegacyCompatibleBootMigrations();

const application = await createRenderWebApplication({ harnessFactory: createProductionHarnessWithPDK4 });
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  try {
    await application.stop();
    process.stdout.write(`${JSON.stringify({ status: 'render-web-stopped', signal })}\n`);
  } catch (error) {
    console.error('render web shutdown failed', error?.message ?? 'unknown');
    process.exitCode = 1;
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(process.exitCode ?? 0)));
process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(process.exitCode ?? 0)));

const started = await application.start();
process.stdout.write(`${JSON.stringify({ status: 'render-web-ready', ...started })}\n`);
