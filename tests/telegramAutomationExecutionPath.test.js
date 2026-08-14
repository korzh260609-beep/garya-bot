import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityContext, createScopeContext } from '../src/contracts/context.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';

const fixedNow = new Date('2026-08-14T15:00:00.000Z');

function automationInterpretation() {
  return {
    meaning: 'Create a one-shot self notification in two minutes.',
    goal: 'schedule-self-notification',
    intent: 'task-create',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    memoryQuery: null,
    conversationHistoryQuery: null,
    subsystemRequest: null,
    memoryCandidates: [],
    candidateActions: [{
      type: 'task-create',
      name: 'task-create',
      actionClass: 'state-change',
      payload: {
        kind: 'self-notification',
        notificationMessage: 'привет',
        temporalExpression: 'через 2 минуты'
      }
    }],
    rationale: 'The user explicitly requested a future self-notification.'
  };
}

function telegramUpdate() {
  return {
    update_id: 920001,
    message: {
      message_id: 501,
      from: { id: 7, is_bot: false, language_code: 'ru' },
      chat: { id: 7007, type: 'private' },
      text: 'Пришли мне через 2 минуты привет'
    }
  };
}

test('Telegram self-notification reaches Action Gate and executes task-create instead of legacy prepare-only response', async () => {
  const harness = createLocalProductionHarness({
    clock: () => fixedNow,
    interpretationResolver: () => automationInterpretation()
  });
  const globalUserId = 'telegram:7';
  const sent = [];

  const identityResolver = async ({ platformFacts, scopeFacts }) => {
    const grants = harness.capabilityNames.map((name) => `capability:${name}`);
    return {
      identityContext: createIdentityContext({
        globalUserId,
        platform: 'telegram',
        platformUserId: String(platformFacts.platformUserId),
        linkStatus: 'linked',
        roles: ['monarch'],
        grants,
        authenticationLevel: 'telegram-webhook'
      }),
      scopeContext: createScopeContext({
        userScope: globalUserId,
        projectScope: scopeFacts.projectId ?? 'sg2.1',
        groupScope: scopeFacts.groupId ?? null,
        threadScope: scopeFacts.threadId ?? null,
        allowedCapabilities: harness.capabilityNames
      })
    };
  };

  const integration = createTelegramProductionIntegration({
    secretToken: 'test-secret',
    botClient: { sendMessage: async (payload) => { sent.push(payload); return { message_id: 9001 }; } },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: harness.runtime,
    botUserId: 999,
    botUsername: 'garya_bot',
    environment: 'test',
    revision: 'telegram-automation-execution-path',
    idFactory: (() => { let sequence = 0; return () => `telegram-automation-${++sequence}`; })()
  });

  await harness.temporalService.setUserTimezone(globalUserId, 'Europe/Kyiv', { source: 'test' });
  await harness.runtime.start();
  try {
    const webhook = await integration.handleWebhook({
      headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
      body: telegramUpdate()
    });

    assert.equal(webhook.statusCode, 200);
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].text, /Prepared action|Execution is disabled before Action Gate/);
    assert.match(sent[0].text, /Задача создана/);

    const tasks = await harness.taskStore.list({
      scope: { userScope: globalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null }
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].payload.message, 'привет');
    assert.equal(tasks[0].runAt, '2026-08-14T15:02:00.000Z');
  } finally {
    await harness.runtime.stop();
  }
});
