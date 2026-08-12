import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES,
  createTelegramWorkspaceConfigurationService,
  validateTelegramWorkspaceConfiguration
} from '../src/telegramWorkspace/index.js';

function memoryStore() {
  const configs = new Map();
  const histories = new Map();
  const key = (workspaceId, namespace) => `${workspaceId}:${namespace}`;
  return Object.freeze({
    async getConfig({ workspaceId, namespace }) { return configs.get(key(workspaceId, namespace)) ?? null; },
    async listConfigs({ workspaceId }) { return [...configs.values()].filter((row) => row.workspaceId === workspaceId); },
    async setConfig({ workspaceId, namespace, config, actorGlobalUserId, traceId, reason = null, expectedVersion = null }) {
      const k = key(workspaceId, namespace);
      const current = configs.get(k) ?? null;
      const version = current?.version ?? 0;
      if (expectedVersion !== null && Number(expectedVersion) !== version) {
        const error = new Error('version conflict');
        error.code = 'twm-workspace-config-version-conflict';
        throw error;
      }
      const next = Object.freeze({ workspaceId, namespace, config: structuredClone(config), version: version + 1, updatedByGlobalUserId: actorGlobalUserId, traceId, updatedAt: new Date().toISOString() });
      configs.set(k, next);
      const history = histories.get(k) ?? [];
      history.unshift(Object.freeze({ version: next.version, previous_config: current?.config ?? null, new_config: structuredClone(config), actor_global_user_id: actorGlobalUserId, trace_id: traceId, reason }));
      histories.set(k, history);
      return next;
    },
    async configHistory({ workspaceId, namespace, limit = 100 }) { return (histories.get(key(workspaceId, namespace)) ?? []).slice(0, limit); }
  });
}

function authority({ deniedUsers = new Set() } = {}) {
  const calls = [];
  return Object.freeze({
    calls,
    async verify(input) {
      calls.push(input);
      if (deniedUsers.has(input.expectedGlobalUserId)) return Object.freeze({ allowed: false, reason: 'twm-workspace-role-denied', workspaceRole: 'VIEWER' });
      return Object.freeze({ allowed: true, reason: 'twm-workspace-authority-verified', workspaceRole: 'OWNER', verificationTime: '2026-08-12T12:00:00.000Z' });
    }
  });
}

function permissiveMutationGate() {
  const calls = [];
  return Object.freeze({
    calls,
    async evaluateMutation(input) {
      calls.push(input);
      return Object.freeze({
        outcome: 'allow',
        reasons: Object.freeze([]),
        audit: Object.freeze({ gate: 'twm1.6-test-gate', traceId: input.traceId, requestId: input.requestId })
      });
    }
  });
}

function serviceFixture(options = {}) {
  const store = memoryStore();
  const auth = authority(options);
  const mutationGate = permissiveMutationGate();
  const auditEvents = [];
  const busEvents = [];
  const service = createTelegramWorkspaceConfigurationService({
    workspaceStore: store,
    authorityResolver: auth,
    mutationGate,
    eventBus: { async publish(event) { busEvents.push(event); return { event }; } },
    projectScope: 'sg2.1',
    environment: 'test',
    revision: 'twm1.7-test',
    idFactory: (() => { let i = 0; return () => `twc_test_${++i}`; })(),
    audit: async (event) => auditEvents.push(event)
  });
  return { store, auth, mutationGate, auditEvents, busEvents, service };
}

const actor = 'usr_twm16_owner';
const telegramUserId = '1001';
const workspaceId = 'tgw_twm160001';

test('TWM1.6 exposes exactly the canonical configuration-service namespaces and reserves later content namespaces', () => {
  assert.deepEqual(TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES, ['general','responses','moderation','memory','ai','publication','automation','notifications','members']);
  assert.doesNotThrow(() => validateTelegramWorkspaceConfiguration('responses', { enabled: true, mode: 'mention_only', reply_enabled: true }));
  assert.throws(() => validateTelegramWorkspaceConfiguration('content', { enabled: true }), (error) => error.code === 'twm-workspace-config-namespace-not-managed');
  assert.throws(() => validateTelegramWorkspaceConfiguration('polls', { enabled: true }), (error) => error.code === 'twm-workspace-config-namespace-not-managed');
  assert.throws(() => validateTelegramWorkspaceConfiguration('media', { enabled: true }), (error) => error.code === 'twm-workspace-config-namespace-not-managed');
});

test('TWM1.6 validates bounded JSON, known values and rejects secret-shaped fields', () => {
  assert.throws(() => validateTelegramWorkspaceConfiguration('responses', { enabled: 'yes' }), (error) => error.code === 'twm-workspace-config-schema-invalid');
  assert.throws(() => validateTelegramWorkspaceConfiguration('moderation', { warning_limit: 0 }), (error) => error.code === 'twm-workspace-config-schema-invalid');
  assert.throws(() => validateTelegramWorkspaceConfiguration('ai', { api_key: 'never-store' }), (error) => error.code === 'twm-workspace-config-secret-field-rejected');
  assert.throws(() => validateTelegramWorkspaceConfiguration('general', { note: 'x'.repeat(5000) }), (error) => error.code === 'twm-workspace-config-schema-invalid');
});

test('TWM1.6 proposal applies atomically with version, history, fresh authority and metadata-only events behind a mutation gate', async () => {
  const fx = serviceFixture();
  const proposal = await fx.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only', reply_enabled: true }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:twm16:v1', reason: 'setup responses' });
  assert.equal(proposal.baseVersion, 0);
  assert.equal(proposal.risk, 'low');
  assert.equal(proposal.confirmationRequired, false);
  assert.deepEqual(proposal.changedPaths, ['enabled', 'mode', 'reply_enabled']);

  const result = await fx.service.applyProposal({ proposal, actorGlobalUserId: actor, telegramUserId });
  assert.equal(result.config.version, 1);
  assert.equal(result.config.config.mode, 'mention_only');
  assert.equal(result.actionGate.outcome, 'allow');
  assert.equal(fx.mutationGate.calls.length, 1);
  assert.equal((await fx.service.history({ workspaceId, namespace: 'responses', actorGlobalUserId: actor, telegramUserId })).length, 1);
  assert.ok(fx.auth.calls.filter((call) => call.requestedAction === 'workspace:configure').every((call) => call.forceFresh === true));
  assert.equal(fx.busEvents.at(-1).eventType, 'resource.updated');
  assert.equal(fx.busEvents.at(-1).payload.updateKind, 'workspace_configuration');
  assert.equal(JSON.stringify(fx.busEvents).includes('mention_only'), false);
  assert.equal(JSON.stringify(fx.auditEvents).includes('mention_only'), false);
});

test('TWM1.6 risk classification is preserved and passed to the TWM1.7 mutation gate', async () => {
  const fx = serviceFixture();
  const moderation = await fx.service.proposeChange({ workspaceId, namespace: 'moderation', nextConfig: { enabled: true, warning_limit: 2, spam: { enabled: true } }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:twm16:moderation' });
  assert.equal(moderation.risk, 'medium');
  assert.equal(moderation.confirmationRequired, true);
  await fx.service.applyProposal({ proposal: moderation, actorGlobalUserId: actor, telegramUserId });
  assert.equal(fx.mutationGate.calls.at(-1).risk, 'medium');
  assert.equal(fx.mutationGate.calls.at(-1).confirmationRequired, true);

  const members = await fx.service.proposeChange({ workspaceId, namespace: 'members', nextConfig: { enabled: true }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:twm16:members' });
  assert.equal(members.risk, 'high');
  assert.equal(members.confirmationRequired, true);
});

test('TWM1.6 authority denial and proposal actor mismatch fail closed without writes', async () => {
  const denied = serviceFixture({ deniedUsers: new Set(['usr_denied']) });
  await assert.rejects(() => denied.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true }, actorGlobalUserId: 'usr_denied', telegramUserId: '2002', traceId: 'trace:denied' }), (error) => error.code === 'twm-workspace-role-denied');
  assert.equal(await denied.store.getConfig({ workspaceId, namespace: 'responses' }), null);

  const fx = serviceFixture();
  const proposal = await fx.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:actor' });
  await assert.rejects(() => fx.service.applyProposal({ proposal, actorGlobalUserId: 'usr_other', telegramUserId }), (error) => error.code === 'twm-workspace-config-proposal-actor-mismatch');
  assert.equal(await fx.store.getConfig({ workspaceId, namespace: 'responses' }), null);
  assert.equal(fx.mutationGate.calls.length, 0);
});

test('TWM1.6 stale proposal loses optimistic race and cannot overwrite a newer version', async () => {
  const fx = serviceFixture();
  const first = await fx.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:first' });
  const stale = await fx.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:stale' });
  await fx.service.applyProposal({ proposal: first, actorGlobalUserId: actor, telegramUserId });
  await assert.rejects(() => fx.service.applyProposal({ proposal: stale, actorGlobalUserId: actor, telegramUserId }), (error) => error.code === 'twm-workspace-config-version-conflict');
  assert.equal((await fx.store.getConfig({ workspaceId, namespace: 'responses' })).config.mode, 'mention_only');
});

test('TWM1.6 rollback remains an authorized new version behind the mutation gate and preserves history', async () => {
  const fx = serviceFixture();
  await fx.service.applyChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:v1' });
  await fx.service.applyChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:v2' });
  const rolled = await fx.service.rollback({ workspaceId, namespace: 'responses', targetVersion: 1, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:rollback' });
  assert.equal(rolled.config.version, 3);
  assert.equal(rolled.config.config.mode, 'mention_only');
  assert.equal(rolled.rolledBackToVersion, 1);
  assert.equal(rolled.actionGate.outcome, 'allow');
  assert.equal(fx.mutationGate.calls.at(-1).operation, 'rollback');
  assert.equal(fx.mutationGate.calls.at(-1).confirmationRequired, true);
  assert.deepEqual((await fx.store.configHistory({ workspaceId, namespace: 'responses' })).map((row) => row.version), [3, 2, 1]);
  assert.equal(fx.busEvents.at(-1).payload.operation, 'rollback');
});

test('TWM1.6 keeps independent workspace configuration roots isolated', async () => {
  const fx = serviceFixture();
  const secondWorkspaceId = 'tgw_twm160002';
  await fx.service.applyChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:a' });
  await fx.service.applyChange({ workspaceId: secondWorkspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all' }, actorGlobalUserId: actor, telegramUserId, traceId: 'trace:b' });
  assert.equal((await fx.service.getConfig({ workspaceId, namespace: 'responses', actorGlobalUserId: actor, telegramUserId })).config.mode, 'mention_only');
  assert.equal((await fx.service.getConfig({ workspaceId: secondWorkspaceId, namespace: 'responses', actorGlobalUserId: actor, telegramUserId })).config.mode, 'all');
});
