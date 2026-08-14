import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';

function identityResolver({ platformFacts, scopeFacts }) {
  return {
    identityContext: {
      globalUserId: `global:${platformFacts.platformUserId}`,
      roles: ['guest'],
      grants: ['capability:compose-answer'],
      authenticationLevel: 'platform'
    },
    scopeContext: {
      userScope: `global:${platformFacts.platformUserId}`,
      projectScope: scopeFacts.projectId ?? 'sg2.1',
      groupScope: scopeFacts.groupId,
      threadScope: scopeFacts.threadId,
      requestedUserScope: `global:${platformFacts.platformUserId}`,
      requestedProjectScope: scopeFacts.projectId ?? 'sg2.1',
      requestedGroupScope: scopeFacts.groupId,
      requestedThreadScope: scopeFacts.threadId,
      allowedCapabilities: ['compose-answer']
    }
  };
}

function groupMessage({ updateId, text, entities = [], replyToMessage = null }) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 7, is_bot: false },
      chat: { id: -100777, type: 'supergroup' },
      text,
      entities,
      ...(replyToMessage ? { reply_to_message: replyToMessage } : {})
    }
  };
}

test('group @mention works without TELEGRAM_BOT_USERNAME by discovering bot identity through getMe', async () => {
  let getMeCalls = 0;
  const handled = [];
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: {
      async getMe() {
        getMeCalls += 1;
        return { id: 999, is_bot: true, username: 'garya_bot' };
      },
      async sendMessage() {}
    },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: {
      async handle(input) {
        handled.push(input);
        return { status: 'success', message: 'ok', data: {} };
      }
    }
  });

  const first = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupMessage({
      updateId: 8201,
      text: '@garya_bot привет',
      entities: [{ type: 'mention', offset: 0, length: 10 }]
    })
  });
  const second = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupMessage({
      updateId: 8202,
      text: 'ответ на сообщение СГ',
      replyToMessage: { from: { id: 999, is_bot: true, username: 'garya_bot' } }
    })
  });

  assert.deepEqual(first.body, { ok: true });
  assert.deepEqual(second.body, { ok: true });
  assert.equal(handled.length, 2);
  assert.equal(getMeCalls, 1);
});

test('getMe failure fails open only for bot addressing metadata and does not crash group ingress', async () => {
  const failures = [];
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: {
      async getMe() { throw Object.assign(new Error('temporary Telegram failure'), { code: 'telegram-network-failure' }); },
      async sendMessage() {}
    },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: { async handle() { return { status: 'success', message: 'ok', data: {} }; } },
    observability: { recordFailure(event) { failures.push(event); } }
  });

  const result = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupMessage({ updateId: 8203, text: 'обычное сообщение' })
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.ignored, true);
  assert.equal(result.body.reason, 'group-not-invoked');
  assert.equal(failures[0].stage, 'telegram-bot-identity');
}
