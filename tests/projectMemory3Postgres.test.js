import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  SG21_PROJECT_MEMORY_NAMESPACES,
  createProjectFact,
  createPostgresProjectMemoryStore
} from '../src/projectMemory/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function factInput(suffix, overrides = {}) {
  return {
    memoryId: `pm3:${suffix}`,
    projectKey: 'sg2.1',
    namespace: SG21_PROJECT_MEMORY_NAMESPACES.features,
    factType: 'feature-status',
    entityKey: `pm3.2-${suffix}`,
    fact: { status: 'implemented', component: 'postgres-store' },
    source: {
      kind: 'github',
      ref: `commit:${suffix}`,
      actorId: 'monarch',
      timestamp: '2026-08-10T11:00:00.000Z'
    },
    traceId: `trace:${suffix}`,
    sourceEventId: `github:event:${suffix}`,
    trust: 'verified',
    confirmed: true,
    confirmationState: 'confirmed',
    lifecycleState: 'active',
    validFrom: '2026-08-10T11:00:00.000Z',
    createdAt: '2026-08-10T11:00:01.000Z',
    updatedAt: '2026-08-10T11:00:01.000Z',
    relationKeys: ['memory2', 'postgresql'],
    tags: ['project-memory', 'pm3.2'],
    metadata: { storage: 'postgresql' },
    ...overrides
  };
}

integration('PM3.2: project facts persist atomically inside Memory 2.0 and survive PostgreSQL restart', async () => {
  const suffix = randomUUID();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.2-postgres-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);

  const fact = createProjectFact(factInput(suffix), { clock: () => new Date('2026-08-10T11:00:01.000Z') });
  const written = await store.put(fact);
  assert.equal(written.memoryId, fact.memoryId);
  assert.equal(written.semanticFingerprint, fact.semanticFingerprint);

  const memoryRow = await persistence.database.query(`SELECT project_scope,scope_kind,memory_layer,owner_global_user_id,privacy_class,semantic_fingerprint
    FROM memory_records WHERE memory_id=$1`, [fact.memoryId]);
  assert.equal(memoryRow.rowCount, 1);
  assert.equal(memoryRow.rows[0].project_scope, 'sg2.1');
  assert.equal(memoryRow.rows[0].scope_kind, 'project');
  assert.equal(memoryRow.rows[0].memory_layer, 'project-memory');
  assert.equal(memoryRow.rows[0].owner_global_user_id, null);
  assert.equal(memoryRow.rows[0].privacy_class, 'project');
  assert.equal(memoryRow.rows[0].semantic_fingerprint, fact.semanticFingerprint);

  const extensionCounts = await persistence.database.query(`SELECT
    (SELECT count(*)::int FROM project_memory_entries WHERE memory_id=$1) AS entries,
    (SELECT count(*)::int FROM project_memory_provenance WHERE memory_id=$1) AS provenance,
    (SELECT count(*)::int FROM project_memory_relations WHERE source_memory_id=$1) AS relations,
    (SELECT count(*)::int FROM project_memory_history WHERE memory_id=$1) AS history`, [fact.memoryId]);
  assert.deepEqual(extensionCounts.rows[0], { entries: 1, provenance: 1, relations: 2, history: 1 });

  const loaded = await store.get(fact.memoryId, { projectKey: 'sg2.1' });
  assert.equal(loaded.memoryId, fact.memoryId);
  assert.equal(loaded.projectKey, 'sg2.1');
  assert.equal(loaded.namespace, fact.namespace);
  assert.equal(loaded.fact.status, 'implemented');
  assert.equal(loaded.source.ref, fact.source.ref);
  assert.deepEqual([...loaded.relationKeys].sort(), ['memory2', 'postgresql']);
  assert.equal(await store.get(fact.memoryId, { projectKey: 'other' }), null);
  assert.equal((await store.list({ projectKey: 'other', entityKey: fact.entityKey })).length, 0);

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.2-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresProjectMemoryStore(restarted.database);
  const afterRestart = await restartedStore.get(fact.memoryId, { projectKey: 'sg2.1' });
  assert.equal(afterRestart.memoryId, fact.memoryId);
  assert.equal(afterRestart.semanticFingerprint, fact.semanticFingerprint);
  assert.equal((await restartedStore.history({ projectKey: 'sg2.1', memoryId: fact.memoryId })).length, 1);

  const columns = await restarted.database.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='project_memory_entries' ORDER BY column_name`);
  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  assert.ok(columnNames.has('embedding_model'));
  assert.ok(columnNames.has('embedding_dimensions'));
  assert.ok(columnNames.has('embedding_status'));

  await restarted.database.query('DELETE FROM memory_records WHERE memory_id=$1', [fact.memoryId]);
  await restarted.close();
});

integration('PM3.2: source-event replay with a new memoryId is idempotent and preserves proposed trust state', async () => {
  const suffix = randomUUID();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.2-source-event-replay-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);
  const sourceEventId = `github:event:replay:${suffix}`;
  const firstMemoryId = `pm3:${suffix}:first`;
  const replayMemoryId = `pm3:${suffix}:replay`;
  const base = factInput(`replay-${suffix}`, {
    memoryId: firstMemoryId,
    sourceEventId,
    trust: 'verified',
    confirmed: false,
    confirmationState: 'proposed'
  });

  const first = await store.put(base);
  const replay = await store.put({ ...base, memoryId: replayMemoryId });

  assert.equal(first.memoryId, firstMemoryId);
  assert.equal(replay.memoryId, firstMemoryId);
  assert.equal(replay.sourceEventId, sourceEventId);
  assert.equal(replay.trust, 'verified');
  assert.equal(replay.confirmed, false);
  assert.equal(replay.confirmationState, 'proposed');

  const entries = await persistence.database.query(`SELECT memory_id,source_event_id
    FROM project_memory_entries WHERE project_key=$1 AND source_event_id=$2`, ['sg2.1', sourceEventId]);
  assert.equal(entries.rowCount, 1);
  assert.equal(entries.rows[0].memory_id, firstMemoryId);

  const phantom = await persistence.database.query('SELECT memory_id FROM memory_records WHERE memory_id=$1', [replayMemoryId]);
  assert.equal(phantom.rowCount, 0);

  const history = await persistence.database.query(`SELECT count(*)::int AS count
    FROM project_memory_history WHERE project_key=$1 AND source_event_id=$2`, ['sg2.1', sourceEventId]);
  assert.equal(history.rows[0].count, 1);

  await persistence.database.query('DELETE FROM memory_records WHERE memory_id=$1', [firstMemoryId]);
  await persistence.close();
});

integration('PM3.2: conflict records are durable and project-scoped', async () => {
  const suffix = randomUUID();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.2-conflict-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);

  const first = await store.put(factInput(`${suffix}:a`));
  const second = await store.put(factInput(`${suffix}:b`, { entityKey: first.entityKey, fact: { status: 'planned' } }));
  const conflict = await store.recordConflict({
    projectKey: 'sg2.1',
    memoryId: first.memoryId,
    conflictingMemoryId: second.memoryId,
    reason: 'contradictory feature status',
    metadata: { detectedBy: 'pm3.2-test' }
  });
  assert.equal(conflict.project_key, 'sg2.1');
  assert.equal(conflict.status, 'open');

  const stored = await persistence.database.query('SELECT * FROM project_memory_conflicts WHERE conflict_id=$1', [conflict.conflict_id]);
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].memory_id, first.memoryId);
  assert.equal(stored.rows[0].conflicting_memory_id, second.memoryId);

  await persistence.database.query('DELETE FROM memory_records WHERE memory_id=ANY($1::text[])', [[first.memoryId, second.memoryId]]);
  await persistence.close();
});

test('PM3.2: durable store rejects raw secret-shaped facts before PostgreSQL write', () => {
  assert.throws(
    () => createProjectFact(factInput('secret-rejection', { fact: { api_key: 'must-not-persist' } })),
    (error) => error.code === 'project-memory-secret-field-rejected'
  );
});
