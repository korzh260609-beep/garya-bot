import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionGate } from '../src/action/actionGate.js';
import {
  createTelegramWorkspaceActionGateIntegration,
  createTelegramWorkspaceConfigurationService
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
      const next = Object.freeze({ workspaceId, namespace, config: structuredClone(config), version: version + 1, updatedByGlobalUserId: actorGlobalUserId, traceId, updatedAt: '2026-08-12T12:00:00.000Z' });
      configs.set(k, next);
      const history = histories.get(k) ?? [];
      history.unshift(Object.freeze({ version: next.version, previous_config: current?.config ?? null, new_config: structuredClone(config), actor_global_user_id: actorGlobalUserId, trace_id: traceId, reason }));
      histories.set(k, history);
      return next;
    },
    async configHistory({ workspaceId, namespace, limit = 100 }) { return (histories.get(key(workspaceId, namespace)) ?? []).slice(0, limit); }
  });
}

function authority({ allowed = true } = {}) {
  return Object.freeze({
    async verify(input) {
      return Object.freeze({
        allowed,
        reason: allowed ? 'twm-workspace-authority-verified' : 'twm-workspace-role-denied',
        workspaceRole: allowed ? 'OWNER' : 'VIEWER',
        verificationTime: '2026-08-12T12:00:00.000Z',
        workspaceId: input.workspaceId
      });
    }
  });
}

function fixture({ authorityAllowed = true } = {}) {
  const gateAudit = [];
  const actionGate = createActionGate();
  const mutationGate = createTelegramWorkspaceActionGateIntegration({
    actionGate,
    projectScope: 'sg2.1',
    audit: async (event) => gateAudit.push(event)
  });
  const store = memoryStore();
  const service = createTelegramWorkspaceConfigurationService({
    workspaceStore: store,
    authorityResolver: authority({ allowed: authorityAllowed }),
    mutationGate,
    projectScope: 'sg2.1',
    environment: 'test',
    revision: 'twm1.7-test',
    audit: async () => {}
  });
  return { actionGate, mutationGate, gateAudit, store, service };
}

const actorGlobalUserId = 'usr_twm17_owner';
const telegramUserId = '17001';
const workspaceId = 'tgw_twm170001';

function confirmation(requestId) {
  return Object.freeze({ confirmed: true, requestId });
}

test('TWM1.7 configuration service cannot be constructed without the protected mutation gate', () => {
  assert.throws(() => createTelegramWorkspaceConfigurationService({
    workspaceStore: memoryStore(),
    authorityResolver: authority()
  }), /mutationGate\.evaluateMutation is required/);
});

test('TWM1.7 low-risk state change still requires canonical Action Gate confirmation before write', async () => {
  const fx = fixture();
  const proposal = await fx.service.proposeChange({
    workspaceId,
    namespace: 'responses',
    nextConfig: { enabled: true, mode: 'mention_only' },
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:low',
    requestId: 'request:twm17:low'
  });
  assert.equal(proposal.risk, 'low');
  assert.equal(proposal.confirmationRequired, false);

  await assert.rejects(
    () => fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId }),
    (error) => error.code === 'twm-action-gate-confirmation-required'
      && error.details?.requestId === proposal.requestId
  );
  assert.equal(await fx.store.getConfig({ workspaceId, namespace: 'responses' }), null);

  await assert.rejects(
    () => fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmation: confirmation('wrong-request') }),
    (error) => error.code === 'twm-action-gate-confirmation-required'
  );
  assert.equal(await fx.store.getConfig({ workspaceId, namespace: 'responses' }), null);

  const applied = await fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmation: confirmation(proposal.requestId) });
  assert.equal(applied.config.version, 1);
  assert.equal(applied.actionGate.outcome, 'allow');
  assert.equal(applied.actionGate.requestId, proposal.requestId);
  assert.equal(fx.gateAudit.at(-1).outcome, 'allow');
});

test('TWM1.7 canonical gate rejects replayed authorized proposal before a second config write', async () => {
  const fx = fixture();
  const proposal = await fx.service.proposeChange({
    workspaceId,
    namespace: 'responses',
    nextConfig: { enabled: true, mode: 'mention_only' },
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:replay',
    requestId: 'request:twm17:replay'
  });
  const confirmed = confirmation(proposal.requestId);
  await fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmation: confirmed });

  await assert.rejects(
    () => fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmation: confirmed }),
    (error) => error.code === 'twm-action-gate-denied' && error.details?.reasons?.includes('duplicate-idempotency-key')
  );
  assert.equal((await fx.store.getConfig({ workspaceId, namespace: 'responses' })).version, 1);
  assert.equal((await fx.store.configHistory({ workspaceId, namespace: 'responses' })).length, 1);
});

test('TWM1.7 service-derived high risk cannot be downgraded by caller and is carried into Action Gate', async () => {
  const fx = fixture();
  const proposal = await fx.service.proposeChange({
    workspaceId,
    namespace: 'members',
    nextConfig: { enabled: true },
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:members',
    requestId: 'request:twm17:members',
    risk: 'low'
  });
  assert.equal(proposal.risk, 'high');
  assert.equal(proposal.confirmationRequired, true);
  const applied = await fx.service.applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmation: confirmation(proposal.requestId) });
  assert.equal(applied.config.version, 1);
  assert.equal(fx.gateAudit.at(-1).risk, 'high');
  assert.equal(fx.gateAudit.at(-1).confirmationRequired, true);
});

test('TWM1.7 rollback is a separate confirmed state-changing Action Gate operation', async () => {
  const fx = fixture();
  for (const [mode, requestId] of [['mention_only', 'request:twm17:v1'], ['all', 'request:twm17:v2']]) {
    await fx.service.applyChange({
      workspaceId,
      namespace: 'responses',
      nextConfig: { enabled: true, mode },
      actorGlobalUserId,
      telegramUserId,
      traceId: requestId.replace('request', 'trace'),
      requestId,
      confirmation: confirmation(requestId)
    });
  }

  await assert.rejects(
    () => fx.service.rollback({ workspaceId, namespace: 'responses', targetVersion: 1, actorGlobalUserId, telegramUserId, traceId: 'trace:twm17:rollback', requestId: 'request:twm17:rollback' }),
    (error) => error.code === 'twm-action-gate-confirmation-required'
  );
  assert.equal((await fx.store.getConfig({ workspaceId, namespace: 'responses' })).version, 2);

  const rolled = await fx.service.rollback({
    workspaceId,
    namespace: 'responses',
    targetVersion: 1,
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:rollback',
    requestId: 'request:twm17:rollback',
    confirmation: confirmation('request:twm17:rollback')
  });
  assert.equal(rolled.config.version, 3);
  assert.equal(rolled.config.config.mode, 'mention_only');
  assert.equal(rolled.actionGate.outcome, 'allow');
  assert.equal(fx.gateAudit.at(-1).operation, 'rollback');
});

test('TWM1.7 authority denial fails before Action Gate and before persistence', async () => {
  const fx = fixture({ authorityAllowed: false });
  await assert.rejects(
    () => fx.service.proposeChange({ workspaceId, namespace: 'responses', nextConfig: { enabled: true }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm17:denied' }),
    (error) => error.code === 'twm-workspace-role-denied'
  );
  assert.equal(fx.gateAudit.length, 0);
  assert.equal(await fx.store.getConfig({ workspaceId, namespace: 'responses' }), null);
});
