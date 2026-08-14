import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createPostgresTelegramWorkspaceRegistry,
  createTelegramWorkspaceBotCapabilityService
} from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function admin(overrides = {}) {
  return {
    status: 'administrator',
    can_manage_chat: true,
    can_delete_messages: true,
    can_restrict_members: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_topics: true,
    can_edit_messages: true,
    can_post_messages: true,
    ...overrides
  };
}

integration('TWM1.5 PostgreSQL bot capability snapshots survive restart, stay isolated and refresh revoked permissions', async () => {
  const suffix = randomUUID().replaceAll('-', '');
  const workspaceA = `tgw_${suffix.slice(0, 16)}A`;
  const workspaceB = `tgw_${suffix.slice(16, 32)}B`;
  const base = BigInt(`0x${suffix.slice(0, 12)}`);
  const chatA = `-${base}`;
  const chatB = `-${base + 1n}`;
  let aCanDelete = true;
  let calls = 0;

  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.5-capability-test' });
  await persistence.start();
  const registry = createPostgresTelegramWorkspaceRegistry(persistence.database);
  await registry.store.putWorkspace({ workspaceId: workspaceA, telegramChatId: chatA, workspaceType: 'supergroup', title: 'TWM1.5 A', lifecycleState: 'CONNECTED', botMembershipState: 'ADMINISTRATOR' });
  await registry.store.putWorkspace({ workspaceId: workspaceB, telegramChatId: chatB, workspaceType: 'channel', title: 'TWM1.5 B', lifecycleState: 'CONNECTED', botMembershipState: 'ADMINISTRATOR' });

  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: registry.store,
    botUserId: '999',
    snapshotTtlMs: 120_000,
    telegramApiClient: {
      async getChatMember({ chatId, userId }) {
        assert.equal(userId, '999');
        calls += 1;
        if (String(chatId) === chatA) return admin({ can_delete_messages: aCanDelete });
        if (String(chatId) === chatB) return admin({ can_post_messages: false });
        throw new Error('unexpected workspace');
      }
    }
  });

  const a = await service.checkCapabilities({ workspaceId: workspaceA, requiredCapabilities: ['telegram.message.delete'] });
  const b = await service.checkCapabilities({ workspaceId: workspaceB, requiredCapabilities: ['telegram.channel.post'] });
  assert.equal(a.available, true);
  assert.equal(b.available, false);
  assert.deepEqual(b.missingPermissions, ['can_post_messages']);
  assert.equal(calls, 2);
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.5-capability-restart-test' });
  await restarted.start();
  const restartedRegistry = createPostgresTelegramWorkspaceRegistry(restarted.database);
  const restartedService = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: restartedRegistry.store,
    botUserId: '999',
    telegramApiClient: {
      async getChatMember({ chatId }) {
        if (String(chatId) === chatA) return admin({ can_delete_messages: aCanDelete });
        return admin({ can_post_messages: false });
      }
    }
  });

  const persistedA = await restartedService.getSnapshot(workspaceA);
  const persistedB = await restartedService.getSnapshot(workspaceB);
  assert.equal(persistedA.workspaceId, workspaceA);
  assert.equal(persistedA.permissions.capabilities['telegram.message.delete'].available, true);
  assert.equal(persistedB.workspaceId, workspaceB);
  assert.equal(persistedB.permissions.capabilities['telegram.channel.post'].available, false);

  aCanDelete = false;
  const revoked = await restartedService.checkCapabilities({ workspaceId: workspaceA, requiredCapabilities: ['telegram.message.delete'], requireFresh: true });
  assert.equal(revoked.available, false);
  assert.equal(revoked.status, 'degraded');
  assert.deepEqual(revoked.missingPermissions, ['can_delete_messages']);
  assert.equal((await restartedService.getSnapshot(workspaceB)).permissions.capabilities['telegram.channel.post'].available, false, 'Workspace B snapshot must not be affected by Workspace A refresh');

  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=ANY($1::text[])', [[workspaceA, workspaceB]]);
  await restarted.close();
});
