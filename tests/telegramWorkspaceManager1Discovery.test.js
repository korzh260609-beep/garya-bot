import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelegramWorkspaceRegistry,
  extractTelegramWorkspaceEvents
} from '../src/telegramWorkspace/index.js';

function createMemoryWorkspaceStore() {
  const byId = new Map();
  const byChat = new Map();
  return Object.freeze({
    async putWorkspace(workspace) {
      const previous = byId.get(workspace.workspaceId);
      if (previous && previous.telegramChatId !== workspace.telegramChatId) byChat.delete(previous.telegramChatId);
      const occupied = byChat.get(workspace.telegramChatId);
      if (occupied && occupied.workspaceId !== workspace.workspaceId) {
        const error = new Error('telegram chat locator already belongs to another workspace');
        error.code = 'twm-workspace-migration-conflict';
        throw error;
      }
      byId.set(workspace.workspaceId, workspace);
      byChat.set(workspace.telegramChatId, workspace);
      return workspace;
    },
    async getWorkspace(workspaceId) { return byId.get(workspaceId) ?? null; },
    async getWorkspaceByTelegramChatId(chatId) { return byChat.get(String(chatId)) ?? null; },
    snapshot() { return new Map(byId); }
  });
}

function messageUpdate({ updateId = 1, chatId = -1001, type = 'supergroup', title = 'Crypto', username = null, date = 1786526400, extra = {} } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date,
      from: { id: 7, is_bot: false },
      chat: { id: chatId, type, title, ...(username === null ? {} : { username }) },
      text: 'ordinary message',
      ...extra
    }
  };
}

test('TWM1.3 extracts group, supergroup and channel workspace facts but ignores private chats', () => {
  const group = extractTelegramWorkspaceEvents(messageUpdate({ chatId: -10, type: 'group', title: 'Group' }));
  assert.equal(group.length, 1);
  assert.equal(group[0].kind, 'workspace_observed');
  assert.equal(group[0].workspaceType, 'group');
  assert.equal(group[0].telegramChatId, '-10');

  const supergroup = extractTelegramWorkspaceEvents(messageUpdate({ chatId: -10020, type: 'supergroup', title: 'Super' }));
  assert.equal(supergroup[0].workspaceType, 'supergroup');

  const channel = extractTelegramWorkspaceEvents({
    update_id: 3,
    channel_post: { message_id: 3, date: 1786526401, chat: { id: -10030, type: 'channel', title: 'News', username: 'news_channel' }, text: 'post' }
  });
  assert.equal(channel.length, 1);
  assert.equal(channel[0].workspaceType, 'channel');
  assert.equal(channel[0].username, 'news_channel');

  const privateEvents = extractTelegramWorkspaceEvents(messageUpdate({ chatId: 70, type: 'private', title: null }));
  assert.deepEqual(privateEvents, []);
});

test('TWM1.3 extracts bot membership connect/disconnect facts without inferring human authority', () => {
  const joined = extractTelegramWorkspaceEvents({
    update_id: 10,
    my_chat_member: {
      date: 1786526410,
      from: { id: 7 },
      chat: { id: -10040, type: 'supergroup', title: 'Ops' },
      new_chat_member: { user: { id: 999, is_bot: true }, status: 'administrator' }
    }
  });
  assert.equal(joined.length, 1);
  assert.equal(joined[0].kind, 'bot_membership_changed');
  assert.equal(joined[0].membershipState, 'ADMINISTRATOR');
  assert.equal(joined[0].connectionState, 'connected');
  assert.equal(Object.hasOwn(joined[0], 'ownerGlobalUserId'), false);

  const left = extractTelegramWorkspaceEvents({
    update_id: 11,
    my_chat_member: {
      date: 1786526411,
      from: { id: 7 },
      chat: { id: -10040, type: 'supergroup', title: 'Ops' },
      new_chat_member: { user: { id: 999, is_bot: true }, status: 'left' }
    }
  });
  assert.equal(left[0].connectionState, 'disconnected');
});

test('TWM1.3 extracts both Telegram group to supergroup migration forms', () => {
  const oldSide = extractTelegramWorkspaceEvents(messageUpdate({
    updateId: 20,
    chatId: -50,
    type: 'group',
    title: 'Legacy',
    extra: { migrate_to_chat_id: -10050 }
  }));
  assert.equal(oldSide[0].kind, 'workspace_migrated');
  assert.equal(oldSide[0].fromTelegramChatId, '-50');
  assert.equal(oldSide[0].toTelegramChatId, '-10050');

  const newSide = extractTelegramWorkspaceEvents(messageUpdate({
    updateId: 21,
    chatId: -10050,
    type: 'supergroup',
    title: 'Legacy',
    extra: { migrate_from_chat_id: -50 }
  }));
  assert.equal(newSide[0].fromTelegramChatId, '-50');
  assert.equal(newSide[0].toTelegramChatId, '-10050');
});

test('TWM1.3 registry refreshes metadata, keeps monotonic time and reconnects deterministically', async () => {
  const store = createMemoryWorkspaceStore();
  const registry = createTelegramWorkspaceRegistry({ store, clock: () => new Date('2026-08-12T10:00:00.000Z') });

  const first = await registry.apply({
    kind: 'workspace_observed', telegramChatId: '-10060', workspaceType: 'supergroup', title: 'Old title', username: 'old_name', detectedAt: '2026-08-12T09:50:00.000Z'
  });
  assert.equal(first.createdAt, '2026-08-12T09:50:00.000Z');

  const refreshed = await registry.apply({
    kind: 'workspace_observed', telegramChatId: '-10060', workspaceType: 'supergroup', title: 'New title', username: null, detectedAt: '2026-08-12T09:40:00.000Z'
  });
  assert.equal(refreshed.workspaceId, first.workspaceId);
  assert.equal(refreshed.title, 'New title');
  assert.equal(refreshed.username, null);
  assert.equal(refreshed.updatedAt, first.updatedAt);

  const disconnected = await registry.apply({
    kind: 'bot_membership_changed', telegramChatId: '-10060', workspaceType: 'supergroup', title: 'New title', username: null, membershipState: 'LEFT', connectionState: 'disconnected', detectedAt: '2026-08-12T10:01:00.000Z'
  });
  assert.equal(disconnected.lifecycleState, 'DISCONNECTED');
  assert.equal(disconnected.botMembershipState, 'LEFT');

  const reconnected = await registry.apply({
    kind: 'bot_membership_changed', telegramChatId: '-10060', workspaceType: 'supergroup', title: 'New title', username: null, membershipState: 'ADMINISTRATOR', connectionState: 'connected', detectedAt: '2026-08-12T10:02:00.000Z'
  });
  assert.equal(reconnected.lifecycleState, 'CONNECTED');
  assert.equal(reconnected.workspaceId, first.workspaceId);
});

test('TWM1.3 migration replay preserves one canonical workspace root and independent workspaces stay isolated', async () => {
  const store = createMemoryWorkspaceStore();
  const registry = createTelegramWorkspaceRegistry({ store, clock: () => new Date('2026-08-12T11:00:00.000Z') });

  const group = await registry.apply({ kind: 'workspace_observed', telegramChatId: '-70', workspaceType: 'group', title: 'Migrating', username: null, detectedAt: '2026-08-12T10:50:00.000Z' });
  const other = await registry.apply({ kind: 'workspace_observed', telegramChatId: '-10071', workspaceType: 'channel', title: 'Other', username: null, detectedAt: '2026-08-12T10:51:00.000Z' });
  assert.notEqual(group.workspaceId, other.workspaceId);

  const event = { kind: 'workspace_migrated', fromTelegramChatId: '-70', toTelegramChatId: '-10070', workspaceType: 'supergroup', title: 'Migrating', username: null, detectedAt: '2026-08-12T10:52:00.000Z' };
  const migrated = await registry.apply(event);
  const replayed = await registry.apply(event);

  assert.equal(migrated.workspaceId, group.workspaceId);
  assert.equal(replayed.workspaceId, group.workspaceId);
  assert.equal(await registry.resolveTelegramChatId('-70'), null);
  assert.equal((await registry.resolveTelegramChatId('-10070')).workspaceId, group.workspaceId);
  assert.equal((await registry.resolveTelegramChatId('-10071')).workspaceId, other.workspaceId);
  assert.equal(store.snapshot().size, 2);
});
