import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SG21_PROJECT_MEMORY_NAMESPACES,
  createProjectFact,
  createProjectMemoryConfirmationControl,
  createProjectMemoryConfirmationPolicy
} from '../src/projectMemory/index.js';
import { createOwnerSecurityGateway } from '../src/security/ownerSecurity.js';

const MONARCH = 'usr_48cc07c069030fb3';
const OTHER = 'usr_1111111111111111';
const FIXED_TIME = '2026-08-10T12:00:00.000Z';

function candidate(overrides = {}) {
  return createProjectFact({
    memoryId: 'pm3:confirmation-control',
    projectKey: 'sg2.1',
    namespace: SG21_PROJECT_MEMORY_NAMESPACES.features,
    factType: 'feature-status',
    entityKey: 'pm3.4',
    fact: { status: 'implemented' },
    source: {
      kind: 'github',
      ref: 'github:korzh260609-beep/garya-bot@59ae4c0752c36b2d11c55d7e9f643c210933aa3a',
      actorId: 'korzh260609-beep',
      timestamp: '2026-08-10T11:39:00.000Z'
    },
    traceId: 'trace-pm34',
    sourceEventId: 'github:commit:pm34',
    trust: 'verified',
    confirmed: false,
    confirmationState: 'proposed',
    lifecycleState: 'temporary',
    validFrom: '2026-08-10T11:39:00.000Z',
    createdAt: '2026-08-10T11:40:00.000Z',
    updatedAt: '2026-08-10T11:40:00.000Z',
    relationKeys: [],
    tags: ['project-memory', 'pm3.4'],
    metadata: {},
    ...overrides
  }, { clock: () => new Date('2026-08-10T11:40:00.000Z') });
}

function memoryStore(initial = candidate()) {
  let current = initial;
  const writes = [];
  return {
    async get(memoryId, { projectKey } = {}) {
      return current?.memoryId === memoryId && current?.projectKey === projectKey ? current : null;
    },
    async put(input) {
      current = createProjectFact(input, { clock: () => new Date(input.updatedAt ?? FIXED_TIME) });
      writes.push(current);
      return current;
    },
    current() { return current; },
    writes
  };
}

function ownerGateway() {
  return createOwnerSecurityGateway({
    config: {
      monarchGlobalUserId: MONARCH,
      lockdown: false,
      failureWindowMs: 60000,
      maxFailuresPerWindow: 10
    },
    clock: () => new Date(FIXED_TIME)
  });
}

function context(globalUserId = MONARCH, kind = 'user') {
  return {
    actor: { globalUserId, kind },
    scope: { projectScope: 'sg2.1' },
    traceContext: { traceId: 'trace-pm34-control', requestId: 'req-pm34-control' }
  };
}

function control(store = memoryStore()) {
  return createProjectMemoryConfirmationControl({
    store,
    ownerSecurityGateway: ownerGateway(),
    policy: createProjectMemoryConfirmationPolicy(),
    clock: () => new Date(FIXED_TIME)
  });
}

test('PM3.4: verified candidate stays non-active until Monarch confirmation', async () => {
  const store = memoryStore();
  assert.equal(store.current().confirmationState, 'proposed');
  assert.equal(store.current().confirmed, false);
  assert.equal(store.current().lifecycleState, 'temporary');

  const result = await control(store).confirm({
    memoryId: store.current().memoryId,
    projectKey: 'sg2.1',
    actionContext: context(),
    reason: 'verified repository evidence accepted'
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.record.confirmationState, 'confirmed');
  assert.equal(result.record.confirmed, true);
  assert.equal(result.record.lifecycleState, 'active');
  assert.equal(result.record.recordVersion, 2);
  assert.equal(result.record.metadata.confirmationAudit.length, 1);
  assert.equal(result.record.metadata.confirmationAudit[0].actorRef, MONARCH);
  assert.equal(result.record.metadata.confirmationAudit[0].operation, 'confirm');
});

test('PM3.4: non-Monarch cannot confirm a candidate', async () => {
  const store = memoryStore();
  await assert.rejects(
    () => control(store).confirm({ memoryId: store.current().memoryId, projectKey: 'sg2.1', actionContext: context(OTHER) }),
    (error) => error.code === 'project-memory-owner-authorization-denied'
  );
  assert.equal(store.current().confirmationState, 'proposed');
  assert.equal(store.writes.length, 0);
});

test('PM3.4: model/LLM actor cannot directly confirm even with Monarch id', async () => {
  const store = memoryStore();
  await assert.rejects(
    () => control(store).confirm({ memoryId: store.current().memoryId, projectKey: 'sg2.1', actionContext: context(MONARCH, 'model') }),
    (error) => error.code === 'project-memory-model-control-denied'
  );
  assert.equal(store.writes.length, 0);
});

test('PM3.4: rejection is final and archives the candidate', async () => {
  const store = memoryStore();
  const controller = control(store);
  const rejected = await controller.reject({
    memoryId: store.current().memoryId,
    projectKey: 'sg2.1',
    actionContext: context(),
    reason: 'evidence is insufficient'
  });
  assert.equal(rejected.record.confirmationState, 'rejected');
  assert.equal(rejected.record.confirmed, false);
  assert.equal(rejected.record.lifecycleState, 'archived');

  await assert.rejects(
    () => controller.confirm({ memoryId: store.current().memoryId, projectKey: 'sg2.1', actionContext: context() }),
    (error) => error.code === 'project-memory-confirmation-transition-denied'
  );
});

test('PM3.4: Monarch correction confirms corrected fact and preserves previous value in audit', async () => {
  const store = memoryStore();
  const corrected = await control(store).correct({
    memoryId: store.current().memoryId,
    projectKey: 'sg2.1',
    actionContext: context(),
    reason: 'status corrected by Monarch',
    correction: { fact: { status: 'tested' } }
  });
  assert.deepEqual(corrected.record.fact, { status: 'tested' });
  assert.equal(corrected.record.confirmationState, 'confirmed');
  assert.equal(corrected.record.lifecycleState, 'active');
  assert.deepEqual(corrected.record.metadata.confirmationAudit[0].previousFact, { status: 'implemented' });
});

test('PM3.4: confirmed fact can be invalidated only by Monarch and becomes archived/rejected', async () => {
  const store = memoryStore(candidate({ confirmed: true, confirmationState: 'confirmed', lifecycleState: 'active' }));
  const invalidated = await control(store).invalidate({
    memoryId: store.current().memoryId,
    projectKey: 'sg2.1',
    actionContext: context(),
    reason: 'fact is no longer valid'
  });
  assert.equal(invalidated.status, 'invalidated');
  assert.equal(invalidated.record.confirmationState, 'rejected');
  assert.equal(invalidated.record.confirmed, false);
  assert.equal(invalidated.record.lifecycleState, 'archived');
});

test('PM3.4: confirmation policy rejects unverified candidate and illegal state transition', async () => {
  const unverifiedStore = memoryStore(candidate({ trust: 'unverified' }));
  await assert.rejects(
    () => control(unverifiedStore).confirm({ memoryId: unverifiedStore.current().memoryId, projectKey: 'sg2.1', actionContext: context() }),
    (error) => error.code === 'project-memory-confirmation-transition-denied'
  );

  const confirmedStore = memoryStore(candidate({ confirmed: true, confirmationState: 'confirmed', lifecycleState: 'active' }));
  await assert.rejects(
    () => control(confirmedStore).confirm({ memoryId: confirmedStore.current().memoryId, projectKey: 'sg2.1', actionContext: context() }),
    (error) => error.code === 'project-memory-confirmation-transition-denied'
  );
});

test('PM3.4: correction cannot smuggle authority or secret fields through Monarch control', async () => {
  for (const fact of [{ roles: ['owner'] }, { api_key: 'secret-value' }]) {
    const store = memoryStore();
    await assert.rejects(
      () => control(store).correct({
        memoryId: store.current().memoryId,
        projectKey: 'sg2.1',
        actionContext: context(),
        correction: { fact }
      }),
      (error) => ['project-memory-authority-field-rejected', 'project-memory-secret-field-rejected'].includes(error.code)
    );
  }
});
