import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';
import { createInternalEventBus } from '../src/events/internalEventBus.js';
import { createDeliveryRouter, createDeliveryTransportRegistry } from '../src/delivery/deliveryRouter.js';
import { createDefaultContractVersioning } from '../src/contracts/contractVersioning.js';
import { createVersionedCapabilityExecutor } from '../src/contracts/versionedCapabilityExecutor.js';
import { createFeatureFlagService, createInMemoryFeatureFlagStore } from '../src/features/featureFlags.js';
import { createFeatureFlaggedCapabilityExecutor } from '../src/features/featureFlaggedCapabilityExecutor.js';
import { createDomainRegistry } from '../src/domains/domainRegistry.js';
import { createDomainRuntime } from '../src/domains/domainRuntime.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

function strictObservability() {
  const store = createInMemoryObservabilityStore();
  return { store, observability: createObservabilityService({ store, idFactory: (() => { let n = 0; return () => `audit-${++n}`; })() }) };
}

test('audit regression: operational observability classes normalize through the strict canonical contract', () => {
  const { store, observability } = strictObservability();
  const delivery = observability.record({ eventClass: 'delivery_attempt', stage: 'delivery-router', outcome: 'delivered', traceContext: { traceId: 't1', requestId: 'r1' }, data: { transport: 'telegram' } });
  const system = observability.record({ eventClass: 'system_event', eventType: 'internal_event_published', traceContext: null, data: { internalEventType: 'task.completed' } });
  const feature = observability.record({ eventClass: 'feature_flag_resolved', channel: 'telemetry', stage: 'feature-flags', outcome: 'disabled', traceContext: null, data: { featureId: 'capability:test' } });
  assert.equal(delivery.eventClass, 'audit_event');
  assert.equal(system.eventClass, 'audit_event');
  assert.equal(feature.eventClass, 'feature_flag_resolved');
  assert.equal(delivery.traceContext.environment, 'unknown');
  assert.equal(system.traceContext.revision, 'unknown');
  assert.equal(store.list({}).length, 3);
});

test('audit regression: Internal Event Bus works with the real strict ObservabilityService', async () => {
  const { store, observability } = strictObservability();
  const bus = createInternalEventBus({ observability, idFactory: () => 'strict-event' });
  const result = await bus.publish({
    eventType: 'task.completed',
    version: '1.0',
    traceContext: { traceId: 'trace-event', requestId: 'request-event' },
    scope: { globalUserId: 'user:1', projectScope: 'sg2.1', groupScope: null, threadScope: null, resourceId: null },
    actorGlobalUserId: 'user:1', privacyClass: 'internal', provenance: { source: 'audit-regression' }, payload: { taskId: 'task:1', status: 'completed' }
  });
  assert.equal(result.event.eventId, 'event:strict-event');
  const recorded = store.list({}).find((event) => event.data.internalEventType === 'task.completed');
  assert.ok(recorded);
  assert.equal(recorded.eventClass, 'audit_event');
});

test('audit regression: Delivery Router works with the real strict ObservabilityService', async () => {
  const { store, observability } = strictObservability();
  const transportRegistry = createDeliveryTransportRegistry({ transports: [{ name: 'telegram', deliver: async () => ({ messageId: 'delivered' }) }] });
  const router = createDeliveryRouter({ observability, transportRegistry });
  const result = await router.route({
    kind: 'current-response', actorGlobalUserId: 'user:1', recipientGlobalUserId: 'user:1', projectScope: 'sg2.1', message: 'hello',
    originTarget: { transport: 'telegram', address: 'chat:1' }, idempotencyKey: 'audit-delivery', traceContext: { traceId: 'delivery-trace', requestId: 'delivery-request' }
  });
  assert.equal(result.status, 'delivered');
  assert.ok(store.list({}).some((event) => event.eventClass === 'audit_event' && event.data.operationalEventClass === 'delivery_attempt'));
});

test('audit regression: Contract Versioning observability accepts bounded trace and still rejects unknown future versions', async () => {
  const { store, observability } = strictObservability();
  const versions = createDefaultContractVersioning({ observability, idFactory: () => 'q-regression' });
  const current = await versions.resolve('task-payload', { version: '1.0', globalUserId: 'user:1', projectScope: 'sg2.1', payload: { kind: 'safe' } }, { traceContext: { traceId: 't2', requestId: 'r2' }, source: 'audit-regression' });
  assert.equal(current.status, 'current');
  await assert.rejects(() => versions.resolve('task-payload', { version: '9.0', payload: {} }), /unsupported task-payload version/);
  assert.ok(store.list({}).some((event) => event.data.operationalEventType === 'contract_version_resolved'));
});

test('audit regression: capability contract version is enforced before execution', async () => {
  let called = 0;
  const versions = createDefaultContractVersioning();
  const executor = createVersionedCapabilityExecutor({ executor: { async execute() { called += 1; return { status: 'success' }; } }, contractVersioning: versions });
  const actionRequest = {
    actor: { globalUserId: 'user:1' },
    scope: { userScope: 'user:1', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    payload: { contractVersion: '2.0', value: 1 },
    traceContext: { traceId: 't3', requestId: 'r3' }
  };
  await assert.rejects(() => executor.execute({ actionRequest, traceContext: actionRequest.traceContext }), /unsupported capability-input version/);
  assert.equal(called, 0);
});

test('audit regression: disabled feature execution returns canonical CapabilityResult', async () => {
  const flagStore = createInMemoryFeatureFlagStore();
  const featureFlags = createFeatureFlagService({ store: flagStore });
  await featureFlags.setFlag({ featureId: 'capability:compose-answer', enabled: false });
  let delegated = 0;
  const executor = createFeatureFlaggedCapabilityExecutor({ executor: { async execute() { delegated += 1; return null; } }, featureFlags });
  const actionRequest = { capability: 'compose-answer', actor: { globalUserId: 'user:1', roles: ['monarch'] }, scope: { userScope: 'user:1', projectScope: 'sg2.1' }, payload: {}, traceContext: { traceId: 'feature-trace', requestId: 'feature-request' } };
  const result = await executor.execute({ actionRequest, gateDecision: { outcome: 'allow', authorized: true, checks: { permission: true, resourceAuthority: true } }, traceContext: { traceId: 'feature-trace', requestId: 'feature-request', environment: 'test', revision: 'audit' } });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error.code, 'feature-disabled');
  assert.equal(typeof result.error.message, 'string');
  assert.deepEqual(result.attempts, []);
  assert.equal(result.traceContext.traceId, 'feature-trace');
  assert.equal(delegated, 0);
});

test('audit regression: protected domain cannot reuse an analysis-only GateDecision', async () => {
  const registry = createDomainRegistry([{ id: 'audit', version: '1.0.0', description: 'Protected domain fixture.', capabilities: [{ name: 'audit.execute', actionClass: 'protected', requiredPermissions: ['audit.execute'], sourceRequirements: [], memoryLayers: [], handler: async () => ({ ok: true }) }] }]);
  const runtime = createDomainRuntime({ registry, sourceResolver: async () => ({ available: [], data: null }), memoryResolver: async () => ({ data: null }) });
  const scope = { userScope: 'user:1', projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const base = { domainId: 'audit', capability: 'audit.execute', input: {}, identityContext: { globalUserId: 'user:1', grants: ['audit.execute'] }, scopeContext: scope, traceContext: { traceId: 'protected-trace', requestId: 'protected-request', environment: 'test', revision: 'audit' } };
  await assert.rejects(() => runtime.execute({ ...base, gateDecision: { outcome: 'allow', authorized: true, actionRequest: { actor: { globalUserId: 'user:1' }, scope, actionClass: 'analysis-only' } } }), /domain action gate denied/);
  const result = await runtime.execute({ ...base, gateDecision: { outcome: 'allow', authorized: true, actionRequest: { actor: { globalUserId: 'user:1' }, scope, actionClass: 'state-changing' } } });
  assert.equal(result.status, 'success');
  assert.equal(result.actionClass, 'state-changing');
});

test('audit regression: production harness wires Event Bus, Contract Versioning and Domain Runtime as live components', async () => {
  const harness = createLocalProductionHarness({ env: { SG_PERSISTENCE_MODE: 'memory' } });
  assert.equal(typeof harness.eventBus.publish, 'function');
  assert.equal(typeof harness.contractVersioning.resolve, 'function');
  assert.equal(typeof harness.domainRuntime.execute, 'function');
  assert.ok(harness.domainPermissions.includes('psychology.use'));

  const scope = { userScope: 'local:developer', projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const domainResult = await harness.domainRuntime.execute({
    domainId: 'psychology', capability: 'psychology.support', input: { topic: 'test' },
    identityContext: { globalUserId: 'local:developer', roles: ['monarch'], grants: ['psychology.use'] }, scopeContext: scope,
    traceContext: { traceId: 'domain-trace', requestId: 'domain-request', environment: 'test', revision: 'audit' },
    gateDecision: { outcome: 'allow', authorized: true, actionRequest: { actor: { globalUserId: 'local:developer' }, scope, actionClass: 'analysis-only' } }
  });
  assert.equal(domainResult.status, 'success');
  assert.equal(domainResult.actionClass, 'analysis-only');

  await assert.rejects(() => harness.domainRuntime.execute({
    domainId: 'psychology', capability: 'psychology.support', input: { topic: 'test' },
    identityContext: { globalUserId: 'local:developer', grants: ['psychology.use'] }, scopeContext: scope,
    traceContext: { traceId: 'domain-trace-2', requestId: 'domain-request-2', environment: 'test', revision: 'audit' },
    gateDecision: { outcome: 'allow', authorized: true, actionRequest: { actor: { globalUserId: 'other-user' }, scope, actionClass: 'analysis-only' } }
  }), /domain action gate denied/);
});
