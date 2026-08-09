import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemorySelfKnowledgeStore,
  createSelfKnowledgeBuilder,
  createSelfKnowledgeConsistencyChecker,
  createSelfKnowledgeService
} from '../src/selfKnowledge/selfKnowledge.js';

function source(id, facts) {
  return Object.freeze({ id, async collect() { return { facts }; } });
}
function fact({ category = 'capabilities', key, value = true, status = 'implemented', kind = 'evidence', revision = 'r1', sourceId = 'test' }) {
  return { category, key, value, status, kind, provenance: { sourceType: kind, sourceId, sourceRevision: revision } };
}

test('Self Knowledge builder creates deterministic revision-bound snapshots and no-op rebuild is idempotent', async () => {
  const store = createInMemorySelfKnowledgeStore({ clock: () => new Date('2026-08-09T08:00:00.000Z'), idFactory: () => 'fixed' });
  const builder = createSelfKnowledgeBuilder({ store, sources: [source('runtime', [fact({ key: 'memory' })])] });
  const first = await builder.rebuild({ sourceRevision: 'r1', commitSha: 'abc', environment: 'test' });
  assert.equal(first.status, 'written');
  assert.equal(first.snapshot.version, 1);
  assert.equal(first.snapshot.sourceRevision, 'r1');
  assert.equal(first.snapshot.validationStatus, 'valid');

  const second = await builder.rebuild({ sourceRevision: 'r1', commitSha: 'abc', environment: 'test' });
  assert.equal(second.status, 'duplicate');
  assert.equal(second.snapshot.version, 1);
  assert.equal((await store.list({ environment: 'test' })).length, 1);
});

test('Self Knowledge consistency checker detects roadmap/code mismatches and stale revisions', () => {
  const checker = createSelfKnowledgeConsistencyChecker();
  const mismatch = checker.check({ currentRevision: 'r1', facts: [
    fact({ key: 'feature-x', status: 'planned', kind: 'declaration', sourceId: 'roadmap' }),
    fact({ key: 'feature-x', status: 'implemented', kind: 'evidence', sourceId: 'runtime' })
  ] });
  assert.equal(mismatch.validationStatus, 'conflicted');
  assert.equal(mismatch.conflicts[0].code, 'implemented-subsystem-still-planned');
  assert.equal(mismatch.facts[0].status, 'unknown');

  const stale = checker.check({ currentRevision: 'r2', facts: [fact({ key: 'feature-y', revision: 'r1' })] });
  assert.equal(stale.validationStatus, 'conflicted');
  assert.equal(stale.conflicts[0].code, 'stale-revision');
  assert.equal(stale.facts[0].status, 'unknown');
});

test('Self Knowledge service exposes bounded canonical statuses without full snapshot dumping', async () => {
  const store = createInMemorySelfKnowledgeStore();
  const builder = createSelfKnowledgeBuilder({ store, sources: [source('runtime', [
    fact({ category: 'identity', key: 'system-name', value: 'SG', kind: 'authority' }),
    fact({ key: 'one' }), fact({ key: 'two' }), fact({ key: 'three' })
  ])] });
  await builder.rebuild({ sourceRevision: 'r1', environment: 'test' });
  const service = createSelfKnowledgeService({ store });
  const result = await service.query({ environment: 'test', maxFacts: 2 });
  assert.equal(result.facts.length, 2);
  assert.equal(result.diagnostics.truncated, true);
  assert.equal(result.snapshot.validationStatus, 'valid');
});

test('failed approved source downgrades snapshot validation instead of silently claiming certainty', async () => {
  const store = createInMemorySelfKnowledgeStore();
  const builder = createSelfKnowledgeBuilder({ store, sources: [{ id: 'broken-source', async collect() { throw new Error('offline'); } }] });
  const result = await builder.rebuild({ sourceRevision: 'r1', environment: 'test' });
  assert.equal(result.validationStatus, 'conflicted');
  assert.equal(result.conflicts[0].code, 'self-knowledge-source-failed');
});
