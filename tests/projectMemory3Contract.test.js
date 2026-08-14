import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_MEMORY3_DOMAINS,
  SG21_PROJECT_MEMORY_NAMESPACES,
  createProjectFact,
  createProjectMemoryNamespace,
  createProjectMemoryNamespaces,
  parseProjectMemoryNamespace,
  assertProjectMemoryNamespaceForProject,
  assertProjectFactForProject,
  selectProjectFactsForProject
} from '../src/projectMemory/index.js';

const CLOCK = () => new Date('2026-08-10T10:00:00.000Z');

function baseFact(overrides = {}) {
  return {
    projectKey: 'sg2.1',
    namespace: SG21_PROJECT_MEMORY_NAMESPACES.features,
    factType: 'feature-status',
    entityKey: 'project-memory-3.0',
    fact: { status: 'planned' },
    source: {
      kind: 'github',
      ref: 'commit:abc123',
      actorId: 'monarch',
      timestamp: '2026-08-10T09:59:00.000Z'
    },
    traceId: 'trace-pm31-1',
    trust: 'verified',
    confirmed: true,
    confirmationState: 'confirmed',
    tags: ['memory', 'project-memory'],
    ...overrides
  };
}

test('PM3.1: canonical SG 2.1 namespaces cover every approved project-memory domain', () => {
  assert.deepEqual(Object.keys(SG21_PROJECT_MEMORY_NAMESPACES), [...PROJECT_MEMORY3_DOMAINS]);
  assert.equal(SG21_PROJECT_MEMORY_NAMESPACES.architecture, 'project.sg2.1.architecture');
  assert.equal(SG21_PROJECT_MEMORY_NAMESPACES.incidents, 'project.sg2.1.incidents');
  assert.deepEqual(createProjectMemoryNamespaces('sg2.1'), SG21_PROJECT_MEMORY_NAMESPACES);
});

test('PM3.1: namespace parser keeps project and domain explicit', () => {
  const namespace = createProjectMemoryNamespace('alpha', 'features');
  assert.equal(namespace, 'project.alpha.features');
  assert.deepEqual(parseProjectMemoryNamespace(namespace), {
    namespace: 'project.alpha.features',
    projectKey: 'alpha',
    domain: 'features'
  });
  assert.throws(() => createProjectMemoryNamespace('sg2.1', 'unknown'), /unsupported Project Memory domain/i);
});

test('PM3.1: project fact is a strict project-scoped Memory 2.0-compatible record', () => {
  const record = createProjectFact(baseFact(), { clock: CLOCK });
  assert.equal(record.projectKey, 'sg2.1');
  assert.equal(record.namespace, 'project.sg2.1.features');
  assert.equal(record.domain, 'features');
  assert.equal(record.memoryScope.kind, 'project');
  assert.equal(record.memoryScope.projectScope, 'sg2.1');
  assert.equal(record.memoryScope.ownerGlobalUserId, null);
  assert.equal(record.layer, 'project-memory');
  assert.equal(record.privacyClass, 'project');
  assert.equal(record.trust, 'verified');
  assert.equal(record.confirmed, true);
  assert.equal(record.confirmationState, 'confirmed');
  assert.equal(record.validFrom, '2026-08-10T09:59:00.000Z');
  assert.equal(record.createdAt, '2026-08-10T10:00:00.000Z');
  assert.match(record.semanticFingerprint, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.fact));
});

test('PM3.1: namespace and project key cannot disagree', () => {
  assert.throws(
    () => createProjectFact(baseFact({ projectKey: 'other-project' }), { clock: CLOCK }),
    (error) => error.code === 'project-memory-project-scope-denied'
  );
  assert.throws(
    () => assertProjectMemoryNamespaceForProject('project.other.features', 'sg2.1'),
    (error) => error.code === 'project-memory-project-scope-denied'
  );
});

test('PM3.1: cross-project selection is fail-closed', () => {
  const sg = createProjectFact(baseFact({ traceId: 'trace-sg' }), { clock: CLOCK });
  const other = createProjectFact(baseFact({
    projectKey: 'other',
    namespace: 'project.other.features',
    traceId: 'trace-other'
  }), { clock: CLOCK });

  const selected = selectProjectFactsForProject([other, sg], { projectKey: 'sg2.1' });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].memoryId, sg.memoryId);
  assert.throws(() => assertProjectFactForProject(other, 'sg2.1'), (error) => error.code === 'project-memory-project-scope-denied');
});

test('PM3.1: namespace filtering cannot be used to broaden project scope', () => {
  const feature = createProjectFact(baseFact({ traceId: 'trace-feature' }), { clock: CLOCK });
  const decision = createProjectFact(baseFact({
    namespace: SG21_PROJECT_MEMORY_NAMESPACES.decisions,
    factType: 'architecture-decision',
    entityKey: 'ai-router-only',
    fact: { decision: 'all model calls use AI Router' },
    traceId: 'trace-decision'
  }), { clock: CLOCK });

  assert.deepEqual(
    selectProjectFactsForProject([feature, decision], {
      projectKey: 'sg2.1',
      namespaces: [SG21_PROJECT_MEMORY_NAMESPACES.decisions]
    }).map((record) => record.entityKey),
    ['ai-router-only']
  );

  assert.throws(
    () => selectProjectFactsForProject([feature], {
      projectKey: 'sg2.1',
      namespaces: ['project.other.features']
    }),
    (error) => error.code === 'project-memory-project-scope-denied'
  );
});

test('PM3.1: authority-bearing fields are rejected recursively before a project fact exists', () => {
  for (const fact of [
    { status: 'implemented', roles: ['owner'] },
    { nested: { permissions: ['*'] } },
    { nested: { global_user_id: 'usr_x' } },
    { authority: { allowed: true } }
  ]) {
    assert.throws(
      () => createProjectFact(baseFact({ fact }), { clock: CLOCK }),
      (error) => error.code === 'project-memory-authority-field-rejected'
    );
  }
});

test('PM3.1: secret-shaped structured fields are rejected', () => {
  assert.throws(
    () => createProjectFact(baseFact({ metadata: { api_key: 'abc' } }), { clock: CLOCK }),
    (error) => error.code === 'project-memory-secret-field-rejected'
  );
  assert.throws(
    () => createProjectFact(baseFact({ fact: { credentials: { value: 'abc' } } }), { clock: CLOCK }),
    (error) => error.code === 'project-memory-secret-field-rejected'
  );
});

test('PM3.1: a durable fact requires provenance plus trace/event identity', () => {
  assert.throws(() => createProjectFact(baseFact({ traceId: null, sourceEventId: null }), { clock: CLOCK }), /traceId or sourceEventId is required/);
  assert.throws(() => createProjectFact(baseFact({ source: { kind: 'github', ref: '' } }), { clock: CLOCK }), /source.ref is required/);

  const byEvent = createProjectFact(baseFact({ traceId: null, sourceEventId: 'github:event:1' }), { clock: CLOCK });
  assert.equal(byEvent.sourceEventId, 'github:event:1');
});

test('PM3.1: confirmation state, trust and lifecycle reuse Memory 2.0 invariants', () => {
  assert.throws(() => createProjectFact(baseFact({ trust: 'absolute' }), { clock: CLOCK }), /unsupported trust level/);
  assert.throws(() => createProjectFact(baseFact({ lifecycleState: 'immortal' }), { clock: CLOCK }), /unsupported lifecycle state/);
  assert.throws(() => createProjectFact(baseFact({ confirmed: false, confirmationState: 'confirmed' }), { clock: CLOCK }), /must match/);

  const candidate = createProjectFact(baseFact({
    confirmed: false,
    confirmationState: 'proposed',
    trust: 'reported',
    traceId: 'trace-candidate'
  }), { clock: CLOCK });
  assert.equal(candidate.confirmed, false);
  assert.equal(candidate.confirmationState, 'proposed');
  assert.equal(candidate.trust, 'reported');
});

test('PM3.1: temporal validity is explicit and ordered', () => {
  const bounded = createProjectFact(baseFact({
    validFrom: '2026-08-10T10:00:00.000Z',
    validTo: '2026-08-11T10:00:00.000Z',
    traceId: 'trace-bounded'
  }), { clock: CLOCK });
  assert.equal(bounded.validTo, '2026-08-11T10:00:00.000Z');

  assert.throws(
    () => createProjectFact(baseFact({
      validFrom: '2026-08-11T10:00:00.000Z',
      validTo: '2026-08-10T10:00:00.000Z'
    }), { clock: CLOCK }),
    /validTo must be later/
  );
});

test('PM3.1: fingerprint is deterministic for the same canonical fact payload', () => {
  const common = baseFact({ memoryId: 'memory-a' });
  const first = createProjectFact(common, { clock: CLOCK });
  const second = createProjectFact({ ...common, memoryId: 'memory-b' }, { clock: CLOCK });
  assert.equal(first.semanticFingerprint, second.semanticFingerprint);
  assert.notEqual(first.memoryId, second.memoryId);
});
