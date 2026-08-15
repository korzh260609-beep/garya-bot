import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramSemanticSubsystemRouter } from '../src/telegram/telegramSemanticSubsystemRouter.js';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';
import { createTelegramWorkspaceUnifiedNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceUnifiedNaturalLanguageService.js';

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

test('semantic Telegram router classifies caption-based workspace media action as TWM operate without phrase rules', async () => {
  let request = null;
  const router = createTelegramSemanticSubsystemRouter({
    aiRouter: {
      async route(input) {
        request = input;
        return { text: JSON.stringify({ destination: 'telegram-workspace-manager', workspaceOperation: 'operate', directInvocation: true, reason: 'semantic workspace media publication request' }) };
      }
    },
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await router.routeUpdate({
    message: {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      caption: 'Опубликуй это изображение в моей рабочей группе',
      photo: [{ file_id: 'small' }, { file_id: 'actual-photo-file' }]
    }
  });

  assert.equal(result.destination, 'telegram-workspace-manager');
  assert.equal(result.workspaceOperation, 'operate');
  assert.equal(result.directInvocation, true);
  const payload = JSON.parse(request.messages[1].content);
  assert.equal(payload.hasPhoto, true);
  assert.equal(payload.text, 'Опубликуй это изображение в моей рабочей группе');
});

test('TWM media publication confirmation preserves actual Telegram file id and request-bound confirmation', async () => {
  const pending = pendingStore();
  const sent = [];
  const answered = [];
  const edited = [];
  const calls = [];
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route() {
        return {
          text: JSON.stringify({
            kind: 'operation',
            workspaceId: workspace.workspaceId,
            operation: 'media.publish',
            argumentsJson: JSON.stringify({ caption: 'Проверка', fileId: 'ai-must-not-control-this' }),
            summary: 'Опубликовать присланное изображение'
          })
        };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 900 }; },
      async answerCallbackQuery(input) { answered.push(input); return true; },
      async editMessageText(input) { edited.push(input); return true; }
    },
    identityResolver,
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId() { return null; },
      async getWorkspace(workspaceId) { return workspaceId === workspace.workspaceId ? workspace : null; }
    },
    authorityResolver: {
      async verify(input) {
        assert.equal(input.expectedGlobalUserId, 'user:owner');
        return { allowed: true };
      }
    },
    operationsService: {
      core: { store: { async listRecords() { return []; } } },
      async createDraft(ctx, args) {
        calls.push({ method: 'createDraft', ctx, args });
        return { recordId: 'content_1' };
      },
      async attachMedia(ctx, args) {
        calls.push({ method: 'attachMedia', ctx, args });
        return { recordId: 'content_1' };
      },
      async publishContent(ctx, args) {
        calls.push({ method: 'publishContent', ctx, args });
        return { recordId: 'content_1', status: 'published' };
      }
    },
    pendingStore: pending,
    projectScope: 'sg2.1',
    idFactory: (() => { const ids = ['trace-fixed', 'request-fixed']; return () => ids.shift() ?? 'extra'; })()
  });

  const incoming = {
    update_id: 701,
    message: {
      message_id: 11,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      caption: 'Опубликуй эту фотографию в Sandbox',
      photo: [
        { file_id: 'small-photo', file_unique_id: 'small-unique' },
        { file_id: 'actual-photo-file', file_unique_id: 'actual-photo-unique' }
      ]
    }
  };

  const prepared = await service.handleUpdate(incoming, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });
  assert.equal(prepared.outcome, 'operation-pending');
  assert.equal(calls.length, 0);
  assert.equal(pending.snapshot().requestId, 'request-fixed');
  assert.equal(pending.snapshot().proposal.media.fileId, 'actual-photo-file');
  assert.equal(JSON.stringify(pending.snapshot().proposal).includes('ai-must-not-control-this'), true);
  assert.equal(sent[0].replyMarkup.inline_keyboard[0][0].callback_data, 'twm19|op-confirm|pending-token');

  const confirmed = await service.handleUpdate({
    update_id: 702,
    callback_query: {
      id: 'callback-1',
      data: 'twm19|op-confirm|pending-token',
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      message: { message_id: 900, chat: { id: 42, type: 'private' } }
    }
  });

  assert.equal(confirmed.outcome, 'operation-executed');
  assert.deepEqual(calls.map((call) => call.method), ['createDraft', 'attachMedia', 'publishContent']);
  assert.equal(calls[1].args.fileId, 'actual-photo-file');
  assert.notEqual(calls[1].args.fileId, 'ai-must-not-control-this');
  assert.equal(calls[2].ctx.confirmation.confirmed, true);
  assert.equal(calls[2].ctx.confirmation.requestId, 'request-fixed');
  assert.equal(calls[2].ctx.requestId, 'request-fixed');
  assert.equal(answered.at(-1).text, 'Выполнено');
  assert.equal(edited.length, 1);
  assert.equal(pending.snapshot().status, 'completed');
});

test('unified TWM natural-language dispatcher keeps config callbacks and operation callbacks separated', async () => {
  const calls = [];
  const unified = createTelegramWorkspaceUnifiedNaturalLanguageService({
    configurationNaturalLanguage: {
      async handleUpdate() { calls.push('config'); return { handled: true }; },
      async routeUpdate() { return { destination: 'runtime' }; }
    },
    operationsNaturalLanguage: {
      async handleUpdate() { calls.push('operations'); return { handled: true }; }
    }
  });

  await unified.handleUpdate({ callback_query: { data: 'twm19|op-confirm|token' } });
  await unified.handleUpdate({ callback_query: { data: 'twm19|apply|token' } });
  await unified.handleUpdate({ message: { text: 'x' } }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.deepEqual(calls, ['operations', 'config', 'operations']);
});
