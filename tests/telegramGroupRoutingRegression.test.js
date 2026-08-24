import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';
import { createTelegramWorkspaceRuntimeWiring } from '../src/telegramWorkspace/telegramWorkspaceRuntimeWiring.js';

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

function groupUpdate(updateId, text = 'Привет, СГ') {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 7, is_bot: false, language_code: 'ru' },
      chat: { id: -100123, type: 'supergroup', title: 'SG test group' },
      text
    }
  };
}

function workspaceRuntime(runtime, responseConfig = null) {
  const workspaceRegistry = {
    async resolveTelegramChatId(chatId) {
      return String(chatId) === '-100123'
        ? Object.freeze({ workspaceId: 'tgw_group_regression', telegramChatId: '-100123' })
        : null;
    }
  };
  const workspaceStore = {
    async listConfigs() {
      const rows = [{ namespace: 'ai', config: { enabled: true } }];
      if (responseConfig) rows.push({ namespace: 'responses', config: responseConfig });
      return rows;
    }
  };
  return createTelegramWorkspaceRuntimeWiring({ runtime, workspaceRegistry, workspaceStore });
}

function integrationFixture({ responseConfig = null } = {}) {
  const handled = [];
  const sent = [];
  const runtime = {
    async handle(input) {
      handled.push(input);
      return { status: 'success', message: `SG: ${input.text}`, data: {} };
    }
  };
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async (payload) => sent.push(payload) },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime,
    workspaceRuntime: workspaceRuntime(runtime, responseConfig)
  });
  return { integration, handled, sent };
}

test('managed Telegram group accepts ordinary user text without @ by default', async () => {
  const fx = integrationFixture();
  const result = await fx.integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupUpdate(8101, 'Как дела?')
  });

  assert.deepEqual(result.body, { ok: true });
  assert.equal(fx.handled.length, 1);
  assert.equal(fx.handled[0].text, 'Как дела?');
  assert.equal(fx.handled[0].scopeContext.groupScope, '-100123');
  assert.equal(fx.sent.length, 1);
  assert.equal(fx.sent[0].chatId, -100123);
  assert.equal(fx.sent[0].replyToMessageId, 8101);
});

test('explicit mention_only still keeps ordinary ambient group text silent', async () => {
  const fx = integrationFixture({ responseConfig: { mode: 'mention_only', reply_enabled: true } });
  const result = await fx.integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupUpdate(8102, 'Обычное сообщение')
  });

  assert.equal(result.body.ignored, true);
  assert.equal(result.body.reason, 'group-not-invoked');
  assert.equal(fx.handled.length, 0);
  assert.equal(fx.sent.length, 0);
});

test('explicit off still disables replies for the managed group', async () => {
  const fx = integrationFixture({ responseConfig: { mode: 'off' } });
  const result = await fx.integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: groupUpdate(8103, 'Ты здесь?')
  });

  assert.equal(result.body.ignored, true);
  assert.equal(result.body.reason, 'workspace-responses-off');
  assert.equal(fx.handled.length, 0);
  assert.equal(fx.sent.length, 0);
});
