import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActionGate } from '../src/action/actionGate.js';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createPostgresTelegramWorkspaceStore,
  createTelegramWorkspace,
  createTelegramWorkspaceActionGateIntegration,
  createTelegramWorkspaceConfigurationService
} from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function fixture() {
  const uuid = randomUUID().replaceAll('-', '');
  return {
    workspaceId: `tgw_${uuid}`,
    telegramChatId: `-${BigInt(`0x${uuid.slice(0, 12)}`).toString()}`,
    title: `twm17-${uuid.slice(0, 8)}`
  };
}

function authority() {
  return Object.freeze({
    async verify() {
      return Object.freeze({
        allowed: true,
        reason: 'twm-workspace-authority-verified',
        workspaceRole: 'OWNER',
        verificationTime: '2026-08-12T12:00:00.000Z'
      });
    }
  });
}

function configurationService(store) {
  const mutationGate = createTelegramWorkspaceActionGateIntegration({
    actionGate: createActionGate(),
    projectScope: 'sg2.1',
    audit: async () => {}
  });
  return createTelegramWorkspaceConfigurationService({
    workspaceStore: store,
    authorityResolver: authority(),
    mutationGate,
    projectScope: 'sg2.1',
    environment: 'test',
    revision: 'twm1.7-postgres',
    audit: async () => {}
  });
}

integration('TWM1.7 PostgreSQL: denied/unconfirmed mutation writes nothing; confirmed mutation and rollback persist across restart', async () => {
  const fx = fixture();
  const actorGlobalUserId = 'usr_twm17_pg_owner';
  const telegramUserId = '17001';
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.7-action-gate-pg' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);
  await store.putWorkspace(createTelegramWorkspace({ workspaceId: fx.workspaceId, telegramChatId: fx.telegramChatId, workspaceType: 'supergroup', title: fx.title, lifecycleState: 'CONNECTED' }));
  const configuration = configurationService(store);

  const proposalV1 = await configuration.proposeChange({
    workspaceId: fx.workspaceId,
    namespace: 'responses',
    nextConfig: { enabled: true, mode: 'mention_only' },
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:pg:v1',
    requestId: 'request:twm17:pg:v1'
  });
  await assert.rejects(
    () => configuration.applyProposal({ proposal: proposalV1, actorGlobalUserId, telegramUserId }),
    (error) => error.code === 'twm-action-gate-confirmation-required'
  );
  assert.equal(await store.getConfig({ workspaceId: fx.workspaceId, namespace: 'responses' }), null);
  const v1 = await configuration.applyProposal({ proposal: proposalV1, actorGlobalUserId, telegramUserId, confirmation: { confirmed: true, requestId: proposalV1.requestId } });
  assert.equal(v1.config.version, 1);

  const proposalV2 = await configuration.proposeChange({
    workspaceId: fx.workspaceId,
    namespace: 'responses',
    nextConfig: { enabled: true, mode: 'all' },
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:pg:v2',
    requestId: 'request:twm17:pg:v2'
  });
  const v2 = await configuration.applyProposal({ proposal: proposalV2, actorGlobalUserId, telegramUserId, confirmation: { confirmed: true, requestId: proposalV2.requestId } });
  assert.equal(v2.config.version, 2);

  await assert.rejects(
    () => configuration.rollback({ workspaceId: fx.workspaceId, namespace: 'responses', targetVersion: 1, actorGlobalUserId, telegramUserId, traceId: 'trace:twm17:pg:rollback', requestId: 'request:twm17:pg:rollback' }),
    (error) => error.code === 'twm-action-gate-confirmation-required'
  );
  assert.equal((await store.getConfig({ workspaceId: fx.workspaceId, namespace: 'responses' })).version, 2);
  const v3 = await configuration.rollback({
    workspaceId: fx.workspaceId,
    namespace: 'responses',
    targetVersion: 1,
    actorGlobalUserId,
    telegramUserId,
    traceId: 'trace:twm17:pg:rollback',
    requestId: 'request:twm17:pg:rollback',
    confirmation: { confirmed: true, requestId: 'request:twm17:pg:rollback' }
  });
  assert.equal(v3.config.version, 3);
  assert.equal(v3.config.config.mode, 'mention_only');
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.7-action-gate-pg-restart' });
  await restarted.start();
  const restartedStore = createPostgresTelegramWorkspaceStore(restarted.database);
  const current = await restartedStore.getConfig({ workspaceId: fx.workspaceId, namespace: 'responses' });
  assert.equal(current.version, 3);
  assert.equal(current.config.mode, 'mention_only');
  assert.deepEqual((await restartedStore.configHistory({ workspaceId: fx.workspaceId, namespace: 'responses' })).map((row) => row.version), [3, 2, 1]);
  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [fx.workspaceId]);
  await restarted.close();
});
