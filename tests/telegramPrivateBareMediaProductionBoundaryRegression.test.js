import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';
import { evaluateTelegramInvocation } from '../src/telegram/telegramInvocation.js';

function privatePhotoUpdate({ updateId = 9101, userId = 42, chatId = 42, fileId = 'photo-file' } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: userId, is_bot: false, language_code: 'ru' },
      chat: { id: chatId, type: 'private' },
      photo: [
        { file_id: 'small-photo', file_unique_id: 'small-unique' },
        { file_id: fileId, file_unique_id: `unique-${fileId}` }
      ]
    }
  };
}

function groupPhotoUpdate() {
  const source = privatePhotoUpdate({ updateId: 9102, chatId: -10042 });
  return {
    ...source,
    message: {
      ...source.message,
      chat: { id: -10042, type: 'supergroup' }
    }
  };
}

test('private bare Telegram media is accepted before semantic workspace routing', () => {
  const photo = privatePhotoUpdate();
  const invocation = evaluateTelegramInvocation(photo, { botUserId: 999, botUsername: 'garya_bot' });

  assert.equal(invocation.accepted, true);
  assert.equal(invocation.reason, 'private-media');

  const emptyPrivate = {
    update_id: 9103,
    message: {
      message_id: 9103,
      from: { id: 42, is_bot: false },
      chat: { id: 42, type: 'private' }
    }
  };
  assert.equal(evaluateTelegramInvocation(emptyPrivate).accepted, false);
  assert.equal(evaluateTelegramInvocation(emptyPrivate).reason, 'empty-message');

  const groupMedia = evaluateTelegramInvocation(groupPhotoUpdate(), { botUserId: 999, botUsername: 'garya_bot' });
  assert.equal(groupMedia.accepted, false);
  assert.equal(groupMedia.reason, 'empty-message');
});

test('production webhook forwards private bare media to workspace natural-language capture instead of ignoring it', async () => {
  const routed = [];
  const handled = [];
  const runtimeCalls = [];
  const store = createInMemoryTelegramUpdateStore();

  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async () => {} },
    updateStore: store,
    identityResolver: async () => ({
      identityContext: { globalUserId: 'user:42' },
      scopeContext: { userScope: 'user:42', projectScope: 'sg2.1', allowedCapabilities: ['compose-answer'] }
    }),
    runtime: {
      async handle(input) {
        runtimeCalls.push(input);
        return { status: 'success', message: 'runtime-fallback', data: {} };
      }
    },
    semanticRouter: {
      async routeUpdate(update) {
        routed.push(update);
        return {
          destination: 'telegram-workspace-manager',
          workspaceOperation: 'capture-media',
          directInvocation: true,
          reason: 'telegram-recent-media-context-capture'
        };
      }
    },
    naturalLanguage: {
      async handleUpdate(update, options) {
        handled.push({ update, options });
        return { handled: true, outcome: 'media-context-captured' };
      }
    },
    botUserId: 999,
    botUsername: 'garya_bot'
  });

  const photo = privatePhotoUpdate();
  const result = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: photo
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true, naturalLanguage: true });
  assert.equal(routed.length, 1);
  assert.equal(handled.length, 1);
  assert.equal(handled[0].update.message.photo.at(-1).file_id, 'photo-file');
  assert.equal(handled[0].options.semanticRoute.workspaceOperation, 'capture-media');
  assert.equal(runtimeCalls.length, 0);
  assert.equal(store.snapshot().get(photo.update_id).status, 'completed');
});
