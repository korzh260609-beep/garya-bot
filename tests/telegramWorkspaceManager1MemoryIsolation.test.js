import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemory2Capabilities } from '../src/memory2/memory2Capabilities.js';
import { createProductionRuntime } from '../src/runtime/createProductionRuntime.js';

function capabilityFixture() {
  const calls = { write: [], recall: [], promote: [] };
  const memory2Service = {
    async write(input) { calls.write.push(input); return { status: 'written', record: { id: 'mem-1' }, conflictIds: [] }; },
    async recall(input) { calls.recall.push(input); return { records: [], conflicts: [], diagnostics: { returnedCount: 0 } }; },
    async diagnostics() { return { ok: true }; },
    async promote(input) { calls.promote.push(input); return { status: 'written', record: { id: 'mem-2' }, conflictIds: [] }; },
    async confirm() { return null; },
    async archive() { return null; },
    async inspect() { return null; }
  };
  const capabilities = createMemory2Capabilities({ memory2Service });
  return { calls, byName: (name) => capabilities.find((item) => item.name === name) };
}

function memoryRequest(input = {}) {
  return {
    input,
    scope: { userScope: 'usr_a', projectScope: 'sg2.1', groupScope: '-100123', threadScope: null },
    actor: { globalUserId: 'usr_a', roles: ['manager'], grants: ['memory:group:write'], authenticationLevel: 'verified' },
    traceContext: { traceId: 'trace-memory-isolation', requestId: 'request-memory-isolation' },
    resourceAuthority: { allowed: true }
  };
}

const memoryOff = Object.freeze({ version: 'twm1.10', workspaceId: 'tgw_runtime10', workspaceMemoryEnabled: false });

test('TWM1.10 workspace memory off blocks explicit shared writes but preserves personal writes', async () => {
  const fx = capabilityFixture();
  const write = fx.byName('memory2-write');

  const denied = await write.execute(memoryRequest({ key: 'shared-rule', value: 'x', scopeKind: 'group', shared: true, workspaceRuntimePolicy: memoryOff }));
  assert.equal(denied.status, 'failed');
  assert.equal(denied.error.code, 'workspace-memory-disabled');
  assert.equal(fx.calls.write.length, 0);

  const personal = await write.execute(memoryRequest({ key: 'personal-note', value: 'x', scopeKind: 'user-group', shared: false, workspaceRuntimePolicy: memoryOff }));
  assert.equal(personal.status, 'success');
  assert.equal(fx.calls.write.length, 1);
  assert.equal(fx.calls.write[0].scopeKind, 'user-group');
});

test('TWM1.10 workspace memory off strips group/thread recall and fails closed for shared-only recall', async () => {
  const fx = capabilityFixture();
  const recall = fx.byName('memory2-recall');

  await recall.execute(memoryRequest({ query: 'memory', layers: [], workspaceRuntimePolicy: memoryOff }));
  assert.deepEqual(fx.calls.recall[0].layers, ['user-memory', 'user-group-memory', 'project-memory']);

  const sharedOnly = await recall.execute(memoryRequest({ query: 'rule', layers: ['group-memory', 'thread-memory'], workspaceRuntimePolicy: memoryOff }));
  assert.equal(sharedOnly.status, 'success');
  assert.equal(sharedOnly.data.records.length, 0);
  assert.equal(sharedOnly.data.diagnostics.suppressedSharedMemory, true);
  assert.equal(fx.calls.recall.length, 1);
});

test('TWM1.10 workspace memory off blocks promotion into shared group/thread memory', async () => {
  const fx = capabilityFixture();
  const promote = fx.byName('memory2-promote');
  const denied = await promote.execute(memoryRequest({ memoryId: 'mem-personal', targetScopeKind: 'group', workspaceRuntimePolicy: memoryOff }));
  assert.equal(denied.status, 'failed');
  assert.equal(denied.error.code, 'workspace-memory-disabled');
  assert.equal(fx.calls.promote.length, 0);
});

test('TWM1.10 workspace memory off suppresses automatic capture before Memory 2.0 persistence', async () => {
  let captureCalls = 0;
  const runtime = createProductionRuntime({
    config: { environment: 'test', revision: 'twm1.10-memory-isolation', shutdownTimeoutMs: 1000 },
    semanticPipeline: {
      async process(input) {
        return {
          decisionEnvelope: {
            traceId: input.traceContext.traceId,
            requestId: input.traceContext.requestId,
            decisionType: 'respond',
            intent: 'answer',
            selectedAction: { type: 'answer', name: 'compose-answer', actionClass: 'analysis' }
          },
          responsePlan: { message: 'ok' }
        };
      }
    },
    actionGate: {
      evaluate() { return { outcome: 'require-confirmation', authorized: false, reasons: ['test-stop'], checks: { resourceAuthority: null } }; }
    },
    capabilityExecutor: { async execute() { throw new Error('must not execute'); } },
    observability: { record() {}, recordFailure() {} },
    memoryCaptureService: {
      async capture() { captureCalls += 1; return { status: 'written', persisted: true }; }
    }
  });
  await runtime.start();
  try {
    const response = await runtime.handle({
      text: 'Мы решили сохранить это правило',
      locale: 'ru',
      identityContext: { globalUserId: 'usr_a', roles: ['manager'], grants: [], authenticationLevel: 'verified' },
      scopeContext: { userScope: 'usr_a', projectScope: 'sg2.1', groupScope: '-100123', threadScope: null, allowedCapabilities: [] },
      traceContext: { traceId: 'trace-capture-off', requestId: 'request-capture-off' },
      metadata: { transport: 'telegram', workspaceRuntimePolicy: memoryOff }
    });
    assert.equal(response.data.memoryCapture.status, 'suppressed');
    assert.equal(response.data.memoryCapture.reason, 'workspace-memory-disabled');
    assert.equal(response.data.memoryCapture.persisted, false);
    assert.equal(captureCalls, 0);
  } finally {
    await runtime.stop();
  }
});
