import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramBotApiClient, TelegramApiError } from '../src/telegram/telegramBotApiClient.js';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';
import { evaluateTelegramInvocation } from '../src/telegram/telegramInvocation.js';

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

function update(overrides = {}) {
  return {
    update_id: 101,
    message: {
      message_id: 11,
      from: { id: 7, is_bot: false, language_code: 'ru' },
      chat: { id: 70, type: 'private' },
      text: 'Привет'
    },
    ...overrides
  };
}

test('Block 14 verifies webhook secret, deduplicates and delivers through the full runtime path', async () => {
  const sent = [];
  const handled = [];
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret-123',
    botClient: { sendMessage: async (payload) => sent.push(payload) },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: { handle: async (canonicalInput) => {
      handled.push(canonicalInput);
      return { status: 'success', message: `SG: ${canonicalInput.text}`, data: {} };
    } },
    botUserId: 999,
    botUsername: 'garya_bot',
    environment: 'test',
    revision: 'block-14',
    idFactory: (() => { let i = 0; return () => `id-${++i}`; })()
  });

  const unauthorized = await integration.handleWebhook({ headers: {}, body: update() });
  assert.equal(unauthorized.statusCode, 401);

  const first = await integration.handleWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret-123' }, body: update() });
  const duplicate = await integration.handleWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret-123' }, body: update() });

  assert.deepEqual(first.body, { ok: true });
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(handled.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(handled[0].metadata.transport, 'telegram');
  assert.equal(handled[0].identityContext.globalUserId, 'global:7');
  assert.equal(sent[0].chatId, 70);
  assert.equal(sent[0].replyToMessageId, 11);
});

test('Block 14 isolates group users and topic scopes while requiring explicit invocation', async () => {
  const inputs = [];
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async () => {} },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: { handle: async (input) => { inputs.push(input); return { status: 'success', message: 'ok', data: {} }; } },
    botUserId: 999,
    botUsername: 'garya_bot'
  });

  const baseMessage = {
    message_id: 20,
    from: { id: 7, is_bot: false },
    chat: { id: -100, type: 'supergroup' },
    message_thread_id: 55,
    text: 'обычное сообщение'
  };
  const ignored = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { update_id: 201, message: baseMessage }
  });
  assert.equal(ignored.body.ignored, true);

  await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { update_id: 202, message: { ...baseMessage, text: '@garya_bot ответь', entities: [{ type: 'mention', offset: 0, length: 10 }] } }
  });
  await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { update_id: 203, message: { ...baseMessage, message_id: 21, from: { id: 8, is_bot: false }, text: '/health' } }
  });

  assert.equal(inputs.length, 2);
  assert.equal(inputs[0].scopeContext.groupScope, '-100');
  assert.equal(inputs[0].scopeContext.threadScope, '55');
  assert.notEqual(inputs[0].identityContext.globalUserId, inputs[1].identityContext.globalUserId);
});

test('Block 14 accepts replies and supported commands but rejects silent group traffic', () => {
  assert.equal(evaluateTelegramInvocation(update(), { botUserId: 999 }).accepted, true);
  const group = update({ message: { message_id: 1, from: { id: 7 }, chat: { id: -1, type: 'group' }, text: 'hello' } });
  assert.equal(evaluateTelegramInvocation(group, { botUserId: 999 }).accepted, false);
  assert.equal(evaluateTelegramInvocation({ ...group, message: { ...group.message, text: '/tasks' } }, { botUserId: 999 }).accepted, true);
  assert.equal(evaluateTelegramInvocation({ ...group, message: { ...group.message, reply_to_message: { from: { id: 999 } } } }, { botUserId: 999 }).accepted, true);
});

test('Block 14 Bot API client retries flood control and normalizes bounded failure', async () => {
  let calls = 0;
  const sleeps = [];
  const client = createTelegramBotApiClient({
    token: 'token',
    sleep: async (ms) => sleeps.push(ms),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 429, json: async () => ({ ok: false, description: 'Too Many Requests', parameters: { retry_after: 1 } }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    }
  });
  const result = await client.sendMessage({ chatId: 1, text: 'ok' });
  assert.equal(result.message_id, 1);
  assert.deepEqual(sleeps, [1000]);

  const failing = createTelegramBotApiClient({
    token: 'token',
    maxRetries: 0,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: 'Bad Request' }) })
  });
  await assert.rejects(() => failing.sendMessage({ chatId: 1, text: 'bad' }), (error) => error instanceof TelegramApiError && error.code === 'telegram-api-failed');
});

test('Block 14 returns visible bounded failure when Telegram delivery is unavailable', async () => {
  const store = createInMemoryTelegramUpdateStore();
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async () => { throw new TelegramApiError('offline', { code: 'telegram-network-failure', retryable: true }); } },
    updateStore: store,
    identityResolver,
    runtime: { handle: async () => ({ status: 'success', message: 'ok', data: {} }) }
  });
  const result = await integration.handleWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: update({ update_id: 301 }) });
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, 'telegram-network-failure');
  assert.equal(store.snapshot().get(301).status, 'failed');
});
