import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltInDomainModules, createDomainRegistry, createDomainRuntime } from '../src/domains/index.js';

function fixture(overrides = {}) {
  const gates = [];
  const sourceCalls = [];
  const memoryCalls = [];
  const events = [];
  const registry = createDomainRegistry(createBuiltInDomainModules(overrides.handlers));
  const runtime = createDomainRuntime({
    registry,
    actionGate: async (request) => { gates.push(request); return { allowed: true }; },
    sourceResolver: async (request) => { sourceCalls.push(request); return { available: request.requirements, data: { evidence: request.requirements } }; },
    memoryResolver: async (request) => { memoryCalls.push(request); return { data: { layers: request.layers } }; },
    onEvent: (event) => events.push(event),
    ...overrides
  });
  return { registry, runtime, gates, sourceCalls, memoryCalls, events };
}

function request(overrides = {}) {
  return {
    domainId: 'documents',
    capability: 'documents.analyze',
    input: { documentId: 'doc-1' },
    identityContext: { globalUserId: 'global:user-1', permissions: ['documents.read'] },
    scopeContext: { userScope: 'global:user-1', projectScope: 'project-1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-1', requestId: 'request-1' },
    ...overrides
  };
}

test('registers all roadmap candidate domains as replaceable modules', () => {
  const f = fixture();
  assert.deepEqual(f.registry.list().map((domain) => domain.id), ['documents', 'repository', 'market', 'billing', 'psychology', 'kingdom']);
  for (const domain of f.registry.list()) {
    assert.equal(domain.replaceable, true);
    assert.equal(domain.ownsSemanticKernel, false);
    assert.equal(domain.ownsIdentity, false);
    assert.equal(domain.ownsActionGate, false);
    assert.equal(domain.ownsTrustOrder, false);
  }
});

test('executes domain capability through source memory and gate contracts', async () => {
  const f = fixture();
  const result = await f.runtime.execute(request());
  assert.equal(result.status, 'success');
  assert.equal(result.domainId, 'documents');
  assert.equal(result.capability, 'documents.analyze');
  assert.equal(f.sourceCalls.length, 1);
  assert.deepEqual(f.sourceCalls[0].requirements, ['documents']);
  assert.equal(f.memoryCalls.length, 1);
  assert.deepEqual(f.memoryCalls[0].layers, ['project']);
  assert.equal(f.gates.length, 1);
  assert.equal(f.gates[0].domainRequest, true);
  assert.equal(f.events[0].type, 'domain.execution.started');
  assert.equal(f.events[1].type, 'domain.execution.completed');
});

test('preserves identity scope and trace boundaries for every dependency', async () => {
  const f = fixture();
  const input = request();
  await f.runtime.execute(input);
  for (const call of [f.sourceCalls[0], f.memoryCalls[0], f.gates[0]]) {
    assert.equal(call.identityContext.globalUserId, 'global:user-1');
    assert.equal(call.scopeContext.projectScope, 'project-1');
    assert.equal(call.traceContext.traceId, 'trace-1');
  }
});

test('fails closed when permission is missing', async () => {
  const f = fixture();
  await assert.rejects(() => f.runtime.execute(request({ identityContext: { globalUserId: 'global:user-1', permissions: [] } })), /permission denied/);
  assert.equal(f.gates.length, 0);
  assert.equal(f.sourceCalls.length, 0);
});

test('fails closed when required source is unavailable', async () => {
  const f = fixture({ sourceResolver: async () => ({ available: [], data: null }) });
  await assert.rejects(() => f.runtime.execute(request()), /source unavailable/);
  assert.equal(f.gates.length, 0);
});

test('Action Gate denial prevents protected domain execution', async () => {
  let called = 0;
  const f = fixture({
    handlers: { 'billing.payment.execute': async () => { called += 1; return { paid: true }; } },
    actionGate: async () => ({ allowed: false, reason: 'confirmation_required' })
  });
  await assert.rejects(() => f.runtime.execute(request({
    domainId: 'billing',
    capability: 'billing.payment.execute',
    input: { invoiceId: 'inv-1' },
    identityContext: { globalUserId: 'global:monarch', permissions: ['billing.execute'] }
  })), /confirmation_required/);
  assert.equal(called, 0);
});

test('prepare-only domain capability cannot claim state-changing behavior', () => {
  const f = fixture();
  const entry = f.registry.resolve('repository', 'repository.change.prepare');
  assert.equal(entry.capability.actionClass, 'prepare-only');
  assert.equal(entry.capability.stateChanging, false);
});

test('capabilities cannot escape their domain namespace', () => {
  assert.throws(() => createDomainRegistry([{
    id: 'bad',
    description: 'invalid module',
    capabilities: [{ name: 'other.action', handler: async () => null }]
  }]), /namespaced/);
});

test('same capability name cannot be used through another domain', () => {
  const f = fixture();
  assert.throws(() => f.registry.resolve('market', 'documents.analyze'), /not registered for domain/);
});

test('custom domain handlers remain injectable and replaceable', async () => {
  const f = fixture({ handlers: { 'psychology.support': async ({ input }) => ({ response: `support:${input.topic}` }) } });
  const result = await f.runtime.execute(request({
    domainId: 'psychology',
    capability: 'psychology.support',
    input: { topic: 'stress' },
    identityContext: { globalUserId: 'global:user-1', permissions: ['psychology.use'] }
  }));
  assert.deepEqual(result.data, { response: 'support:stress' });
});
