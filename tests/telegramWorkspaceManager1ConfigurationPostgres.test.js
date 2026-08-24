import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createPostgresTelegramWorkspaceStore,
  createTelegramWorkspace,
  createTelegramWorkspaceConfigurationService
} from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function fixture(prefix = 'twm16') {
  const uuid = randomUUID().replaceAll('-', '');
  return {
    workspaceId: `tgw_${uuid}`,
    telegramChatId: `-${BigInt(`0x${uuid.slice(0, 12)}`).toString()}`,
    title: `${prefix}-${uuid.slice(0, 8)}`
  };
}

function authority() {
  const calls = [];
  return Object.freeze({
    calls,
    async verify(input) {
      calls.push(input);
      return Object.freeze({ allowed: true, reason: 'twm-workspace-authority-verified', workspaceRole: 'OWNER', verificationTime: new Date().toISOString() });
    }
  });
}

function mutationGate() {
  return Object.freeze({
    async evaluateMutation(input) {
      return Object.freeze({ outcome: 'allow', reasons: Object.freeze([]), audit: Object.freeze({ gate: 'postgres-fixture-gate', traceId: input.traceId, requestId: input.requestId }) });
    }
  });
}

function service(store, auth) {
  return createTelegramWorkspaceConfigurationService({
    workspaceStore: store,
    authorityResolver: auth,
    mutationGate: mutationGate(),
    projectScope: 'sg2.1',
    environment: 'test',
    revision: 'twm1.7-postgres',
    audit: async () => {}
  });
}

integration('TWM1.6 PostgreSQL: apply + rollback survive restart as an append-only version chain behind mutation boundary', async () => {
  const fx = fixture();
  const actorGlobalUserId = 'usr_twm16_pg_owner';
  const telegramUserId = '16001';
  const auth = authority();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.6-config-pg' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);
  await store.putWorkspace(createTelegramWorkspace({ workspaceId: fx.workspaceId, telegramChatId: fx.telegramChatId, workspaceType: 'supergroup', title: fx.title, lifecycleState: 'CONNECTED' }));
  const configuration = service(store, auth);

  const v1 = await configuration.applyChange({ workspaceId: fx.workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only', reply_enabled: true }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:pg:v1' });
  assert.equal(v1.config.version, 1);
  const v2 = await configuration.applyChange({ workspaceId: fx.workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all', reply_enabled: true }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:pg:v2' });
  assert.equal(v2.config.version, 2);
  const v3 = await configuration.rollback({ workspaceId: fx.workspaceId, namespace: 'responses', targetVersion: 1, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:pg:rollback' });
  assert.equal(v3.config.version, 3);
  assert.equal(v3.config.config.mode, 'mention_only');
  assert.ok(auth.calls.filter((call) => call.requestedAction === 'workspace:configure').every((call) => call.forceFresh === true));

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.6-config-pg-restart' });
  await restarted.start();
  const restartedStore = createPostgresTelegramWorkspaceStore(restarted.database);
  const restartedConfiguration = service(restartedStore, authority());
  const current = await restartedConfiguration.getConfig({ workspaceId: fx.workspaceId, namespace: 'responses', actorGlobalUserId, telegramUserId });
  assert.equal(current.version, 3);
  assert.equal(current.config.mode, 'mention_only');
  const history = await restartedConfiguration.history({ workspaceId: fx.workspaceId, namespace: 'responses', actorGlobalUserId, telegramUserId });
  assert.deepEqual(history.map((row) => row.version), [3, 2, 1]);
  assert.equal(history[0].previous_config.mode, 'all');
  assert.equal(history[0].new_config.mode, 'mention_only');

  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [fx.workspaceId]);
  await restarted.close();
});

integration('TWM1.6 PostgreSQL: stale proposals and independent workspaces fail closed / remain isolated', async () => {
  const first = fixture('first');
  const second = fixture('second');
  const actorGlobalUserId = 'usr_twm16_pg_admin';
  const telegramUserId = '16002';
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.6-config-pg-isolation' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);
  for (const item of [first, second]) await store.putWorkspace(createTelegramWorkspace({ workspaceId: item.workspaceId, telegramChatId: item.telegramChatId, workspaceType: 'supergroup', title: item.title, lifecycleState: 'CONNECTED' }));
  const configuration = service(store, authority());

  const currentProposal = await configuration.proposeChange({ workspaceId: first.workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'mention_only' }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:current' });
  const staleProposal = await configuration.proposeChange({ workspaceId: first.workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all' }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:stale' });
  await configuration.applyProposal({ proposal: currentProposal, actorGlobalUserId, telegramUserId });
  await assert.rejects(() => configuration.applyProposal({ proposal: staleProposal, actorGlobalUserId, telegramUserId }), (error) => error.code === 'twm-workspace-config-version-conflict');

  await configuration.applyChange({ workspaceId: second.workspaceId, namespace: 'responses', nextConfig: { enabled: true, mode: 'all' }, actorGlobalUserId, telegramUserId, traceId: 'trace:twm16:second' });
  assert.equal((await store.getConfig({ workspaceId: first.workspaceId, namespace: 'responses' })).config.mode, 'mention_only');
  assert.equal((await store.getConfig({ workspaceId: second.workspaceId, namespace: 'responses' })).config.mode, 'all');
  assert.equal((await store.configHistory({ workspaceId: first.workspaceId, namespace: 'responses' })).length, 1);
  assert.equal((await store.configHistory({ workspaceId: second.workspaceId, namespace: 'responses' })).length, 1);

  await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=ANY($1::text[])', [[first.workspaceId, second.workspaceId]]);
  await persistence.close();
});
