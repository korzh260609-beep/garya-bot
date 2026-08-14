import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_CONTRACTS,
  ContractVersionError,
  createContractVersioningRegistry,
  createDefaultContractVersioning,
  createInMemoryContractQuarantineStore
} from '../src/contracts/contractVersioning.js';
import { createInternalEventBus } from '../src/events/internalEventBus.js';

test('Block 16.15 declares an explicit compatibility policy for every critical contract', () => {
  const registry = createDefaultContractVersioning();
  assert.equal(CRITICAL_CONTRACTS.length, 10);
  for (const contractName of CRITICAL_CONTRACTS) {
    const policy = registry.getPolicy(contractName);
    assert.equal(policy.currentVersion, '1.0');
    assert.deepEqual(policy.supportedVersions, ['1.0','0.9']);
    assert.equal(policy.forwardCompatibility, 'reject-unknown-newer-version');
    assert.equal(policy.backwardCompatibility, 'explicit-adapter-only');
    assert.equal(policy.unsupportedBehavior, 'reject-or-quarantine');
  }
});

test('Block 16.15 migrates one deterministic prior-version fixture per critical contract', async () => {
  const registry = createDefaultContractVersioning();
  for (const contractName of CRITICAL_CONTRACTS) {
    const oldRecord = {
      version: '0.9',
      globalUserId: 'user:1',
      projectScope: 'sg2.1',
      resourceId: 'resource:1',
      payload: { sample: contractName }
    };
    const resolved = await registry.resolve(contractName, oldRecord);
    assert.equal(resolved.status, 'adapted');
    assert.equal(resolved.sourceVersion, '0.9');
    assert.equal(resolved.currentVersion, '1.0');
    assert.equal(resolved.record.version, '1.0');
    assert.equal(resolved.record.globalUserId, oldRecord.globalUserId);
    assert.equal(resolved.record.projectScope, oldRecord.projectScope);
    assert.equal(resolved.record.resourceId, oldRecord.resourceId);
    assert.deepEqual(resolved.record.payload, oldRecord.payload);
  }
});

test('Block 16.15 rejects unknown newer versions instead of guessing', async () => {
  const registry = createDefaultContractVersioning();
  await assert.rejects(
    () => registry.resolve('task-payload', { version: '2.0', taskId: 'task:future' }),
    (error) => error instanceof ContractVersionError && error.code === 'contract-version-unsupported'
  );
});

test('Block 16.15 can quarantine unsupported durable payloads visibly', async () => {
  const quarantineStore = createInMemoryContractQuarantineStore();
  const registry = createDefaultContractVersioning({ quarantineStore, idFactory: () => 'q1', clock: () => new Date('2026-08-08T18:00:00.000Z') });
  const result = await registry.resolve('domain-data', { version: '7.0', domain: 'future' }, {
    quarantineUnsupported: true,
    source: 'durable-domain-record',
    traceContext: { traceId: 'trace:1' }
  });
  assert.equal(result.status, 'quarantined');
  assert.equal(result.quarantine.reason, 'contract-version-unsupported');
  assert.equal(result.quarantine.contractName, 'domain-data');
  assert.equal((await quarantineStore.list()).length, 1);
});

test('Block 16.15 requires an explicit adapter for supported old versions', async () => {
  const registry = createContractVersioningRegistry();
  registry.register({ contractName: 'example', currentVersion: '1.0', supportedVersions: ['0.9'] });
  await assert.rejects(
    () => registry.resolve('example', { version: '0.9', value: 1 }),
    (error) => error instanceof ContractVersionError && error.code === 'contract-adapter-missing'
  );
});

test('Block 16.15 adapters cannot broaden permission, scope, trust or resource authority fields', async () => {
  const registry = createContractVersioningRegistry();
  registry.register({
    contractName: 'unsafe-example',
    currentVersion: '1.0',
    supportedVersions: ['0.9'],
    adapters: {
      '0.9': (record) => ({ ...record, version: '1.0', permissions: ['admin'] })
    }
  });
  await assert.rejects(
    () => registry.resolve('unsafe-example', { version: '0.9', permissions: ['read'], projectScope: 'sg2.1' }),
    (error) => error instanceof ContractVersionError && error.code === 'contract-adapter-protected-field-change'
  );
});

test('Block 16.15 deprecated versions remain readable only through explicit migration', async () => {
  const registry = createDefaultContractVersioning();
  const policy = registry.getPolicy('memory-record');
  assert.equal(policy.deprecatedVersions['0.9'].status, 'deprecated');
  const resolved = await registry.resolve('memory-record', { version: '0.9', globalUserId: 'user:1', projectScope: 'sg2.1', fact: 'x' });
  assert.equal(resolved.deprecated, true);
  assert.equal(resolved.record.version, '1.0');
});

test('Block 16.15 approved old event fixtures migrate and replay through the current event contract', async () => {
  const registry = createDefaultContractVersioning();
  const oldEvent = {
    version: '0.9',
    eventId: 'event:legacy-1',
    eventType: 'task.completed',
    traceContext: { traceId: 'trace:legacy', requestId: 'request:legacy', environment: 'test', revision: 'legacy' },
    scope: { globalUserId: 'user:1', projectScope: 'sg2.1', groupScope: null, threadScope: null, resourceId: null },
    actorGlobalUserId: 'user:1',
    privacyClass: 'internal',
    provenance: { source: 'legacy-fixture' },
    payload: { taskId: 'task:1', status: 'completed' }
  };
  const migrated = await registry.resolve('internal-event', oldEvent);
  let calls = 0;
  const bus = createInternalEventBus();
  await bus.subscribe({ subscriberId: 'legacy-reader', eventTypes: ['task.completed'], mode: 'sync' }, async () => { calls += 1; });
  const replay = await bus.publish(migrated.record);
  assert.equal(replay.event.version, '1.0');
  assert.equal(replay.event.eventId, 'event:legacy-1');
  assert.equal(calls, 1);
});

test('Block 16.15 task migration preserves authorization-sensitive fields for current safety checks', async () => {
  const registry = createDefaultContractVersioning();
  const legacyTask = {
    version: '0.9',
    taskId: 'task:legacy',
    globalUserId: 'user:1',
    projectScope: 'sg2.1',
    permissions: ['task.execute'],
    scope: { projectScope: 'sg2.1', globalUserId: 'user:1' },
    authorityEvidence: { resourceId: 'resource:1', relation: 'can_modify' },
    payload: { action: 'run' }
  };
  const migrated = await registry.resolve('task-payload', legacyTask);
  assert.deepEqual(migrated.record.permissions, legacyTask.permissions);
  assert.deepEqual(migrated.record.scope, legacyTask.scope);
  assert.deepEqual(migrated.record.authorityEvidence, legacyTask.authorityEvidence);
});
