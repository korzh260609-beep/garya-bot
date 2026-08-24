import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  assertWorkspaceConfigContainsNoSecrets,
  createPostgresTelegramWorkspaceStore,
  createTelegramWorkspace,
  migrateTelegramWorkspaceToSupergroup
} from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function fixture(prefix = 'twm12') {
  const uuid = randomUUID().replaceAll('-', '');
  const chatNumber = BigInt(`0x${uuid.slice(0, 12)}`).toString();
  return {
    workspaceId: `tgw_${uuid}`,
    telegramChatId: `-${chatNumber}`,
    title: `${prefix}-${uuid.slice(0, 8)}`
  };
}

integration('TWM1.2: workspace, members, permissions, config and history survive PostgreSQL restart', async () => {
  const fx = fixture();
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.2-postgres-test' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);

  const workspace = createTelegramWorkspace({
    workspaceId: fx.workspaceId,
    telegramChatId: fx.telegramChatId,
    workspaceType: 'group',
    title: fx.title,
    lifecycleState: 'CONNECTED',
    botMembershipState: 'MEMBER',
    createdAt: '2026-08-12T08:55:00.000Z',
    updatedAt: '2026-08-12T08:55:00.000Z'
  });
  await store.putWorkspace(workspace);

  await store.putMember({
    workspaceId: fx.workspaceId,
    globalUserId: 'usr_twm12_owner',
    role: 'OWNER',
    grantedByGlobalUserId: 'usr_twm12_owner',
    source: 'twm1.2-test'
  });
  await store.putBotPermissions({
    workspaceId: fx.workspaceId,
    membershipState: 'MEMBER',
    permissions: { canPostMessages: true, canDeleteMessages: false },
    fetchedAt: '2026-08-12T08:56:00.000Z'
  });

  const v1 = await store.setConfig({
    workspaceId: fx.workspaceId,
    namespace: 'responses',
    config: { enabled: true, mode: 'mentions' },
    actorGlobalUserId: 'usr_twm12_owner',
    traceId: 'trace:twm12:v1',
    expectedVersion: 0,
    reason: 'initial configuration'
  });
  assert.equal(v1.version, 1);

  const v2 = await store.setConfig({
    workspaceId: fx.workspaceId,
    namespace: 'responses',
    config: { enabled: true, mode: 'mentions-and-replies' },
    actorGlobalUserId: 'usr_twm12_owner',
    traceId: 'trace:twm12:v2',
    expectedVersion: 1,
    reason: 'expand response mode'
  });
  assert.equal(v2.version, 2);

  const historyBeforeRestart = await store.configHistory({ workspaceId: fx.workspaceId, namespace: 'responses' });
  assert.deepEqual(historyBeforeRestart.map((entry) => entry.version), [2, 1]);
  assert.equal(historyBeforeRestart[0].previous_config.mode, 'mentions');
  assert.equal(historyBeforeRestart[0].new_config.mode, 'mentions-and-replies');

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.2-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresTelegramWorkspaceStore(restarted.database);

  const loadedWorkspace = await restartedStore.getWorkspace(fx.workspaceId);
  assert.equal(loadedWorkspace.workspaceId, fx.workspaceId);
  assert.equal(loadedWorkspace.telegramChatId, fx.telegramChatId);
  assert.equal(loadedWorkspace.title, fx.title);

  const byChat = await restartedStore.getWorkspaceByTelegramChatId(fx.telegramChatId);
  assert.equal(byChat.workspaceId, fx.workspaceId);

  const member = await restartedStore.getMember({ workspaceId: fx.workspaceId, globalUserId: 'usr_twm12_owner' });
  assert.equal(member.role, 'OWNER');
  assert.equal(member.status, 'active');

  const permissions = await restartedStore.getBotPermissions(fx.workspaceId);
  assert.equal(permissions.permissions.canPostMessages, true);

  const config = await restartedStore.getConfig({ workspaceId: fx.workspaceId, namespace: 'responses' });
  assert.equal(config.version, 2);
  assert.equal(config.config.mode, 'mentions-and-replies');
  assert.equal((await restartedStore.configHistory({ workspaceId: fx.workspaceId, namespace: 'responses' })).length, 2);

  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [fx.workspaceId]);
  await restarted.close();
});

integration('TWM1.2: canonical workspace isolation prevents cross-workspace configuration leakage', async () => {
  const first = fixture('first');
  const second = fixture('second');
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.2-isolation-test' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);

  await store.putWorkspace(createTelegramWorkspace({ workspaceId: first.workspaceId, telegramChatId: first.telegramChatId, workspaceType: 'group' }));
  await store.putWorkspace(createTelegramWorkspace({ workspaceId: second.workspaceId, telegramChatId: second.telegramChatId, workspaceType: 'channel' }));

  await store.setConfig({
    workspaceId: first.workspaceId,
    namespace: 'moderation',
    config: { enabled: true, warningLimit: 2 },
    actorGlobalUserId: 'usr_first_admin',
    traceId: 'trace:first'
  });
  await store.setConfig({
    workspaceId: second.workspaceId,
    namespace: 'moderation',
    config: { enabled: false },
    actorGlobalUserId: 'usr_second_admin',
    traceId: 'trace:second'
  });

  assert.equal((await store.getConfig({ workspaceId: first.workspaceId, namespace: 'moderation' })).config.warningLimit, 2);
  assert.equal((await store.getConfig({ workspaceId: second.workspaceId, namespace: 'moderation' })).config.enabled, false);
  assert.equal((await store.configHistory({ workspaceId: first.workspaceId, namespace: 'moderation' })).length, 1);
  assert.equal((await store.configHistory({ workspaceId: second.workspaceId, namespace: 'moderation' })).length, 1);
  assert.equal((await store.listMembers({ workspaceId: first.workspaceId })).length, 0);

  await assert.rejects(
    () => store.setConfig({
      workspaceId: first.workspaceId,
      namespace: 'moderation',
      config: { enabled: true },
      actorGlobalUserId: 'usr_first_admin',
      traceId: 'trace:stale',
      expectedVersion: 0
    }),
    (error) => error.code === 'twm-workspace-config-version-conflict'
  );

  await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=ANY($1::text[])', [[first.workspaceId, second.workspaceId]]);
  await persistence.close();
});

integration('TWM1.2: group to supergroup migration keeps SG workspace identity while remapping Telegram resource', async () => {
  const fx = fixture('migration');
  const next = fixture('migration-target');
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.2-migration-test' });
  await persistence.start();
  const store = createPostgresTelegramWorkspaceStore(persistence.database);

  const group = createTelegramWorkspace({
    workspaceId: fx.workspaceId,
    telegramChatId: fx.telegramChatId,
    workspaceType: 'group',
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T09:00:00.000Z'
  });
  await store.putWorkspace(group);
  const supergroup = migrateTelegramWorkspaceToSupergroup(group, {
    newTelegramChatId: next.telegramChatId,
    detectedAt: '2026-08-12T09:01:00.000Z'
  });
  await store.putWorkspace(supergroup);

  assert.equal((await store.getWorkspace(fx.workspaceId)).workspaceType, 'supergroup');
  assert.equal((await store.getWorkspace(fx.workspaceId)).migration.fromTelegramChatId, fx.telegramChatId);
  assert.equal(await store.getWorkspaceByTelegramChatId(fx.telegramChatId), null);
  assert.equal((await store.getWorkspaceByTelegramChatId(next.telegramChatId)).workspaceId, fx.workspaceId);

  await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [fx.workspaceId]);
  await persistence.close();
});

test('TWM1.2: workspace configuration rejects secret-shaped fields before persistence', () => {
  assert.throws(
    () => assertWorkspaceConfigContainsNoSecrets({ ai: { api_key: 'must-not-persist' } }),
    (error) => error.code === 'twm-workspace-config-secret-field-rejected'
  );
  assert.throws(
    () => assertWorkspaceConfigContainsNoSecrets({ nested: [{ client_secret: 'must-not-persist' }] }),
    (error) => error.code === 'twm-workspace-config-secret-field-rejected'
  );
  assert.doesNotThrow(() => assertWorkspaceConfigContainsNoSecrets({ enabled: true, model: 'default', moderation: { warningLimit: 2 } }));
});
