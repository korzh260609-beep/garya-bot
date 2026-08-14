import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresProjectMemoryStore } from '../src/projectMemory/index.js';
import { createPostgresDevelopmentKnowledgeSingleFlight, createProductionDevelopmentKnowledgeRuntime } from '../src/projectDevelopmentKnowledge/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const repository = 'korzh260609-beep/garya-bot';

integration('PDK4.13: PostgreSQL single-flight blocks concurrent reconcilers and releases deterministically', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const projectKey = `pdk413-lock-${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: `pdk413-lock-${suffix}` });
  await persistence.start();
  const lock = createPostgresDevelopmentKnowledgeSingleFlight(persistence.database, { defaultLeaseMs: 30000 });
  const first = await lock.acquire({ projectKey, repository, ownerId: 'web-a' });
  const concurrent = await lock.acquire({ projectKey, repository, ownerId: 'worker-b' });
  assert.equal(first.acquired, true);
  assert.equal(concurrent.acquired, false);
  assert.equal((await lock.inspect({ projectKey, repository })).active, true);
  assert.equal((await lock.release({ projectKey, repository, ownerId: 'web-a' })).released, true);
  assert.equal((await lock.acquire({ projectKey, repository, ownerId: 'worker-b' })).acquired, true);
  await lock.release({ projectKey, repository, ownerId: 'worker-b' });
  await persistence.close();
});

integration('PDK4.13: GitHub credential/outage failure degrades only PDK4 and returns bounded secret-safe health', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const projectKey = `pdk413-degraded-${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: `pdk413-degraded-${suffix}` });
  await persistence.start();
  const runtime = createProductionDevelopmentKnowledgeRuntime({
    config: { enabled: true, projectKey, repository, branch: 'dev/sg2.1-semantic', pollIntervalMs: 60000, batchSize: 25, maxCommitsPerRun: 50, requestTimeoutMs: 2000, credentialId: 'sg.github.pdk4' },
    database: persistence.database,
    projectMemoryStore: createPostgresProjectMemoryStore(persistence.database),
    credentialManager: Object.freeze({ async useCredential() { const error = new Error('secret-token-must-never-appear'); error.code = 'credential-secret-unavailable'; throw error; } }),
    credentialAccessContext: Object.freeze({ actor: Object.freeze({ globalUserId: 'system:runtime' }), scope: Object.freeze({ projectScope: projectKey }) }),
    fetchImpl: async () => { throw new Error('network should not be reached without credentials'); },
    ownerId: `degraded-${suffix}`
  });
  const result = await runtime.reconcile({ reason: 'credential-outage' });
  assert.equal(result.status, 'degraded');
  assert.equal(result.errorCode, 'pdk4-github-history-connector-unavailable');
  const health = runtime.health();
  assert.equal(health.phase, 'degraded');
  assert.equal(health.healthy, false);
  assert.doesNotMatch(JSON.stringify(health), /secret-token-must-never-appear/);
  await runtime.stop();
  await persistence.close();
});
