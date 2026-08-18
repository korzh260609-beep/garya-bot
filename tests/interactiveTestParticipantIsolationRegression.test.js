import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';

function callbackUpdate({ userId, data, chatId = '-1001', chatType = 'supergroup', messageId = 10 }) {
  return {
    update_id: Number(userId) + messageId,
    callback_query: {
      id: `callback-${userId}-${messageId}`,
      from: { id: Number(userId), is_bot: false, language_code: 'ru', first_name: `User ${userId}` },
      data,
      message: { message_id: messageId, chat: { id: Number(chatId), type: chatType } }
    }
  };
}

function harness() {
  const sent = [];
  const edited = [];
  const answered = [];
  const sessions = new Map();
  let sequence = 0;
  const workspace = { workspaceId: 'workspace-1', telegramChatId: '-1001', workspaceType: 'supergroup', title: 'Group' };
  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: { async route() { throw new Error('AI must not run for callbacks'); } },
    botClient: {
      async sendMessage(payload) { sent.push(payload); return { message_id: 100 + sent.length }; },
      async editMessageText(payload) { edited.push(payload); return true; },
      async answerCallbackQuery(payload) { answered.push(payload); return true; }
    },
    identityResolver: async ({ platformFacts }) => ({ identityContext: { globalUserId: `user:${platformFacts.platformUserId}` } }),
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId(chatId) { return String(chatId) === workspace.telegramChatId ? workspace : null; },
      async getWorkspace() { return workspace; }
    },
    authorityResolver: { async verify() { return { allowed: true }; } },
    operationsService: {
      core: { store: {} },
      async startInteractiveTest(ctx) {
        const sessionId = `session-${++sequence}`;
        sessions.set(sessionId, ctx.actorGlobalUserId);
        return { text: `Question for ${ctx.actorGlobalUserId}`, replyMarkup: { inline_keyboard: [[{ text: 'A', callback_data: `twmt|a|${sessionId}|0` }]] } };
      },
      async answerInteractiveTest(ctx, { sessionId }) {
        assert.equal(sessions.get(sessionId), ctx.actorGlobalUserId, 'a participant may answer only their own session');
        return { completed: true, text: `Completed for ${ctx.actorGlobalUserId}`, replyMarkup: null };
      }
    },
    pendingStore: {
      async create() { return { token: 'unused' }; },
      async claim() { return null; },
      async complete() {},
      async fail() {},
      async cancel() { return false; }
    },
    idFactory: (() => { let value = 0; return () => `id-${++value}`; })()
  });
  return { service, sent, edited, answered };
}

test('two group participants get isolated private test sessions and one completion never closes the other session', async () => {
  const { service, sent, edited, answered } = harness();

  const first = await service.handleInteractiveTestCallback(callbackUpdate({ userId: '101', data: 'twmt|s|test-1', messageId: 11 }));
  const second = await service.handleInteractiveTestCallback(callbackUpdate({ userId: '202', data: 'twmt|s|test-1', messageId: 12 }));

  assert.equal(first.outcome, 'interactive-test-started');
  assert.equal(second.outcome, 'interactive-test-started');
  assert.equal(first.privateDelivery, true);
  assert.equal(second.privateDelivery, true);
  assert.deepEqual(sent.map((row) => String(row.chatId)), ['101', '202']);
  assert.equal(sent.some((row) => String(row.chatId) === '-1001'), false);
  assert.equal(edited.length, 0);

  const completed = await service.handleInteractiveTestCallback(callbackUpdate({
    userId: '202',
    data: 'twmt|a|session-2|0',
    chatId: '202',
    chatType: 'private',
    messageId: 102
  }));

  assert.equal(completed.outcome, 'interactive-test-completed');
  assert.equal(edited.length, 1);
  assert.equal(String(edited[0].chatId), '202');
  assert.equal(edited.some((row) => String(row.chatId) === '101' || String(row.chatId) === '-1001'), false);
  assert.match(answered.at(-1).text, /Тест завершён/u);
});
