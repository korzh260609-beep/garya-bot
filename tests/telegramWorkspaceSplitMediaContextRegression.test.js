import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';
import { createTelegramWorkspaceUnifiedNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceUnifiedNaturalLanguageService.js';
import { clearRecentMediaForTests, captureRecentMedia, getRecentMedia } from '../src/telegramWorkspace/telegramRecentMediaEphemeralContext.js';

function pendingStore() {
  let item = null;
  return Object.freeze({
    async create(input) { item = { ...input, token: 'pending-token', status: 'pending' }; return item; },
    async claim({ token, actorGlobalUserId, telegramUserId }) {
      if (!item || token !== item.token || actorGlobalUserId !== item.actorGlobalUserId || telegramUserId !== item.telegramUserId || item.status !== 'pending') return item;
      item = { ...item, status: 'processing' };
      return item;
    },
    async complete(token) { if (item?.token === token && item.status === 'processing') item = { ...item, status: 'completed' }; return item; },
    async fail(token) { if (item?.token === token && item.status === 'processing') item = { ...item, status: 'failed' }; return item; },
    async cancel({ token }) { if (item?.token === token && item.status === 'pending') item = { ...item, status: 'cancelled' }; return item?.status === 'cancelled' ? item : null; },
    snapshot: () => item
  });
}

function photoUpdate({ updateId = 100, userId = 42, chatId = 42, fileId = 'real-photo-file' } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      chat: { id: chatId, type: 'private' },
      from: { id: userId, first_name: 'Owner', language_code: 'ru' },
      photo: [{ file_id: 'small' }, { file_id: fileId, file_unique_id: `unique-${fileId}` }]
    }
  };
}

function textUpdate({ updateId = 101, userId = 42, chatId = 42, text = 'опубликуй это фото в Sandbox' } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      chat: { id: chatId, type: 'private' },
      from: { id: userId, first_name: 'Owner', language_code: 'ru' },
      text
    }
  };
}

test('bare photo followed by a separate publication request carries the real Telegram media through confirmation', async () => {
  clearRecentMediaForTests();
  const pending = pendingStore();
  const calls = [];
  const sent = [];
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };

  const operations = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route(input) {
        const payload = JSON.parse(input.messages[1].content);
        assert.equal(payload.mediaAvailable, true);
        assert.equal(payload.mediaType, 'photo');
        return { text: JSON.stringify({ kind: 'operation', workspaceId: workspace.workspaceId, operation: 'media.publish', argumentsJson: '{}', summary: 'Опубликовать последнее присланное фото в Sandbox' }) };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 900 }; },
      async answerCallbackQuery() { return true; },
      async editMessageText() { return true; }
    },
    identityResolver: async () => ({ identityContext: { globalUserId: 'user:owner' } }),
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId() { return null; },
      async getWorkspace(id) { return id === workspace.workspaceId ? workspace : null; }
    },
    authorityResolver: { async verify() { return { allowed: true }; } },
    operationsService: {
      core: { store: { async listRecords() { return []; } } },
      async publishMedia(ctx, args) {
        calls.push({ ctx, args });
        return { recordId: 'content_1', status: 'published' };
      }
    },
    pendingStore: pending,
    projectScope: 'sg2.1',
    idFactory: (() => { const ids = ['trace-split', 'request-split']; return () => ids.shift() ?? 'extra'; })()
  });

  const unified = createTelegramWorkspaceUnifiedNaturalLanguageService({
    configurationNaturalLanguage: {
      async routeUpdate() { return { destination: 'telegram-workspace-manager', workspaceOperation: 'operate', directInvocation: true, reason: 'semantic-media-publication' }; },
      async handleUpdate() { return { handled: false }; }
    },
    operationsNaturalLanguage: operations
  });

  const photo = photoUpdate();
  const photoRoute = await unified.routeUpdate(photo);
  assert.equal(photoRoute.workspaceOperation, 'capture-media');
  const captured = await unified.handleUpdate(photo, { semanticRoute: photoRoute });
  assert.equal(captured.outcome, 'media-context-captured');

  const command = textUpdate();
  const commandRoute = await unified.routeUpdate(command);
  assert.equal(commandRoute.workspaceOperation, 'operate');
  const prepared = await unified.handleUpdate(command, { semanticRoute: commandRoute });
  assert.equal(prepared.outcome, 'operation-pending');
  assert.equal(pending.snapshot().proposal.media.fileId, 'real-photo-file');
  assert.equal(calls.length, 0);
  assert.ok(sent[0].replyMarkup);

  const confirmed = await unified.handleUpdate({
    update_id: 102,
    callback_query: {
      id: 'callback-split',
      data: 'twm19|op-confirm|pending-token',
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      message: { message_id: 900, chat: { id: 42, type: 'private' } }
    }
  });

  assert.equal(confirmed.outcome, 'operation-executed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.fileId, 'real-photo-file');
  assert.equal(calls[0].args.mediaType, 'photo');
  assert.equal(calls[0].ctx.confirmation.confirmed, true);
  assert.equal(pending.snapshot().status, 'completed');
});

test('recent media context is isolated by Telegram actor and chat and expires', () => {
  clearRecentMediaForTests();
  const source = photoUpdate({ userId: 42, chatId: 42, fileId: 'scoped-photo' });
  captureRecentMedia(source, { ttlMs: 1000, now: 1000 });

  assert.equal(getRecentMedia(textUpdate({ userId: 42, chatId: 42 }), { now: 1500 })?.fileId, 'scoped-photo');
  assert.equal(getRecentMedia(textUpdate({ userId: 43, chatId: 42 }), { now: 1500 }), null);
  assert.equal(getRecentMedia(textUpdate({ userId: 42, chatId: 99 }), { now: 1500 }), null);
  assert.equal(getRecentMedia(textUpdate({ userId: 42, chatId: 42 }), { now: 2001 }), null);
});
