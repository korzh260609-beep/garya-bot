import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';

function identityResolver() {
  return Promise.resolve({ identityContext: { globalUserId: 'user:owner' } });
}

function pendingStore() {
  let item = null;
  return Object.freeze({
    async create(input) {
      item = { ...input, token: 'pending-token', status: 'pending' };
      return item;
    },
    async claim({ token, actorGlobalUserId, telegramUserId }) {
      if (!item || token !== item.token || actorGlobalUserId !== item.actorGlobalUserId || telegramUserId !== item.telegramUserId || item.status !== 'pending') return item;
      item = { ...item, status: 'processing' };
      return item;
    },
    async complete(token) {
      if (item?.token === token && item.status === 'processing') item = { ...item, status: 'completed' };
      return item;
    },
    async fail(token) {
      if (item?.token === token && item.status === 'processing') item = { ...item, status: 'failed' };
      return item;
    },
    async cancel({ token }) {
      if (item?.token === token && item.status === 'pending') item = { ...item, status: 'cancelled' };
      return item?.status === 'cancelled' ? item : null;
    },
    snapshot: () => item
  });
}

function createHarness(aiOutput) {
  const pending = pendingStore();
  const sent = [];
  const calls = [];
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: { async route() { return { text: JSON.stringify(aiOutput) }; } },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 900 }; },
      async answerCallbackQuery() { return true; },
      async editMessageText() { return true; }
    },
    identityResolver,
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId() { return null; },
      async getWorkspace(workspaceId) { return workspaceId === workspace.workspaceId ? workspace : null; }
    },
    authorityResolver: { async verify() { return { allowed: true }; } },
    operationsService: {
      core: { store: { async listRecords() { return []; } } },
      async createDraft(ctx, args) {
        calls.push({ method: 'createDraft', ctx, args });
        return { recordId: 'content_1', status: 'draft' };
      },
      async publishContent(ctx, args) {
        calls.push({ method: 'publishContent', ctx, args });
        return { recordId: args.contentId, status: 'published' };
      },
      async scheduleContent(ctx, args) {
        calls.push({ method: 'scheduleContent', ctx, args });
        return { recordId: args.contentId, status: 'scheduled' };
      }
    },
    pendingStore: pending,
    projectScope: 'sg2.1',
    idFactory: (() => { const ids = ['trace-fixed', 'request-fixed']; return () => ids.shift() ?? 'extra'; })()
  });
  return { service, pending, sent, calls, workspace };
}

function incoming(text) {
  return {
    update_id: 801,
    message: {
      message_id: 21,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text
    }
  };
}

test('new text whose semantic end state is publication is created and published only after confirmation', async () => {
  const h = createHarness({
    kind: 'operation',
    workspaceId: 'telegram:workspace:100',
    operation: 'content.publish',
    argumentsJson: JSON.stringify({ text: 'ПРИВЕТ' }),
    summary: 'Разместить новый текст в Sandbox'
  });

  const prepared = await h.service.handleUpdate(incoming('размести привет в Sandbox'), { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });
  assert.equal(prepared.outcome, 'operation-pending');
  assert.equal(prepared.operation, 'content.publish');
  assert.equal(h.calls.length, 0);
  assert.equal(h.pending.snapshot().proposal.arguments.text, 'ПРИВЕТ');
  assert.ok(h.sent[0].replyMarkup);

  const requestId = h.pending.snapshot().requestId;
  const confirmed = await h.service.handleUpdate({
    update_id: 802,
    callback_query: {
      id: 'callback-2',
      data: 'twm19|op-confirm|pending-token',
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      message: { message_id: 900, chat: { id: 42, type: 'private' } }
    }
  });

  assert.equal(confirmed.outcome, 'operation-executed');
  assert.deepEqual(h.calls.map((call) => call.method), ['createDraft', 'publishContent']);
  assert.equal(h.calls[0].args.text, 'ПРИВЕТ');
  assert.equal(h.calls[1].args.contentId, 'content_1');
  assert.equal(h.calls[0].ctx.confirmation.confirmed, true);
  assert.equal(h.calls[1].ctx.confirmation.requestId, requestId);
});

test('explicit draft-only semantic end state remains content.create and does not publish', async () => {
  const h = createHarness({
    kind: 'operation',
    workspaceId: 'telegram:workspace:100',
    operation: 'content.create',
    argumentsJson: JSON.stringify({ kind: 'text', text: 'ПРИВЕТ' }),
    summary: 'Подготовить черновик текста'
  });

  const result = await h.service.handleUpdate(incoming('подготовь черновик для Sandbox'), { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });
  assert.equal(result.outcome, 'operation-executed');
  assert.deepEqual(h.calls.map((call) => call.method), ['createDraft']);
  assert.equal(h.calls[0].args.text, 'ПРИВЕТ');
  assert.equal(h.pending.snapshot(), null);
});
