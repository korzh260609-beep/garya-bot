import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createOwnerSecurityConfig, createOwnerSecurityGateway } from '../src/security/ownerSecurity.js';
import {
  SG21_PROJECT_MEMORY_NAMESPACES,
  createProjectFact,
  createPostgresProjectMemoryStore,
  createProjectMemoryContentFingerprint,
  createProjectMemoryDedupKeys,
  createProjectMemorySimilarityEvidence,
  evaluateProjectMemoryConflictResolution,
  createProjectMemoryDedupConflictResolver
} from '../src/projectMemory/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const MONARCH_ID = 'usr_aaaaaaaaaaaaaaaa';

function candidate(suffix, overrides = {}) {
  const createdAt = overrides.createdAt ?? '2026-08-10T12:30:00.000Z';
  return createProjectFact({
    memoryId: overrides.memoryId ?? `pm35:${suffix}:${randomUUID()}`,
    projectKey: overrides.projectKey ?? 'sg2.1',
    namespace: overrides.namespace ?? SG21_PROJECT_MEMORY_NAMESPACES.features,
    factType: overrides.factType ?? 'feature-status',
    entityKey: overrides.entityKey ?? `pm3.5-${suffix}`,
    fact: overrides.fact ?? { status: 'implemented', component: 'dedup-resolver' },
    source: overrides.source ?? {
      kind: 'github',
      ref: `github:korzh260609-beep/garya-bot@${String(suffix).replace(/[^a-f0-9]/gi, 'a').padEnd(40, 'a').slice(0, 40).toLowerCase()}`,
      actorId: 'korzh260609-beep',
      timestamp: createdAt
    },
    traceId: overrides.traceId ?? `trace:${suffix}`,
    sourceEventId: overrides.sourceEventId ?? `github:event:${suffix}:${randomUUID()}`,
    trust: overrides.trust ?? 'verified',
    confirmed: overrides.confirmed ?? false,
    confirmationState: overrides.confirmationState ?? 'proposed',
    lifecycleState: overrides.lifecycleState ?? 'temporary',
    validFrom: overrides.validFrom ?? createdAt,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    relationKeys: overrides.relationKeys ?? ['postgresql', 'memory2'],
    tags: overrides.tags ?? ['pm3.5', 'project-memory'],
    metadata: overrides.metadata ?? { sourceVerification: { verified: true } }
  }, { clock: () => new Date(createdAt) });
}

function actionContext(globalUserId = MONARCH_ID) {
  return {
    actor: { globalUserId, kind: 'user' },
    scope: { projectScope: 'sg2.1' },
    traceContext: { traceId: `trace-control-${randomUUID()}`, requestId: `req-${randomUUID()}` },
    payload: {}
  };
}

test('PM3.5: deterministic keys and content fingerprint ignore relation/tag insertion order', () => {
  const sourceEventId = 'github:event:stable';
  const first = candidate('stable-a', { entityKey: 'stable-entity', sourceEventId, relationKeys: ['memory2', 'postgresql'], tags: ['b', 'a'] });
  const second = candidate('stable-a', { entityKey: 'stable-entity', sourceEventId, memoryId: 'different-memory-id', relationKeys: ['postgresql', 'memory2'], tags: ['a', 'b'] });
  assert.equal(createProjectMemoryContentFingerprint(first), createProjectMemoryContentFingerprint(second));
  assert.deepEqual(createProjectMemoryDedupKeys(first), createProjectMemoryDedupKeys(second));
  assert.deepEqual([...first.relationKeys], ['memory2', 'postgresql']);
  assert.deepEqual([...first.tags], ['a', 'b']);
});

test('PM3.5: semantic similarity is secondary evidence and cannot collapse contradictory facts', () => {
  const left = candidate('similar-left', { entityKey: 'same-entity', fact: { status: 'implemented', component: 'project-memory' } });
  const right = candidate('similar-right', { entityKey: 'same-entity', fact: { status: 'implementing', component: 'project-memory' } });
  const similarity = createProjectMemorySimilarityEvidence(left, right);
  assert.equal(similarity.secondaryOnly, true);
  assert.ok(similarity.score > 0);
  const resolution = evaluateProjectMemoryConflictResolution({ left, right });
  assert.equal(resolution.status, 'unresolved');
  assert.equal(resolution.winnerMemoryId, null);
});

integration('PM3.5: replay, exact duplicate, contradiction, concurrency and Monarch resolution are durable', async () => {
  const suffix = randomUUID();
  const entityKey = `pm35-integration-${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.5-dedup-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);
  const ownerSecurityGateway = createOwnerSecurityGateway({
    config: createOwnerSecurityConfig({ SG_MONARCH_GLOBAL_USER_ID: MONARCH_ID })
  });
  const resolver = createProjectMemoryDedupConflictResolver({ store, database: persistence.database, ownerSecurityGateway, clock: () => new Date('2026-08-10T12:45:00.000Z') });

  const firstEventId = `github:event:${suffix}:first`;
  const first = candidate(`${suffix}-first`, { entityKey, sourceEventId: firstEventId, fact: { status: 'implemented', component: 'resolver' } });
  const stored = await resolver.ingest(first);
  assert.equal(stored.status, 'stored');

  const replay = candidate(`${suffix}-replay`, {
    entityKey,
    sourceEventId: firstEventId,
    source: first.source,
    fact: { status: 'different-payload-must-not-replace', component: 'resolver' }
  });
  const replayResult = await resolver.ingest(replay);
  assert.equal(replayResult.status, 'duplicate');
  assert.equal(replayResult.duplicateKind, 'source-event');
  assert.equal(replayResult.record.memoryId, stored.record.memoryId);
  assert.equal(replayResult.record.fact.status, 'implemented');

  const exactOtherSource = candidate(`${suffix}-exact`, {
    entityKey,
    fact: { component: 'resolver', status: 'implemented' },
    sourceEventId: `github:event:${suffix}:exact-other-source`
  });
  const exactResult = await resolver.ingest(exactOtherSource);
  assert.equal(exactResult.status, 'duplicate');
  assert.equal(exactResult.duplicateKind, 'canonical-content');
  assert.equal(exactResult.record.memoryId, stored.record.memoryId);

  const contradictory = candidate(`${suffix}-conflict`, {
    entityKey,
    fact: { status: 'planned', component: 'resolver' },
    sourceEventId: `github:event:${suffix}:conflict`
  });
  const conflictResult = await resolver.ingest(contradictory);
  assert.equal(conflictResult.status, 'conflict');
  assert.equal(conflictResult.conflicts.length, 1);
  assert.equal(conflictResult.conflicts[0].status, 'open');

  const afterConflictFirst = await store.get(stored.record.memoryId, { projectKey: 'sg2.1' });
  const afterConflictSecond = await store.get(conflictResult.record.memoryId, { projectKey: 'sg2.1' });
  assert.equal(afterConflictFirst.fact.status, 'implemented');
  assert.equal(afterConflictSecond.fact.status, 'planned');

  await assert.rejects(
    () => resolver.resolveConflict({
      conflictId: conflictResult.conflicts[0].conflict_id,
      projectKey: 'sg2.1',
      winnerMemoryId: stored.record.memoryId,
      actionContext: actionContext('usr_bbbbbbbbbbbbbbbb'),
      reason: 'unauthorized attempt'
    }),
    (error) => error.code === 'project-memory-owner-authorization-denied'
  );

  const resolved = await resolver.resolveConflict({
    conflictId: conflictResult.conflicts[0].conflict_id,
    projectKey: 'sg2.1',
    winnerMemoryId: stored.record.memoryId,
    actionContext: actionContext(),
    reason: 'Monarch keeps verified implemented state'
  });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.winnerMemoryId, stored.record.memoryId);
  assert.equal(resolved.conflict.status, 'resolved');
  assert.equal(resolved.conflict.metadata.resolution.actorRef, MONARCH_ID);

  const concurrentEntity = `${entityKey}-concurrent`;
  const concurrentA = candidate(`${suffix}-concurrent-a`, {
    entityKey: concurrentEntity,
    sourceEventId: `github:event:${suffix}:concurrent-a`,
    fact: { status: 'tested', component: 'concurrency' }
  });
  const concurrentB = candidate(`${suffix}-concurrent-b`, {
    entityKey: concurrentEntity,
    sourceEventId: `github:event:${suffix}:concurrent-b`,
    fact: { component: 'concurrency', status: 'tested' }
  });
  const concurrentResults = await Promise.all([resolver.ingest(concurrentA), resolver.ingest(concurrentB)]);
  assert.deepEqual(concurrentResults.map((result) => result.status).sort(), ['duplicate', 'stored']);

  const counts = await persistence.database.query(`SELECT
    (SELECT count(*)::int FROM project_memory_entries WHERE project_key='sg2.1' AND entity_key=$1) AS conflicting_entity_rows,
    (SELECT count(*)::int FROM project_memory_entries WHERE project_key='sg2.1' AND entity_key=$2) AS concurrent_entity_rows,
    (SELECT count(*)::int FROM project_memory_conflicts WHERE project_key='sg2.1' AND conflict_id=$3) AS conflict_rows`, [entityKey, concurrentEntity, conflictResult.conflicts[0].conflict_id]);
  assert.deepEqual(counts.rows[0], { conflicting_entity_rows: 2, concurrent_entity_rows: 1, conflict_rows: 1 });

  const sourceUnique = await persistence.database.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname=current_schema() AND indexname='project_memory_entries_source_event_unique_idx'`);
  assert.equal(sourceUnique.rowCount, 1);

  const ids = [stored.record.memoryId, conflictResult.record.memoryId, ...concurrentResults.filter((item) => item.status === 'stored').map((item) => item.record.memoryId)];
  await persistence.database.query('DELETE FROM memory_records WHERE memory_id=ANY($1::text[])', [ids]);
  await persistence.close();
});

integration('PM3.5: deduplication is project-scoped and never aliases another project', async () => {
  const suffix = randomUUID();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.5-scope-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);
  const resolver = createProjectMemoryDedupConflictResolver({ store, database: persistence.database });
  const sourceEventId = `github:event:${suffix}:shared-name`;
  const sg = candidate(`${suffix}-sg`, { entityKey: `scope-${suffix}`, sourceEventId });
  const other = candidate(`${suffix}-other`, {
    projectKey: 'other',
    namespace: 'project.other.features',
    entityKey: `scope-${suffix}`,
    sourceEventId
  });
  const first = await resolver.ingest(sg);
  const second = await resolver.ingest(other);
  assert.equal(first.status, 'stored');
  assert.equal(second.status, 'stored');
  assert.notEqual(first.record.memoryId, second.record.memoryId);
  await persistence.database.query('DELETE FROM memory_records WHERE memory_id=ANY($1::text[])', [[first.record.memoryId, second.record.memoryId]]);
  await persistence.close();
});
