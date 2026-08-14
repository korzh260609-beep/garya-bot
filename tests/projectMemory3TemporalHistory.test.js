import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import { createPostgresProjectMemoryStore, createProjectMemoryTemporalHistory, createProjectFact } from '../src/projectMemory/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function makeFact({ memoryId, projectKey, status, validFrom, sourceEventId }) {
  return createProjectFact({
    memoryId,
    projectKey,
    namespace: `project.${projectKey}.roadmap`,
    factType: 'roadmap-state',
    entityKey: 'pm3.6',
    fact: { status },
    source: { kind: 'github', ref: `commit:${sourceEventId}`, actorId: 'monarch', timestamp: validFrom },
    sourceEventId,
    trust: 'confirmed',
    confirmed: true,
    confirmationState: 'confirmed',
    lifecycleState: 'active',
    validFrom,
    createdAt: validFrom,
    updatedAt: validFrom,
    tags: ['pm3.6']
  }, { clock: () => new Date(validFrom) });
}

integration('PM3.6: temporal supersession preserves current and historical truth with restart continuity', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.6-temporal-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const { database } = persistence;
  const store = createPostgresProjectMemoryStore(database);
  const temporal = createProjectMemoryTemporalHistory({ store, database, clock: () => new Date('2026-08-10T12:00:00Z') });
  const projectKey = `pm36-${randomUUID().slice(0, 8)}`;

  const versions = [
    ['planned', '2026-08-01T00:00:00Z'],
    ['implementing', '2026-08-03T00:00:00Z'],
    ['implemented', '2026-08-05T00:00:00Z'],
    ['tested', '2026-08-07T00:00:00Z'],
    ['closed', '2026-08-09T00:00:00Z']
  ].map(([status, validFrom], index) => makeFact({ memoryId: `pm36:${projectKey}:${status}`, projectKey, status, validFrom, sourceEventId: `${index + 1}:${projectKey}` }));

  for (const fact of versions) await store.put(fact);
  for (let index = 0; index < versions.length - 1; index += 1) {
    const result = await temporal.supersede({ projectKey, currentMemoryId: versions[index].memoryId, successorMemoryId: versions[index + 1].memoryId, effectiveAt: versions[index + 1].validFrom });
    assert.equal(result.status, 'superseded');
    assert.equal(result.current.successorMemoryId, versions[index + 1].memoryId);
    assert.equal(result.current.validTo, versions[index + 1].validFrom);
    assert.equal(result.current.lifecycleState, 'archived');
  }

  const current = await temporal.getCurrent({ projectKey, entityKey: 'pm3.6' });
  assert.equal(current.length, 1);
  assert.equal(current[0].fact.status, 'closed');
  assert.equal(current[0].validTo, null);

  const historical = await temporal.getAt({ projectKey, entityKey: 'pm3.6', at: '2026-08-06T12:00:00Z' });
  assert.equal(historical.length, 1);
  assert.equal(historical[0].fact.status, 'implemented');

  const chain = await temporal.getChain({ projectKey, memoryId: versions[2].memoryId });
  assert.deepEqual(chain.map((record) => record.fact.status), ['planned', 'implementing', 'implemented', 'tested', 'closed']);

  const replay = await temporal.supersede({ projectKey, currentMemoryId: versions[0].memoryId, successorMemoryId: versions[1].memoryId, effectiveAt: versions[1].validFrom });
  assert.equal(replay.status, 'already-superseded');

  const history = await store.history({ projectKey, memoryId: versions[2].memoryId });
  assert.ok(history.some((row) => row.event_type === 'superseded'));
  assert.ok(history.some((row) => row.event_type === 'became-current'));

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.6-temporal-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresProjectMemoryStore(restarted.database);
  const restartedTemporal = createProjectMemoryTemporalHistory({ store: restartedStore, database: restarted.database, clock: () => new Date('2026-08-10T12:00:00Z') });
  const afterRestart = await restartedTemporal.getCurrent({ projectKey, entityKey: 'pm3.6' });
  assert.equal(afterRestart.length, 1);
  assert.equal(afterRestart[0].fact.status, 'closed');
  assert.deepEqual((await restartedTemporal.getChain({ projectKey, memoryId: versions[4].memoryId })).map((record) => record.fact.status), ['planned', 'implementing', 'implemented', 'tested', 'closed']);
  await restarted.close();
});

integration('PM3.6: invalid supersession fails closed for entity mismatch, time mismatch and cycles', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.6-failclosed-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const store = createPostgresProjectMemoryStore(persistence.database);
  const temporal = createProjectMemoryTemporalHistory({ store, database: persistence.database });
  const projectKey = `pm36-${randomUUID().slice(0, 8)}`;
  const first = makeFact({ memoryId: `pm36:${projectKey}:a`, projectKey, status: 'planned', validFrom: '2026-08-01T00:00:00Z', sourceEventId: `a:${projectKey}` });
  const second = makeFact({ memoryId: `pm36:${projectKey}:b`, projectKey, status: 'implemented', validFrom: '2026-08-02T00:00:00Z', sourceEventId: `b:${projectKey}` });
  const wrongEntity = createProjectFact({ ...second, memoryId: `pm36:${projectKey}:wrong`, entityKey: 'other-entity', sourceEventId: `wrong:${projectKey}` }, { clock: () => new Date(second.createdAt) });
  await store.put(first); await store.put(second); await store.put(wrongEntity);

  await assert.rejects(() => temporal.supersede({ projectKey, currentMemoryId: first.memoryId, successorMemoryId: wrongEntity.memoryId, effectiveAt: wrongEntity.validFrom }), (error) => error.code === 'project-memory-supersession-entity-mismatch');
  await assert.rejects(() => temporal.supersede({ projectKey, currentMemoryId: first.memoryId, successorMemoryId: second.memoryId, effectiveAt: '2026-08-03T00:00:00Z' }), (error) => error.code === 'project-memory-supersession-effective-time-mismatch');
  await temporal.supersede({ projectKey, currentMemoryId: first.memoryId, successorMemoryId: second.memoryId, effectiveAt: second.validFrom });
  await assert.rejects(() => temporal.supersede({ projectKey, currentMemoryId: second.memoryId, successorMemoryId: first.memoryId, effectiveAt: '2026-08-04T00:00:00Z' }), (error) => ['project-memory-supersession-cycle','project-memory-supersession-time-order','project-memory-supersession-effective-time-mismatch'].includes(error.code));
  await persistence.close();
});
