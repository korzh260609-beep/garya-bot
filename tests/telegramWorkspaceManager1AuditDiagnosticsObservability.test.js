import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceDiagnosticsObservabilityService } from '../src/telegramWorkspace/telegramWorkspaceDiagnosticsObservability.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';

function trace(id) {
  return Object.freeze({ traceId: `trace-${id}`, requestId: `request-${id}`, environment: 'test', revision: 'twm1.11-test' });
}

function fixture({ allowed = true, botHealth = null } = {}) {
  const store = createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store, clock: () => '2026-08-12T17:00:00.000Z', idFactory: (() => { let n = 0; return () => `evt-${++n}`; })() });
  const rollbackCalls = [];
  const historyRows = [{
    namespace: 'responses', version: 2,
    actor_global_user_id: 'usr_admin',
    previous_config: { mode: 'all', nested: { api_key: 'must-not-leak' } },
    new_config: { mode: 'mention_only' },
    trace_id: 'trace-history', reason: 'operator-change', created_at: '2026-08-12T16:00:00.000Z'
  }];
  const authorityResolver = Object.freeze({
    async verify() {
      return Object.freeze({ allowed, reason: allowed ? 'telegram-admin-authorized' : 'telegram-admin-required', workspaceRole: allowed ? 'admin' : null, verificationTime: '2026-08-12T16:59:00.000Z' });
    }
  });
  const workspaceStore = Object.freeze({
    async getWorkspace() {
      return Object.freeze({ workspaceId: 'tgw_diag1111', lifecycleState: 'active', botMembershipState: 'ADMINISTRATOR', workspaceType: 'supergroup' });
    }
  });
  const configurationService = Object.freeze({
    async listConfigs() {
      return Object.freeze([
        Object.freeze({ namespace: 'responses', version: 3 }),
        Object.freeze({ namespace: 'memory', version: 1 })
      ]);
    },
    async history() { return Object.freeze(historyRows); },
    async rollback(input) { rollbackCalls.push(input); return Object.freeze({ config: Object.freeze({ version: 4 }), rolledBackToVersion: input.targetVersion }); }
  });
  const botCapabilityService = Object.freeze({
    async getHealth() {
      return botHealth ?? Object.freeze({ available: true, status: 'healthy', reason: 'telegram-bot-capability-available', membershipState: 'ADMINISTRATOR', missingCapabilities: [], missingPermissions: [], fetchedAt: '2026-08-12T16:59:30.000Z' });
    }
  });
  const service = createTelegramWorkspaceDiagnosticsObservabilityService({
    workspaceStore, authorityResolver, configurationService, botCapabilityService, observability,
    environment: 'test', revision: 'twm1.11-test', clock: () => new Date('2026-08-12T17:00:00.000Z')
  });
  return { service, observability, rollbackCalls };
}

function recordWorkspaceEvent(observability, { stage, outcome, operation, id }) {
  observability.record({
    eventClass: 'audit_event', channel: 'telemetry', stage, traceContext: trace(id), outcome,
    scopeRef: 'tgw_diag1111', data: { workspaceId: 'tgw_diag1111', operation, namespace: 'responses', version: 3 }
  });
}

test('TWM1.11 exposes authorized actor/time/before/after audit history and redacts secret-shaped fields', async () => {
  const { service } = fixture();
  const rows = await service.history({ workspaceId: 'tgw_diag1111', namespace: 'responses', actorGlobalUserId: 'usr_admin', telegramUserId: '101' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, 2);
  assert.equal(rows[0].who, 'usr_admin');
  assert.equal(rows[0].what.namespace, 'responses');
  assert.equal(rows[0].what.reason, 'operator-change');
  assert.equal(rows[0].when, '2026-08-12T16:00:00.000Z');
  assert.equal(rows[0].before.mode, 'all');
  assert.equal(rows[0].before.nested.api_key, '[REDACTED]');
  assert.equal(rows[0].after.mode, 'mention_only');
  assert.equal(rows[0].traceId, 'trace-history');
  assert.equal(Object.isFrozen(rows[0]), true);
});

test('TWM1.11 rollback reuses the existing protected configuration rollback path without rewriting semantics', async () => {
  const { service, rollbackCalls } = fixture();
  const input = Object.freeze({ workspaceId: 'tgw_diag1111', namespace: 'responses', targetVersion: 2, actorGlobalUserId: 'usr_admin', telegramUserId: '101', traceId: 'trace-rb', requestId: 'request-rb', confirmation: Object.freeze({ confirmed: true, requestId: 'request-rb' }) });
  const result = await service.rollback(input);
  assert.equal(result.config.version, 4);
  assert.equal(result.rolledBackToVersion, 2);
  assert.equal(rollbackCalls.length, 1);
  assert.equal(rollbackCalls[0], input);
});

test('TWM1.11 diagnostics aggregates connection authority bot health config versions mutations and denial counters', async () => {
  const { service, observability } = fixture();
  recordWorkspaceEvent(observability, { stage: 'telegram-workspace-configuration', outcome: 'success', operation: 'apply', id: 'apply' });
  recordWorkspaceEvent(observability, { stage: 'telegram-workspace-configuration', outcome: 'failure', operation: 'rollback', id: 'failure' });
  recordWorkspaceEvent(observability, { stage: 'telegram-workspace-authority', outcome: 'deny', operation: 'workspace:configure', id: 'authority' });
  recordWorkspaceEvent(observability, { stage: 'telegram-workspace-action-gate', outcome: 'deny', operation: 'apply', id: 'gate' });

  const report = await service.health({ workspaceId: 'tgw_diag1111', actorGlobalUserId: 'usr_admin', telegramUserId: '101', traceId: 'trace-diag', requestId: 'request-diag' });
  assert.equal(report.contractVersion, 1);
  assert.equal(report.status, 'healthy');
  assert.equal(report.connection.state, 'connected');
  assert.equal(report.authority.state, 'authorized');
  assert.equal(report.botPermissions.status, 'healthy');
  assert.deepEqual(report.configuration.versions, { responses: 3, memory: 1 });
  assert.equal(report.configuration.maxVersion, 3);
  assert.equal(report.metrics.configurationActions, 2);
  assert.equal(report.metrics.configurationSuccesses, 1);
  assert.equal(report.metrics.configurationFailures, 1);
  assert.equal(report.metrics.authorizationDenials, 1);
  assert.equal(report.metrics.actionGateDenials, 1);
  assert.equal(report.lastMutation.success.operation, 'apply');
  assert.equal(report.lastMutation.failure.operation, 'rollback');

  const diag = observability.list({ traceId: 'trace-diag' });
  assert.equal(diag.length, 1);
  assert.equal(diag[0].stage, 'telegram-workspace-diagnostics');
  assert.equal(diag[0].traceContext.requestId, 'request-diag');
  assert.equal(JSON.stringify(diag[0]).includes('must-not-leak'), false);
});

test('TWM1.11 diagnostics is degraded with actionable missing bot permissions', async () => {
  const botHealth = Object.freeze({ available: false, status: 'degraded', reason: 'telegram-bot-permission-missing', membershipState: 'ADMINISTRATOR', missingCapabilities: ['telegram.message.delete'], missingPermissions: ['can_delete_messages'], fetchedAt: '2026-08-12T16:59:30.000Z' });
  const { service } = fixture({ botHealth });
  const report = await service.health({ workspaceId: 'tgw_diag1111', actorGlobalUserId: 'usr_admin', telegramUserId: '101' });
  assert.equal(report.status, 'degraded');
  assert.equal(report.ok, false);
  assert.deepEqual(report.botPermissions.missingPermissions, ['can_delete_messages']);
  assert.deepEqual(report.degradedReasons, ['telegram-bot-permission-missing']);
});

test('TWM1.11 diagnostics fails closed before workspace/config/bot disclosure when authority is denied', async () => {
  const { service } = fixture({ allowed: false });
  await assert.rejects(
    service.health({ workspaceId: 'tgw_diag1111', actorGlobalUserId: 'usr_member', telegramUserId: '202' }),
    (error) => error.code === 'telegram-admin-required'
  );
});
