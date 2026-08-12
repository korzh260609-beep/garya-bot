import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceRuntimeWiring } from '../src/telegramWorkspace/telegramWorkspaceRuntimeWiring.js';

function fixture(initialRows = []) {
  let rows = initialRows;
  const runtimeCalls = [];
  const listCalls = [];
  const runtime = Object.freeze({
    async handle(input) {
      runtimeCalls.push(input);
      return Object.freeze({ status: 'success', message: 'runtime-ok' });
    }
  });
  const workspaceRegistry = Object.freeze({
    async resolveTelegramChatId(chatId) {
      return String(chatId) === '-100123' ? Object.freeze({ workspaceId: 'tgw_runtime10', telegramChatId: '-100123' }) : null;
    }
  });
  const workspaceStore = Object.freeze({
    async listConfigs({ workspaceId }) {
      listCalls.push(workspaceId);
      return rows;
    }
  });
  return {
    wiring: createTelegramWorkspaceRuntimeWiring({ runtime, workspaceRegistry, workspaceStore }),
    runtimeCalls,
    listCalls,
    setRows(next) { rows = next; }
  };
}

function row(namespace, config) {
  return Object.freeze({ namespace, config: Object.freeze({ ...config }) });
}

function canonicalInput(overrides = {}) {
  return Object.freeze({
    text: 'hello',
    locale: 'en',
    identityContext: Object.freeze({ globalUserId: 'usr_runtime10' }),
    scopeContext: Object.freeze({ projectScope: 'sg2.1', groupScope: '-100123', threadScope: null }),
    traceContext: Object.freeze({ traceId: 'trace-runtime10', requestId: 'request-runtime10', environment: 'test', revision: 'test' }),
    metadata: Object.freeze({ transport: 'telegram', ...(overrides.metadata ?? {}) }),
    ...overrides
  });
}

test('TWM1.10 resolves persisted workspace policy and propagates bounded namespaces', async () => {
  const fx = fixture([
    row('responses', { mode: 'all', reply_enabled: true }),
    row('memory', { enabled: false }),
    row('ai', { enabled: true }),
    row('moderation', { enabled: false, spam: { enabled: false } }),
    row('publication', { enabled: true, preview_before_publish: true }),
    row('automation', { enabled: false }),
    row('notifications', { enabled: true }),
    row('members', { enabled: true })
  ]);

  const policy = await fx.wiring.resolvePolicyByTelegramChatId('-100123');
  assert.equal(policy.version, 'twm1.10');
  assert.equal(policy.workspaceId, 'tgw_runtime10');
  assert.equal(policy.responseMode, 'all');
  assert.equal(policy.workspaceMemoryEnabled, false);
  assert.equal(policy.aiEnabled, true);
  assert.equal(policy.moderation.enabled, false);
  assert.equal(policy.publication.preview_before_publish, true);
  assert.equal(policy.automation.enabled, false);
  assert.equal(policy.notifications.enabled, true);
  assert.equal(policy.members.enabled, true);
  assert.deepEqual(fx.listCalls, ['tgw_runtime10']);
});

test('TWM1.10 response mode off rejects an otherwise accepted Telegram invocation', async () => {
  const fx = fixture([row('responses', { mode: 'off' })]);
  const decision = await fx.wiring.evaluateInvocation({
    update: { message: { chat: { id: -100123, type: 'supergroup' } } },
    baseInvocation: Object.freeze({ accepted: true, reason: 'mention' })
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, 'workspace-responses-off');
  assert.equal(decision.workspaceRuntimePolicy.workspaceId, 'tgw_runtime10');
});

test('TWM1.10 response mode all admits only ordinary ambient group traffic rejected by base invocation', async () => {
  const fx = fixture([row('responses', { mode: 'all' })]);
  const admitted = await fx.wiring.evaluateInvocation({
    update: { message: { chat: { id: -100123, type: 'group' } } },
    baseInvocation: Object.freeze({ accepted: false, reason: 'ambient-group-message' })
  });
  assert.equal(admitted.accepted, true);
  assert.equal(admitted.reason, 'workspace-response-mode-all');

  const unrelated = await fx.wiring.evaluateInvocation({
    update: { message: { chat: { id: -100123, type: 'group' } } },
    baseInvocation: Object.freeze({ accepted: false, reason: 'unsupported-update' })
  });
  assert.equal(unrelated.accepted, false);
  assert.equal(unrelated.reason, 'unsupported-update');
});

test('TWM1.10 AI disabled fails closed before the underlying SG runtime', async () => {
  const fx = fixture([row('ai', { enabled: false })]);
  const result = await fx.wiring.handle(canonicalInput());
  assert.equal(result.status, 'success');
  assert.equal(result.data.reason, 'workspace-ai-disabled');
  assert.equal(result.data.workspaceId, 'tgw_runtime10');
  assert.equal(fx.runtimeCalls.length, 0);
});

test('TWM1.10 enabled runtime receives immutable workspace policy metadata', async () => {
  const fx = fixture([row('memory', { enabled: false }), row('ai', { enabled: true })]);
  const result = await fx.wiring.handle(canonicalInput());
  assert.equal(result.message, 'runtime-ok');
  assert.equal(fx.runtimeCalls.length, 1);
  const delivered = fx.runtimeCalls[0];
  assert.equal(delivered.metadata.workspaceRuntimePolicy.workspaceId, 'tgw_runtime10');
  assert.equal(delivered.metadata.workspaceRuntimePolicy.workspaceMemoryEnabled, false);
  assert.equal(Object.isFrozen(delivered.metadata.workspaceRuntimePolicy), true);
});

test('TWM1.10 reads persisted configuration on every request instead of caching stale workspace state', async () => {
  const fx = fixture([row('responses', { mode: 'mention_only' })]);
  const first = await fx.wiring.resolvePolicyByTelegramChatId('-100123');
  assert.equal(first.responseMode, 'mention_only');

  fx.setRows([row('responses', { mode: 'off' })]);
  const second = await fx.wiring.resolvePolicyByTelegramChatId('-100123');
  assert.equal(second.responseMode, 'off');
  assert.deepEqual(fx.listCalls, ['tgw_runtime10', 'tgw_runtime10']);
});

test('TWM1.10 leaves unmanaged Telegram chats on the existing SG runtime path', async () => {
  const fx = fixture([]);
  const input = canonicalInput({ scopeContext: Object.freeze({ projectScope: 'sg2.1', groupScope: '-999', threadScope: null }) });
  const result = await fx.wiring.handle(input);
  assert.equal(result.message, 'runtime-ok');
  assert.equal(fx.runtimeCalls.length, 1);
  assert.equal(fx.runtimeCalls[0], input);
});
