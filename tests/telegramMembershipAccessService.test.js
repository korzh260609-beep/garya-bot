import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramMembershipAccessService } from '../src/telegramWorkspace/telegramMembershipAccessService.js';

function fixture({ workspace = { workspaceId: 'workspace-1' }, approvalError = null } = {}) {
  const calls = [];
  const store = {
    async recordRequest(value) { calls.push(['record', value]); return { state: 'requested' }; },
    async activateFree(value) { calls.push(['activate', value]); return { state: 'active', telegramUserId: value.telegramUserId }; },
    async markDeclined(value) { calls.push(['mark-declined', value]); return { state: 'declined' }; }
  };
  const botClient = {
    async approveChatJoinRequest(value) {
      calls.push(['approve', value]);
      if (approvalError) throw approvalError;
    },
    async declineChatJoinRequest(value) { calls.push(['decline', value]); }
  };
  const service = createTelegramMembershipAccessService({
    store,
    workspaceRegistry: { async resolveTelegramChatId(chatId) { calls.push(['resolve', chatId]); return workspace; } },
    botClient,
    identityResolver: async ({ platformFacts }) => ({
      identityContext: { globalUserId: `telegram:${platformFacts.platformUserId}` }
    }),
    clock: () => new Date('2026-08-18T12:00:00.000Z')
  });
  return { service, calls };
}

function request(userId = 77) {
  return {
    update_id: 1000 + userId,
    chat_join_request: {
      chat: { id: -100123, type: 'supergroup' },
      from: { id: userId, first_name: 'Member', username: `member${userId}` },
      date: 1787050800,
      user_chat_id: userId
    }
  };
}

test('free join request is persisted, approved and activated for the requesting user', async () => {
  const { service, calls } = fixture();
  const result = await service.handleUpdate(request(77));
  assert.equal(result.handled, true);
  assert.equal(result.outcome, 'approved-free');
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'record', 'approve', 'activate']);
  assert.equal(calls[1][1].telegramUserId, '77');
  assert.equal(calls[1][1].globalUserId, 'telegram:77');
  assert.deepEqual(calls[2][1], { chatId: '-100123', userId: '77' });
});

test('requests for an unregistered Telegram workspace fail closed', async () => {
  const { service, calls } = fixture({ workspace: null });
  const result = await service.handleUpdate(request(88));
  assert.equal(result.outcome, 'unknown-workspace-declined');
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'decline']);
});

test('Telegram approval failure records declined state and never activates access', async () => {
  const failure = Object.assign(new Error('forbidden'), { code: 'telegram-forbidden' });
  const { service, calls } = fixture({ approvalError: failure });
  await assert.rejects(() => service.handleUpdate(request(99)), failure);
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'record', 'approve', 'mark-declined']);
  assert.equal(calls.some(([name]) => name === 'activate'), false);
});

test('unrelated Telegram updates are not consumed', async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.handleUpdate({ update_id: 1, message: {} }), { handled: false });
  assert.deepEqual(calls, []);
});
