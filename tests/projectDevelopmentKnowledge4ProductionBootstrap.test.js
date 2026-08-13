import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresProjectMemoryStore, createProjectMemoryHybridRetrieval, createProjectMemoryContextGuard, createProjectMemoryAIRouterIntegration } from '../src/projectMemory/index.js';
import { createProductionDevelopmentKnowledgeRuntime, createDevelopmentQueryIntegration } from '../src/projectDevelopmentKnowledge/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const repository = 'korzh260609-beep/garya-bot';
const branch = 'dev/sg2.1-semantic';
const sha1 = '1111111111111111111111111111111111111111';
const sha2 = '2222222222222222222222222222222222222222';

function response(body, { link = null, status = 200 } = {}) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, headers: Object.freeze({ get(name) { return String(name).toLowerCase() === 'link' ? link : null; } }), async json() { return body; } });
}
function commit(sha, message, date) {
  return { sha, commit: { message, author: { name: 'SG', date }, committer: { date } }, parents: [], stats: { additions: 10, deletions: 1 }, files: [{ filename: 'src/projectDevelopmentKnowledge/live.js', status: 'modified', additions: 10, deletions: 1, changes: 11, patch: '+ implement project development knowledge production wiring' }] };
}
function githubFixture() {
  let head = sha1;
  const records = new Map([
    [sha1, commit(sha1, 'feat: implement live project history', '2026-08-10T10:00:00.000Z')],
    [sha2, commit(sha2, 'feat: continue autonomous project history', '2026-08-11T10:00:00.000Z')]
  ]);
  return Object.freeze({
    setHead(value) { head = value; },
    async fetch(url, options = {}) {
      assert.match(options.headers?.Authorization ?? '', /^Bearer /);
      const path = new URL(url).pathname + new URL(url).search;
      if (path === `/repos/${repository}/commits/${encodeURIComponent(branch)}`) return response({ sha: head });
      if (path.startsWith(`/repos/${repository}/commits?`)) return response([records.get(head)]);
      if (path === `/repos/${repository}/commits/${sha1}`) return response(records.get(sha1));
      if (path === `/repos/${repository}/commits/${sha2}`) return response(records.get(sha2));
      if (path.startsWith(`/repos/${repository}/compare/${sha1}...${sha2}`)) return response({ status: 'ahead', total_commits: 1, commits: [records.get(sha2)] });
      throw new Error(`unexpected GitHub fixture URL: ${path}`);
    }
  });
}
function runtimeFor({ database, projectMemoryStore, projectKey, fetchImpl, ownerId, pollIntervalMs = 60000 }) {
  return createProductionDevelopmentKnowledgeRuntime({
    config: { enabled: true, projectKey, repository, branch, pollIntervalMs, batchSize: 25, maxCommitsPerRun: 100, requestTimeoutMs: 5000, credentialId: 'sg.github.pdk4' },
    database,
    projectMemoryStore,
    credentialManager: Object.freeze({ async useCredential({ operation }) { return operation('test-token'); } }),
    credentialAccessContext: Object.freeze({ actor: Object.freeze({ globalUserId: 'system:runtime', grants: Object.freeze(['credential:use:system']) }), scope: Object.freeze({ projectScope: projectKey }) }),
    fetchImpl,
    ownerId
  });
}
function authorize({ actor, projectKey, operation }) {
  return actor?.projectMemoryAuthorization?.projectScope === projectKey && ['read','context-read'].includes(operation);
}
async function waitFor(predicate, { timeoutMs = 4000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

integration('PDK4.13: production bootstrap persists cursor, resumes after restart, ingests a new commit once and feeds ordinary query integration', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const projectKey = `pdk413-${suffix}`;
  const fixture = githubFixture();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: `pdk413-bootstrap-${suffix}` });
  await persistence.start();
  const projectMemoryStore = createPostgresProjectMemoryStore(persistence.database);
  const runtime1 = runtimeFor({ database: persistence.database, projectMemoryStore, projectKey, fetchImpl: fixture.fetch, ownerId: `runtime-a-${suffix}` });

  const first = await runtime1.reconcile({ reason: 'acceptance-first-start' });
  assert.equal(first.status, 'current');
  const firstDiagnostics = await runtime1.inspect();
  assert.equal(firstDiagnostics.historical_bootstrap_status, 'complete');
  assert.equal(firstDiagnostics.commits_scanned, 1);
  assert.equal(firstDiagnostics.events_extracted, 1);
  const firstCursor = firstDiagnostics.historical_bootstrap_cursor.lastSourceId;
  await runtime1.stop();
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: `pdk413-restart-${suffix}` });
  await restarted.start();
  const restartedStore = createPostgresProjectMemoryStore(restarted.database);
  const runtime2 = runtimeFor({ database: restarted.database, projectMemoryStore: restartedStore, projectKey, fetchImpl: fixture.fetch, ownerId: `runtime-b-${suffix}` });
  const replayBeforeNewCommit = await runtime2.reconcile({ reason: 'acceptance-restart' });
  assert.equal(replayBeforeNewCommit.status, 'current');
  assert.equal(replayBeforeNewCommit.processed, 0);
  assert.equal((await runtime2.inspect()).historical_bootstrap_cursor.lastSourceId, firstCursor);

  fixture.setHead(sha2);
  const newCommit = await runtime2.reconcile({ reason: 'acceptance-new-commit' });
  assert.equal(newCommit.status, 'current');
  assert.equal(newCommit.processed, 1);
  const replay = await runtime2.reconcile({ reason: 'acceptance-replay' });
  assert.equal(replay.processed, 0);

  const stored = await restarted.database.query(`SELECT m.trust,m.confirmed,m.confirmation_state,p.source_kind,p.source_ref,e.fact
    FROM project_memory_entries e JOIN memory_records m USING(memory_id) JOIN project_memory_provenance p USING(memory_id)
    WHERE e.project_key=$1 AND e.fact_type='project-event' ORDER BY e.valid_from`, [projectKey]);
  assert.equal(stored.rowCount, 2);
  assert.equal(stored.rows.every((row) => row.trust === 'verified' && row.confirmed === false && row.confirmation_state === 'proposed' && row.source_kind === 'github'), true);
  assert.equal(stored.rows.every((row) => row.source_ref.startsWith(`github:${repository}@`)), true);

  const retrieval = createProjectMemoryHybridRetrieval({ database: restarted.database, store: restartedStore, authorize });
  const contextGuard = createProjectMemoryContextGuard({ database: restarted.database, retrieval, authorize });
  const pmIntegration = createProjectMemoryAIRouterIntegration({ retrieval, contextGuard });
  const development = createDevelopmentQueryIntegration({ projectMemoryIntegration: pmIntegration, retrieval, contextGuard });
  const request = Object.freeze({ actor: Object.freeze({ globalUserId: 'usr-monarch', roles: Object.freeze(['monarch']) }), scope: Object.freeze({ projectScope: projectKey }), traceContext: Object.freeze({ traceId: 'pdk413-query', requestId: 'pdk413-query' }), input: Object.freeze({ semanticIntent: 'answer' }) });
  const context = await development.contextForRequest({ request, query: 'project history autonomous project history' });
  assert.ok(context);
  assert.equal(context.qualification.sourceVerifiedProposedFactsMayBeIncluded, true);
  assert.equal(context.qualification.monarchConfirmationImplied, false);
  assert.equal(context.projectMemoryContext.facts.every((fact) => fact.confirmed === false && fact.trust === 'verified'), true);

  const finalDiagnostics = await runtime2.inspect();
  assert.equal(finalDiagnostics.commits_scanned, 1);
  assert.equal(finalDiagnostics.events_extracted, 2);
  assert.equal(finalDiagnostics.continuous_ingestion_health.status, 'ok');
  assert.equal(finalDiagnostics.continuous_ingestion_health.lastCommitSha, sha2);
  await runtime2.stop();
  await restarted.close();
});

integration('PDK4.13: startup retries promptly after a rolling-deploy single-flight lease is released', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const projectKey = `pdk413-lease-${suffix}`;
  const fixture = githubFixture();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: `pdk413-lease-${suffix}` });
  await persistence.start();
  const projectMemoryStore = createPostgresProjectMemoryStore(persistence.database);
  const holderOwnerId = `runtime-holder-${suffix}`;
  const contenderOwnerId = `runtime-contender-${suffix}`;
  const holder = runtimeFor({ database: persistence.database, projectMemoryStore, projectKey, fetchImpl: fixture.fetch, ownerId: holderOwnerId, pollIntervalMs: 1000 });
  const contender = runtimeFor({ database: persistence.database, projectMemoryStore, projectKey, fetchImpl: fixture.fetch, ownerId: contenderOwnerId, pollIntervalMs: 1000 });

  try {
    const held = await holder.singleFlight.acquire({ projectKey, repository, ownerId: holderOwnerId, leaseDurationMs: 15000 });
    assert.equal(held.acquired, true);

    const initial = await contender.start();
    assert.equal(initial.phase, 'not-started');
    assert.equal(initial.lastAttemptAt, null);

    const released = await holder.singleFlight.release({ projectKey, repository, ownerId: holderOwnerId });
    assert.equal(released.released, true);

    const recovered = await waitFor(() => contender.health().phase === 'current' && contender.health().lastAttemptAt !== null, { timeoutMs: 4000 });
    assert.equal(recovered, true);
    assert.equal(contender.health().lastErrorCode, null);
  } finally {
    await contender.stop();
    await holder.singleFlight.release({ projectKey, repository, ownerId: holderOwnerId }).catch(() => {});
    await persistence.close();
  }
});
