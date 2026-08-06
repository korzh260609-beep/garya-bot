import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapability, createCapabilityExecutionRequest } from '../src/contracts/capability.js';
import { createCapabilityRegistry } from '../src/capability/capabilityRegistry.js';
import { createCapabilityExecutor } from '../src/capability/capabilityExecutor.js';

function actionRequest(overrides = {}) {
  return Object.freeze({
    capability: 'read-project', actionType: 'read', actionClass: 'read-only', payload: { id: 1 },
    actor: {}, scope: {}, requiredPermission: 'capability:read-project', requiredSources: [], requiredTools: [], traceContext: { traceId: 'trace-1', requestId: 'request-1' }, ...overrides
  });
}
function gate(action = actionRequest()) {
  return Object.freeze({ outcome: 'allow', authorized: true, actionRequest: action });
}
function capability(overrides = {}) {
  return createCapability({ name: 'read-project', actionTypes: ['read'], actionClasses: ['read-only'], execute: async () => ({ data: { ok: true } }), ...overrides });
}

test('validates capability safety and execution metadata', () => {
  const item = capability({ requiredPermissions: ['project:read'], requiredSources: ['github'], requiredTools: ['reader'], timeoutMs: 100, maxRetries: 1 });
  assert.equal(item.name, 'read-project');
  assert.deepEqual(item.requiredSources, ['github']);
  assert.equal(item.maxRetries, 1);
});

test('registry rejects duplicate names', () => {
  const registry = createCapabilityRegistry({ capabilities: [capability()] });
  assert.throws(() => registry.register(capability()), /already registered/);
});

test('discovery selects exact capability deterministically', () => {
  const registry = createCapabilityRegistry({ capabilities: [
    capability({ name: 'generic-reader', priority: 50 }),
    capability({ name: 'read-project', priority: 0 })
  ] });
  assert.equal(registry.discover(actionRequest())[0].capability.name, 'read-project');
});

test('execution is blocked without allowed GateDecision', async () => {
  const request = actionRequest();
  const executor = createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [capability()] }) });
  await assert.rejects(() => executor.execute({ actionRequest: request, gateDecision: { outcome: 'deny', authorized: false, actionRequest: request } }), /allowed GateDecision/);
});

test('execution request preserves scope, trace and payload', () => {
  const request = actionRequest();
  const execution = createCapabilityExecutionRequest({ capability: capability(), actionRequest: request, gateDecision: gate(request) });
  assert.deepEqual(execution.input, { id: 1 });
  assert.equal(execution.traceContext.traceId, 'trace-1');
});

test('normalizes successful result with source and tool metadata', async () => {
  const item = capability({ requiredSources: ['github'], requiredTools: ['reader'] });
  const request = actionRequest({ requiredSources: ['github'], requiredTools: ['reader'] });
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [item] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.sources, ['github']);
  assert.deepEqual(result.tools, ['reader']);
});

test('preserves partial results and warnings', async () => {
  const item = capability({ execute: async () => ({ status: 'partial', data: { found: 2 }, warnings: ['one-source-unavailable'] }) });
  const request = actionRequest();
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [item] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.warnings, ['one-source-unavailable']);
});

test('bounded retry stops after configured attempts', async () => {
  let calls = 0;
  const item = capability({ maxRetries: 2, execute: async () => { calls += 1; const error = new Error('temporary'); error.retryable = true; throw error; } });
  const request = actionRequest();
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [item] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'failed');
  assert.equal(calls, 3);
  assert.equal(result.attempts.length, 3);
});

test('timeout becomes explicit result', async () => {
  const item = capability({ timeoutMs: 10, execute: async () => new Promise(() => {}) });
  const request = actionRequest();
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [item] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'timeout');
  assert.equal(result.error.code, 'capability-timeout');
});

test('fallback capability executes after primary failure', async () => {
  const primary = capability({ fallbackCapabilities: ['backup-reader'], execute: async () => { throw new Error('primary failed'); } });
  const backup = capability({ name: 'backup-reader', priority: -1, execute: async () => ({ data: { from: 'backup' } }) });
  const request = actionRequest();
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [primary, backup] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'success');
  assert.equal(result.capability, 'backup-reader');
  assert.equal(result.fallbackUsed, 'backup-reader');
  assert.equal(result.attempts.length, 2);
});

test('missing capability returns visible unavailable result', async () => {
  const request = actionRequest({ capability: 'missing' });
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry() }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error.code, 'capability-unavailable');
});

test('rejects capability requirements that were not authorized by Action Gate', async () => {
  const item = capability({ requiredSources: ['private-source'] });
  const request = actionRequest({ requiredSources: [] });
  const result = await createCapabilityExecutor({ registry: createCapabilityRegistry({ capabilities: [item] }) }).execute({ actionRequest: request, gateDecision: gate(request) });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error.code, 'capability-requirements-not-authorized');
});
