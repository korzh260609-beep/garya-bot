import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TelegramWorkspaceBotCapabilityError,
  createTelegramWorkspaceBotCapabilityService
} from '../src/telegramWorkspace/index.js';

function workspace(id, chatId, workspaceType = 'supergroup') {
  return Object.freeze({
    workspaceId: id,
    telegramChatId: String(chatId),
    workspaceType,
    lifecycleState: 'CONNECTED'
  });
}

function memoryStore(workspaces) {
  const byId = new Map(workspaces.map((item) => [item.workspaceId, item]));
  const permissions = new Map();
  return Object.freeze({
    async getWorkspace(id) { return byId.get(id) ?? null; },
    async getBotPermissions(id) { return permissions.get(id) ?? null; },
    async putBotPermissions({ workspaceId, membershipState, permissions: value, fetchedAt, expiresAt }) {
      const row = Object.freeze({ workspaceId, membershipState, permissions: value, fetchedAt, expiresAt, updatedAt: fetchedAt });
      permissions.set(workspaceId, row);
      return row;
    },
    snapshot(id) { return permissions.get(id) ?? null; }
  });
}

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

test('TWM1.5 maps live Telegram administrator permissions into healthy capability state', async () => {
  const store = memoryStore([workspace('tgw_alpha0001', '-1001')]);
  const calls = [];
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: {
      async getChatMember({ chatId, userId }) {
        calls.push({ chatId, userId });
        return admin();
      }
    },
    clock: () => new Date('2026-08-12T11:00:00Z')
  });

  const health = await service.checkCapabilities({
    workspaceId: 'tgw_alpha0001',
    requiredCapabilities: ['telegram.message.delete', 'telegram.member.restrict', 'telegram.message.pin']
  });

  assert.equal(health.available, true);
  assert.equal(health.status, 'healthy');
  assert.equal(health.membershipState, 'ADMINISTRATOR');
  assert.deepEqual(health.missingCapabilities, []);
  assert.deepEqual(calls, [{ chatId: '-1001', userId: '999' }]);
  assert.equal(store.snapshot('tgw_alpha0001').permissions.capabilities['telegram.message.delete'].available, true);
});

test('TWM1.5 missing Telegram permission is explicit degraded health and guarded execution fails closed', async () => {
  const store = memoryStore([workspace('tgw_alpha0002', '-1002')]);
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: { async getChatMember() { return admin({ can_delete_messages: false }); } }
  });

  const health = await service.checkCapabilities({
    workspaceId: 'tgw_alpha0002',
    requiredCapabilities: ['telegram.message.delete']
  });
  assert.equal(health.available, false);
  assert.equal(health.status, 'degraded');
  assert.equal(health.reason, 'telegram-bot-permission-missing');
  assert.deepEqual(health.missingCapabilities, ['telegram.message.delete']);
  assert.deepEqual(health.missingPermissions, ['can_delete_messages']);

  await assert.rejects(
    () => service.requireCapabilities({ workspaceId: 'tgw_alpha0002', requiredCapabilities: ['telegram.message.delete'] }),
    (error) => {
      assert.ok(error instanceof TelegramWorkspaceBotCapabilityError);
      assert.equal(error.code, 'telegram-bot-permission-missing');
      assert.match(error.message, /can_delete_messages/);
      assert.equal(error.health.status, 'degraded');
      return true;
    }
  );
});

test('TWM1.5 disconnected bot never reports configured capability success', async () => {
  const store = memoryStore([workspace('tgw_alpha0003', '-1003')]);
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: { async getChatMember() { return { status: 'left' }; } }
  });

  const health = await service.checkCapabilities({
    workspaceId: 'tgw_alpha0003',
    requiredCapabilities: ['telegram.message.send']
  });
  assert.equal(health.available, false);
  assert.equal(health.status, 'disconnected');
  assert.equal(health.reason, 'telegram-bot-not-connected');
});

test('TWM1.5 channel publication requires actual can_post_messages', async () => {
  const store = memoryStore([workspace('tgw_channel01', '-2001', 'channel')]);
  let current = admin({ can_post_messages: false });
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: { async getChatMember() { return current; } }
  });

  const denied = await service.checkCapabilities({ workspaceId: 'tgw_channel01', requiredCapabilities: ['telegram.channel.post'] });
  assert.equal(denied.available, false);
  assert.deepEqual(denied.missingPermissions, ['can_post_messages']);

  current = admin({ can_post_messages: true });
  const allowed = await service.checkCapabilities({ workspaceId: 'tgw_channel01', requiredCapabilities: ['telegram.channel.post'] });
  assert.equal(allowed.available, true);
});

test('TWM1.5 uses fresh persisted cache for reads but re-verifies after TTL', async () => {
  const store = memoryStore([workspace('tgw_cache0001', '-3001')]);
  let now = new Date('2026-08-12T11:00:00Z');
  let calls = 0;
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    snapshotTtlMs: 60_000,
    clock: () => now,
    telegramApiClient: { async getChatMember() { calls += 1; return admin(); } }
  });

  const first = await service.getHealth({ workspaceId: 'tgw_cache0001', requiredCapabilities: ['telegram.message.delete'] });
  assert.equal(first.source, 'live');
  assert.equal(calls, 1);

  now = new Date('2026-08-12T11:00:30Z');
  const cached = await service.getHealth({ workspaceId: 'tgw_cache0001', requiredCapabilities: ['telegram.message.delete'] });
  assert.equal(cached.source, 'cache');
  assert.equal(calls, 1);

  now = new Date('2026-08-12T11:01:01Z');
  const refreshed = await service.getHealth({ workspaceId: 'tgw_cache0001', requiredCapabilities: ['telegram.message.delete'] });
  assert.equal(refreshed.source, 'live');
  assert.equal(calls, 2);
});

test('TWM1.5 live verification failure cannot reuse stale healthy evidence for protected operation', async () => {
  const store = memoryStore([workspace('tgw_failure01', '-4001')]);
  let fail = false;
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: {
      async getChatMember() {
        if (fail) {
          const error = new Error('network unavailable');
          error.code = 'telegram-network-failure';
          throw error;
        }
        return admin();
      }
    }
  });

  assert.equal((await service.refresh({ workspaceId: 'tgw_failure01', requiredCapabilities: ['telegram.message.delete'] })).available, true);
  fail = true;
  const health = await service.checkCapabilities({
    workspaceId: 'tgw_failure01',
    requiredCapabilities: ['telegram.message.delete'],
    requireFresh: true
  });
  assert.equal(health.available, false);
  assert.equal(health.status, 'verification-failed');
  assert.equal(health.reason, 'telegram-network-failure');
  assert.deepEqual(health.missingCapabilities, ['telegram.message.delete']);
  assert.ok(health.snapshot);
});

test('TWM1.5 resolves bot identity with getMe once when TELEGRAM_BOT_USER_ID is absent', async () => {
  const store = memoryStore([workspace('tgw_getme001', '-5001'), workspace('tgw_getme002', '-5002')]);
  let getMeCalls = 0;
  const memberCalls = [];
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    telegramApiClient: {
      async getMe() { getMeCalls += 1; return { id: 777, is_bot: true }; },
      async getChatMember({ chatId, userId }) { memberCalls.push({ chatId, userId }); return admin(); }
    }
  });

  await service.refresh({ workspaceId: 'tgw_getme001' });
  await service.refresh({ workspaceId: 'tgw_getme002' });
  assert.equal(getMeCalls, 1);
  assert.deepEqual(memberCalls, [{ chatId: '-5001', userId: '777' }, { chatId: '-5002', userId: '777' }]);
});

test('TWM1.5 snapshots and capability decisions stay isolated per workspace', async () => {
  const store = memoryStore([workspace('tgw_scope0001', '-6001'), workspace('tgw_scope0002', '-6002')]);
  const service = createTelegramWorkspaceBotCapabilityService({
    workspaceStore: store,
    botUserId: '999',
    telegramApiClient: {
      async getChatMember({ chatId }) {
        return chatId === '-6001' ? admin() : admin({ can_delete_messages: false });
      }
    }
  });

  const a = await service.checkCapabilities({ workspaceId: 'tgw_scope0001', requiredCapabilities: ['telegram.message.delete'] });
  const b = await service.checkCapabilities({ workspaceId: 'tgw_scope0002', requiredCapabilities: ['telegram.message.delete'] });
  assert.equal(a.available, true);
  assert.equal(b.available, false);
  assert.equal((await service.getSnapshot('tgw_scope0001')).workspaceId, 'tgw_scope0001');
  assert.equal((await service.getSnapshot('tgw_scope0002')).workspaceId, 'tgw_scope0002');
});
