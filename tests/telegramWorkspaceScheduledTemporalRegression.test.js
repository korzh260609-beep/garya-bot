import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';

function createPendingStore() {
  const rows = new Map();
  let sequence = 0;
  return {
    async create(row) {
      const token = `pending-${++sequence}`;
      rows.set(token, { ...row, token, status: 'pending' });
      return { token };
    },
    async claim({ token, actorGlobalUserId, telegramUserId }) {
      const row = rows.get(token);
      if (!row || row.status !== 'pending' || row.actorGlobalUserId !== actorGlobalUserId || row.telegramUserId !== telegramUserId) return null;
      const claimed = { ...row, status: 'processing' };
      rows.set(token, claimed);
      return claimed;
    },
    async complete(token) { const row = rows.get(token); if (row) rows.set(token, { ...row, status: 'completed' }); },
    async fail(token) { const row = rows.get(token); if (row) rows.set(token, { ...row, status: 'failed' }); },
    async cancel() { return false; },
    snapshot() { return new Map(rows); }
  };
}

function privateTextUpdate(text) {
  return {
    update_id: 1001,
    message: {
      message_id: 501,
      from: { id: 42, is_bot: false, language_code: 'ru', first_name: 'Test' },
      chat: { id: 42, type: 'private' },
      text
    }
  };
}

test('relative scheduled publication uses deterministic TemporalService instant through confirmation', async () => {
  const scheduled = [];
  const drafts = [];
  const sent = [];
  const edited = [];
  const answered = [];
  const pendingStore = createPendingStore();
  const expectedRunAt = '2026-08-15T16:00:00.000Z';
  const workspace = { workspaceId: 'workspace-1', title: 'GARYA_пісочниця', workspaceType: 'supergroup' };

  const operationsService = {
    core: { store: { async listRecords() { return []; } } },
    temporalService: {
      async resolveForUser(globalUserId, expression) {
        assert.equal(globalUserId, 'user:42');
        assert.match(expression, /5 минут/u);
        return {
          status: 'resolved',
          utcStart: expectedRunAt,
          utcEndExclusive: null,
          localStart: '2026-08-15T19:00:00',
          timeZone: 'Europe/Kyiv',
          precision: 'minute',
          ambiguous: false
        };
      }
    },
    async createDraft(ctx, args) {
      drafts.push({ ctx, args });
      return { recordId: 'content-1' };
    },
    async scheduleContent(ctx, args) {
      scheduled.push({ ctx, args });
      return { recordId: args.contentId, status: 'scheduled', payload: { scheduledFor: args.runAt } };
    }
  };

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route(request) {
        const userPayload = JSON.parse(request.messages[1].content);
        assert.equal(userPayload.schedulingFacts.utcStart, expectedRunAt);
        return {
          text: JSON.stringify({
            kind: 'operation',
            workspaceId: workspace.workspaceId,
            operation: 'content.schedule',
            argumentsJson: JSON.stringify({ text: 'Тест отложенной публикации SG' }),
            summary: 'Отложенная публикация тестового сообщения'
          })
        };
      }
    },
    botClient: {
      async sendMessage(payload) { sent.push(payload); return { message_id: 900 }; },
      async editMessageText(payload) { edited.push(payload); return true; },
      async answerCallbackQuery(payload) { answered.push(payload); return true; }
    },
    identityResolver: async () => ({ identityContext: { globalUserId: 'user:42' } }),
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId() { return null; },
      async getWorkspace(workspaceId) { return workspaceId === workspace.workspaceId ? workspace : null; }
    },
    authorityResolver: { async verify() { return { allowed: true }; } },
    operationsService,
    pendingStore,
    idFactory: (() => { let n = 0; return () => `id-${++n}`; })()
  });

  const request = privateTextUpdate('Опубликуй в GARYA_пісочниця сообщение «Тест отложенной публикации SG» через 5 минут');
  const pending = await service.handleUpdate(request);

  assert.equal(pending.handled, true);
  assert.equal(pending.outcome, 'operation-pending');
  assert.equal(scheduled.length, 0);
  const stored = pendingStore.snapshot().get('pending-1');
  assert.equal(stored.proposal.arguments.runAt, expectedRunAt);
  assert.equal(stored.proposal.arguments.text, 'Тест отложенной публикации SG');
  assert.equal(sent.length, 1);

  const callback = {
    update_id: 1002,
    callback_query: {
      id: 'callback-1',
      from: { id: 42, is_bot: false, language_code: 'ru', first_name: 'Test' },
      data: 'twm19|op-confirm|pending-1',
      message: { message_id: 900, chat: { id: 42, type: 'private' } }
    }
  };
  const completed = await service.handleUpdate(callback);

  assert.equal(completed.handled, true);
  assert.equal(completed.outcome, 'operation-executed');
  assert.equal(drafts.length, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].args.contentId, 'content-1');
  assert.equal(scheduled[0].args.runAt, expectedRunAt);
  assert.equal(scheduled[0].ctx.confirmation.confirmed, true);
  assert.equal(pendingStore.snapshot().get('pending-1').status, 'completed');
  assert.equal(answered.at(-1).text, 'Выполнено');
  assert.match(edited.at(-1).text, /Готово:/u);
});
