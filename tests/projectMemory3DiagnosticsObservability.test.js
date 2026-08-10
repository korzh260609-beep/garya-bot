import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import {
  PROJECT_MEMORY3_DIAGNOSTIC_CHECKS,
  SG21_PROJECT_MEMORY_NAMESPACES,
  createProjectFact,
  createPostgresProjectMemoryStore,
  createProjectMemoryHybridRetrieval,
  createProjectMemoryContextGuard,
  createProjectMemoryDiagnostics
} from '../src/projectMemory/index.js';
import { createDiagnosticsHttpServer } from '../src/diagnostics/httpServer.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function authorize({ actor, projectKey }) {
  return actor?.projects?.includes(projectKey) === true;
}

function factInput(projectKey, memoryId, marker) {
  return {
    memoryId,
    projectKey,
    namespace: `project.${projectKey}.features`,
    factType: 'feature-status',
    entityKey: 'pm3.11-diagnostics',
    fact: { status: 'implemented', component: 'project-memory-diagnostics', internalMarker: marker },
    source: { kind: 'github', ref: `commit:${memoryId}`, actorId: 'monarch', timestamp: '2026-08-10T14:00:00.000Z' },
    traceId: `trace:${memoryId}`,
    sourceEventId: `event:${memoryId}`,
    trust: 'verified',
    confirmed: true,
    confirmationState: 'confirmed',
    lifecycleState: 'active',
    validFrom: '2026-08-10T14:00:00.000Z',
    createdAt: '2026-08-10T14:00:01.000Z',
    updatedAt: '2026-08-10T14:00:01.000Z',
    tags: ['pm3.11'],
    metadata: { stage: 'PM3.11' }
  };
}

test('PM3.11: canonical diagnostics contract exposes all required checks', () => {
  assert.deepEqual(PROJECT_MEMORY3_DIAGNOSTIC_CHECKS, [
    'project_memory_health',
    'project_memory_counts',
    'project_memory_search_test',
    'project_memory_duplicate_test',
    'project_memory_conflict_test',
    'project_memory_source_test',
    'project_memory_context_test',
    'project_memory_restart_continuity_test'
  ]);
  assert.equal(SG21_PROJECT_MEMORY_NAMESPACES.features, 'project.sg2.1.features');
});

integration('PM3.11: diagnostics identify store/retrieval/source/context state without leaking raw memory', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.11-diagnostics-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const store = createPostgresProjectMemoryStore(persistence.database);
  const retrieval = createProjectMemoryHybridRetrieval({ database: persistence.database, store, authorize, clock: () => new Date('2026-08-10T14:30:00.000Z') });
  const contextGuard = createProjectMemoryContextGuard({ database: persistence.database, retrieval, authorize, clock: () => new Date('2026-08-10T14:30:00.000Z') });
  const diagnostics = createProjectMemoryDiagnostics({ database: persistence.database, retrieval, contextGuard, authorize, clock: () => new Date('2026-08-10T14:30:00.000Z') });
  const projectKey = `pm311-${randomUUID().slice(0, 8)}`;
  const actor = { projects: [projectKey] };
  const marker = `RAW_MEMORY_MUST_NOT_LEAK_${randomUUID()}`;
  const memoryId = `pm311:${projectKey}:fact`;

  await store.put(createProjectFact(factInput(projectKey, memoryId, marker), { clock: () => new Date('2026-08-10T14:00:01.000Z') }));

  const report = await diagnostics.runAll({ actor, projectKey, query: 'project memory diagnostics' });
  assert.equal(report.kind, 'ProjectMemoryDiagnostics');
  assert.equal(report.status, 'healthy');
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((item) => item.check), [...PROJECT_MEMORY3_DIAGNOSTIC_CHECKS]);
  assert.ok(report.checks.every((item) => item.ok === true));
  assert.equal(report.audit.bounded, true);
  assert.equal(report.audit.rawMemoryIncluded, false);
  assert.ok(report.audit.history.some((item) => item.eventType === 'stored' && item.count >= 1));

  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(marker), false);
  assert.equal(serialized.includes('internalMarker'), false);
  assert.equal(serialized.includes('factData'), false);
  assert.equal(serialized.includes('sourceRef'), false);

  await assert.rejects(
    () => diagnostics.runAll({ actor: { projects: [] }, projectKey }),
    (error) => error.code === 'project-memory-diagnostics-unauthorized'
  );

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.11-restart-test' });
  await restarted.start();
  const restartedDiagnostics = createProjectMemoryDiagnostics({ database: restarted.database, authorize });
  const continuity = await restartedDiagnostics.restartContinuityTest({ projectKey });
  assert.equal(continuity.ok, true);
  assert.ok(continuity.data.durableEntryCount >= 1);
  assert.ok(continuity.data.historyEventCount >= 1);
  await restarted.database.query('DELETE FROM memory_records WHERE memory_id=$1', [memoryId]);
  await restarted.close();
});

test('PM3.11: retrieval and context failures are surfaced as diagnostic failures, not raw payloads', async () => {
  const database = {
    async query(sql) {
      if (sql.includes('information_schema.tables')) return { rows: [
        { table_name: 'memory_records' }, { table_name: 'project_memory_conflicts' }, { table_name: 'project_memory_embeddings' },
        { table_name: 'project_memory_entries' }, { table_name: 'project_memory_history' }, { table_name: 'project_memory_provenance' }, { table_name: 'project_memory_relations' }
      ] };
      if (sql === 'SELECT 1 AS ok') return { rows: [{ ok: 1 }] };
      if (sql.includes('count(*)::int AS total') || sql.includes('count(*)::int AS groups') || sql.includes('count(*)::int AS missing') || sql.includes('count(*)::int AS history_count')) {
        return { rows: [{ total: 0, confirmed: 0, proposed: 0, rejected: 0, active: 0, archived: 0, open: 0, resolved: 0, groups: 0, max_occurrences: 0, missing: 0, history_count: 0, missing_memory_record: 0, missing_provenance: 0, self_conflicts: 0 }] };
      }
      if (sql.includes('GROUP BY p.source_kind') || sql.includes('GROUP BY event_type') || sql.includes('GROUP BY status')) return { rows: [] };
      return { rows: [] };
    }
  };
  const retrieval = { async search() { throw Object.assign(new Error('retrieval unavailable: SECRET_VALUE'), { code: 'retrieval-test-failed' }); } };
  const contextGuard = { async retrieve() { throw Object.assign(new Error('context unavailable: SECRET_VALUE'), { code: 'context-test-failed' }); } };
  const diagnostics = createProjectMemoryDiagnostics({ database, retrieval, contextGuard, authorize: async () => true, clock: () => new Date('2026-08-10T14:30:00Z') });
  const report = await diagnostics.runAll({ actor: {}, projectKey: 'sg2.1' });
  const search = report.checks.find((item) => item.check === 'project_memory_search_test');
  const context = report.checks.find((item) => item.check === 'project_memory_context_test');
  assert.equal(search.status, 'failed');
  assert.equal(search.data.code, 'retrieval-test-failed');
  assert.equal(context.status, 'failed');
  assert.equal(context.data.code, 'context-test-failed');
  assert.equal(JSON.stringify(report).includes('factData'), false);
});

test('PM3.11: owner-only diagnostics HTTP endpoint is audited and project-scoped', async () => {
  const audits = [];
  const calls = [];
  const service = {
    recentTraces: async () => [],
    analyzeRequest: async () => ({}),
    systemHealth: async () => ({}),
    runLive: async () => ({ result: { failed: 0 } }),
    runRegressions: async () => ({ failed: 0 }),
    async projectMemory(input) {
      calls.push(input);
      return { kind: 'ProjectMemoryDiagnostics', projectKey: 'sg2.1', status: 'healthy', ok: true, checks: [], audit: { rawMemoryIncluded: false } };
    }
  };
  const store = {
    getRun: async () => null,
    listRuns: async () => [],
    listRegressions: async () => [],
    putRegression: async () => ({}),
    async recordAccess(input) { audits.push(input); return input; }
  };
  const server = createDiagnosticsHttpServer({ service, store, host: '127.0.0.1', port: 0, adminToken: 'pm311-token', monarchGlobalUserId: 'usr_monarch', projectScope: 'sg2.1' });
  const address = await server.start();
  const headers = { 'content-type': 'application/json', 'x-diagnostics-token': 'pm311-token', 'x-sg-global-user-id': 'usr_monarch' };
  try {
    const forbidden = await fetch(`http://127.0.0.1:${address.port}/api/project-memory`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(forbidden.status, 403);

    const crossProject = await fetch(`http://127.0.0.1:${address.port}/api/project-memory`, { method: 'POST', headers, body: JSON.stringify({ projectKey: 'other' }) });
    assert.equal(crossProject.status, 403);

    const allowed = await fetch(`http://127.0.0.1:${address.port}/api/project-memory`, { method: 'POST', headers, body: JSON.stringify({ query: 'health' }) });
    assert.equal(allowed.status, 200);
    const payload = await allowed.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.audit.rawMemoryIncluded, false);
    assert.deepEqual(calls[0], { projectKey: 'sg2.1', query: 'health' });
    assert.ok(audits.some((item) => item.path === '/api/project-memory' && item.outcome === 'deny'));
    assert.ok(audits.some((item) => item.path === '/api/project-memory' && item.outcome === 'allow'));
  } finally { await server.stop(); }
});
