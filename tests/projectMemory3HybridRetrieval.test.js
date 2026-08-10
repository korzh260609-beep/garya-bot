import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import { createPostgresProjectMemoryStore, createProjectFact, createProjectMemoryHybridRetrieval } from '../src/projectMemory/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function makeFact({ memoryId, projectKey, entityKey, summary, status = 'implemented', validFrom = '2026-08-10T10:00:00Z', validTo = null, relationKeys = [] }) {
  return createProjectFact({
    memoryId,
    projectKey,
    namespace: `project.${projectKey}.memory`,
    factType: 'memory-state',
    entityKey,
    fact: { status, summary },
    source: { kind: 'github', ref: `commit:${memoryId}`, actorId: 'monarch', timestamp: validFrom },
    sourceEventId: `event:${memoryId}`,
    trust: 'verified',
    confirmed: true,
    confirmationState: 'confirmed',
    lifecycleState: 'active',
    validFrom,
    validTo,
    createdAt: validFrom,
    updatedAt: validFrom,
    relationKeys,
    tags: ['pm3.7']
  }, { clock: () => new Date(validFrom) });
}

function authorize({ actor, projectKey }) {
  return actor?.projects?.includes(projectKey) === true;
}

integration('PM3.7: exact, metadata, temporal and semantic retrieval stay project-scoped and authorized', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.7-hybrid-test' });
  await persistence.start();
  await runMigrations(persistence.database);
  const store = createPostgresProjectMemoryStore(persistence.database);
  const projectKey = `pm37-${randomUUID().slice(0, 8)}`;
  const actor = { globalUserId: 'usr_pm37', projects: [projectKey] };
  const retrieval = createProjectMemoryHybridRetrieval({ database: persistence.database, store, authorize, clock: () => new Date('2026-08-10T12:00:00Z') });

  const hybrid = makeFact({
    memoryId: `pm37:${projectKey}:hybrid`, projectKey, entityKey: 'pm3.7-hybrid',
    summary: 'Hybrid retrieval combines exact lexical matching with semantic vector ranking.',
    relationKeys: ['pm3.7-vector']
  });
  const vectorTarget = makeFact({
    memoryId: `pm37:${projectKey}:vector`, projectKey, entityKey: 'pm3.7-vector',
    summary: 'Vector similarity is stored durably in PostgreSQL and may use pgvector.'
  });
  const unrelated = makeFact({
    memoryId: `pm37:${projectKey}:unrelated`, projectKey, entityKey: 'pm3.7-unrelated',
    summary: 'A transport adapter fact unrelated to memory retrieval.'
  });
  const historical = makeFact({
    memoryId: `pm37:${projectKey}:old`, projectKey, entityKey: 'pm3.7-old', status: 'planned',
    summary: 'Old historical retrieval design.', validFrom: '2026-08-01T00:00:00Z', validTo: '2026-08-05T00:00:00Z'
  });
  for (const fact of [hybrid, vectorTarget, unrelated, historical]) await store.put(fact);

  await retrieval.upsertEmbedding({ actor, projectKey, memoryId: hybrid.memoryId, modelKey: 'test-2d', embedding: [1, 0] });
  await retrieval.upsertEmbedding({ actor, projectKey, memoryId: vectorTarget.memoryId, modelKey: 'test-2d', embedding: [0.95, 0.05] });
  await retrieval.upsertEmbedding({ actor, projectKey, memoryId: unrelated.memoryId, modelKey: 'test-2d', embedding: [0, 1] });

  const exact = await retrieval.search({ actor, projectKey, query: 'hybrid retrieval', factTypes: ['memory-state'], statuses: ['implemented'], expandRelations: false, limit: 3 });
  assert.equal(exact.results[0].record.memoryId, hybrid.memoryId);
  assert.ok(exact.results[0].lexicalScore > 0);
  assert.equal(exact.results.some((row) => row.record.memoryId === historical.memoryId), false);

  const semantic = await retrieval.search({ actor, projectKey, query: '', modelKey: 'test-2d', queryEmbedding: [1, 0], expandRelations: false, limit: 3 });
  assert.equal(semantic.results[0].record.memoryId, hybrid.memoryId);
  assert.ok(['pgvector', 'postgres-array-fallback'].includes(semantic.semanticMode));
  assert.ok(semantic.results[0].semanticScore >= semantic.results[1].semanticScore);

  const historicalView = await retrieval.search({ actor, projectKey, query: 'historical', at: '2026-08-03T00:00:00Z', statuses: ['planned'], expandRelations: false, limit: 5 });
  assert.equal(historicalView.results.length, 1);
  assert.equal(historicalView.results[0].record.memoryId, historical.memoryId);

  await assert.rejects(
    () => retrieval.search({ actor: { projects: [] }, projectKey, query: 'hybrid' }),
    (error) => error.code === 'project-memory-retrieval-unauthorized'
  );
  await assert.rejects(
    () => retrieval.upsertEmbedding({ actor: { projects: [] }, projectKey, memoryId: hybrid.memoryId, modelKey: 'test-2d', embedding: [1, 0] }),
    (error) => error.code === 'project-memory-retrieval-unauthorized'
  );

  const otherProject = `pm37-${randomUUID().slice(0, 8)}`;
  const other = makeFact({ memoryId: `pm37:${otherProject}:secret`, projectKey: otherProject, entityKey: 'pm3.7-hybrid', summary: 'Other project data must never leak.' });
  await store.put(other);
  const isolated = await retrieval.search({ actor, projectKey, query: 'other project data', includeHistorical: true, expandRelations: false, limit: 10 });
  assert.equal(isolated.results.some((row) => row.record.memoryId === other.memoryId), false);

  await persistence.close();
});

integration('PM3.7: relation expansion is bounded and cannot cross project filters', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.7-relations-test' });
  await persistence.start();
  const store = createPostgresProjectMemoryStore(persistence.database);
  const projectKey = `pm37-${randomUUID().slice(0, 8)}`;
  const actor = { projects: [projectKey] };
  const retrieval = createProjectMemoryHybridRetrieval({ database: persistence.database, store, authorize });
  const source = makeFact({ memoryId: `pm37:${projectKey}:source`, projectKey, entityKey: 'source', summary: 'Exact source marker alpha.', relationKeys: ['target'] });
  const target = makeFact({ memoryId: `pm37:${projectKey}:target`, projectKey, entityKey: 'target', summary: 'Related target marker beta.' });
  await store.put(source); await store.put(target);

  const result = await retrieval.search({ actor, projectKey, query: 'alpha', relationLimit: 1, limit: 2 });
  assert.equal(result.results.some((row) => row.record.memoryId === source.memoryId), true);
  assert.equal(result.results.some((row) => row.record.memoryId === target.memoryId && row.relationExpanded === true), true);
  assert.ok(result.results.length <= 2);
  await persistence.close();
});
