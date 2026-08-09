import { createPostgresDatabase } from '../persistence/database.js';
import { runMigrations } from '../persistence/migrator.js';
import { createPostgresDiagnosticStore } from './postgresDiagnosticStore.js';
import { createObservabilityEvidenceSource, createDeploymentEvidenceSource, createInfrastructureEvidenceSource } from './sourceAdapters.js';
import { createDiagnosticService } from './diagnosticService.js';
import { createDiagnosticsHttpServer } from './httpServer.js';
import { createHttpHealthProbe, createLiveDiagnosticRunner } from './liveRunner.js';

function truthy(value) { return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase()); }
function required(value, name) { const normalized = String(value ?? '').trim(); if (!normalized) throw new Error(`${name} is required`); return normalized; }

const env = process.env;
const database = createPostgresDatabase({
  connectionString: required(env.DATABASE_URL, 'DATABASE_URL'),
  ssl: truthy(env.DATABASE_SSL),
  applicationName: 'sg-2-1-diagnostics',
  max: Number(env.DIAGNOSTICS_DB_POOL_MAX ?? 4),
  connectionTimeoutMillis: Number(env.DIAGNOSTICS_DB_CONNECT_TIMEOUT_MS ?? 5000)
});

await database.start();
if (truthy(env.RUN_DIAGNOSTICS_MIGRATIONS_ON_BOOT)) await runMigrations(database);

const store = createPostgresDiagnosticStore({ database });
const observabilitySource = createObservabilityEvidenceSource({ database });
const infrastructureSource = createInfrastructureEvidenceSource({ database });
const deploymentSource = createDeploymentEvidenceSource({
  repository: env.DIAGNOSTICS_GITHUB_REPOSITORY ?? 'korzh260609-beep/garya-bot',
  branch: env.DIAGNOSTICS_GITHUB_BRANCH ?? 'dev/sg2.1-semantic',
  githubToken: env.DIAGNOSTICS_GITHUB_TOKEN ?? null,
  runtimeHealthUrl: env.DIAGNOSTICS_SG_HEALTH_URL ?? null,
  workerHealthUrl: env.DIAGNOSTICS_WORKER_HEALTH_URL ?? null,
  expectedRevision: env.DIAGNOSTICS_EXPECTED_REVISION ?? null
});

const probes = [];
if (env.DIAGNOSTICS_SG_HEALTH_URL) probes.push(createHttpHealthProbe({ id: 'sg-web-health', url: env.DIAGNOSTICS_SG_HEALTH_URL }));
if (env.DIAGNOSTICS_WORKER_HEALTH_URL) probes.push(createHttpHealthProbe({ id: 'sg-worker-health', url: env.DIAGNOSTICS_WORKER_HEALTH_URL }));
const liveRunner = createLiveDiagnosticRunner({ probes });

const revision = env.SG_REVISION ?? env.RENDER_GIT_COMMIT ?? 'unknown';
const environment = env.SG_ENVIRONMENT ?? env.NODE_ENV ?? 'production';
const service = createDiagnosticService({ store, observabilitySource, deploymentSource, infrastructureSource, liveRunner, environment, revision });
const httpServer = createDiagnosticsHttpServer({
  service, store,
  host: env.DIAGNOSTICS_HOST ?? '0.0.0.0',
  port: Number(env.PORT ?? env.DIAGNOSTICS_PORT ?? 8790),
  adminToken: required(env.DIAGNOSTICS_ADMIN_TOKEN, 'DIAGNOSTICS_ADMIN_TOKEN'),
  monarchGlobalUserId: required(env.SG_MONARCH_GLOBAL_USER_ID ?? env.MONARCH_GLOBAL_USER_ID, 'SG_MONARCH_GLOBAL_USER_ID/MONARCH_GLOBAL_USER_ID'),
  environment, revision
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  try { await httpServer.stop(); } finally { await database.close(); }
  process.stdout.write(`${JSON.stringify({ status: 'sg-diagnostics-stopped', signal })}\n`);
}

process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)));
process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));

const address = await httpServer.start();
process.stdout.write(`${JSON.stringify({ status: 'sg-diagnostics-ready', ...address, environment, revision, probes: liveRunner.list() })}\n`);
