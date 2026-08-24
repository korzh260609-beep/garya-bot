import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramProductionIntegration, createInMemoryTelegramUpdateStore } from '../src/telegram/telegramProductionIntegration.js';
import { createTelegramSemanticSubsystemRouter } from '../src/telegram/telegramSemanticSubsystemRouter.js';

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

function groupUpdate({ updateId = 901, text = 'Подскажи, что у меня записано про машину?', entities, replyToMessage } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 7, is_bot: false, language_code: 'ru' },
      chat: { id: -10077, type: 'supergroup' },
      text,
      ...(entities ? { entities } : {}),
      ...(replyToMessage ? { reply_to_message: replyToMessage } : {})
    }
  };
}

function workspaceRuntime({ mode = 'mention_only', aiEnabled = true, handled = [] } = {}) {
  return {
    async evaluateInvocation({ baseInvocation }) {
      if (mode === 'off') {
        return Object.freeze({ ...baseInvocation, accepted: false, reason: 'workspace-responses-off', workspaceRuntimePolicy: { responseMode: 'off', aiEnabled } });
      }
      if (mode === 'all') {
        return Object.freeze({ ...baseInvocation, accepted: true, reason: baseInvocation.accepted ? baseInvocation.reason : 'workspace-response-mode-all', workspaceRuntimePolicy: { responseMode: 'all', aiEnabled } });
      }
      return Object.freeze({ ...baseInvocation, workspaceRuntimePolicy: { responseMode: 'mention_only', aiEnabled } });
    },
    async handle(input) {
      handled.push(input);
      return { status: 'success', message: 'ok', data: {} };
    }
  };
}

function integration({ mode = 'mention_only', semanticRoute, semanticError = null, failures = [], handled = [], semanticCalls = [], naturalLanguageCalls = [] } = {}) {
  return createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async () => {} },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: { handle: async () => ({ status: 'success', message: 'unused', data: {} }) },
    workspaceRuntime: workspaceRuntime({ mode, handled }),
    semanticRouter: {
      async routeUpdate(update) {
        semanticCalls.push(update);
        if (semanticError) throw semanticError;
        return semanticRoute ?? { destination: 'runtime', workspaceOperation: null, directInvocation: false, reason: 'ambient' };
      }
    },
    naturalLanguage: {
      async handleUpdate(update, options) {
        naturalLanguageCalls.push({ update, options });
        return { handled: true, outcome: 'configured' };
      }
    },
    observability: { recordFailure: (failure) => failures.push(failure) },
    botUserId: 999,
    botUsername: 'garya_bot'
  });
}

const headers = { 'x-telegram-bot-api-secret-token': 'secret' };

test('mention_only accepts a semantically direct natural address without Telegram mention metadata', async () => {
  const handled = [];
  const semanticCalls = [];
  const app = integration({
    handled,
    semanticCalls,
    semanticRoute: { destination: 'runtime', workspaceOperation: null, directInvocation: true, reason: 'assistant-is-intended-responder' }
  });

  const result = await app.handleWebhook({ headers, body: groupUpdate() });

  assert.deepEqual(result.body, { ok: true });
  assert.equal(handled.length, 1);
  assert.equal(semanticCalls.length, 1);
  assert.equal(handled[0].text, 'Подскажи, что у меня записано про машину?');
});

test('mention_only keeps ambient group conversation ignored when semantic directInvocation is false', async () => {
  const handled = [];
  const semanticCalls = [];
  const app = integration({ handled, semanticCalls });

  const result = await app.handleWebhook({ headers, body: groupUpdate({ updateId: 902, text: 'Вчера опять обсуждали эту машину до ночи.' }) });

  assert.equal(result.body.ignored, true);
  assert.equal(result.body.reason, 'group-not-invoked');
  assert.equal(handled.length, 0);
  assert.equal(semanticCalls.length, 1);
});

test('semantic direct-invocation classifier failure fails closed instead of admitting the group message', async () => {
  const handled = [];
  const failures = [];
  const error = Object.assign(new Error('classifier unavailable'), { code: 'semantic-classifier-unavailable' });
  const app = integration({ handled, failures, semanticError: error });

  const result = await app.handleWebhook({ headers, body: groupUpdate({ updateId: 903 }) });

  assert.equal(result.body.ignored, true);
  assert.equal(handled.length, 0);
  assert.ok(failures.some((failure) => failure.stage === 'telegram-semantic-direct-invocation'));
});

test('responses off cannot be bypassed by semantic direct invocation', async () => {
  const handled = [];
  const semanticCalls = [];
  const app = integration({
    mode: 'off',
    handled,
    semanticCalls,
    semanticRoute: { destination: 'runtime', workspaceOperation: null, directInvocation: true, reason: 'direct' }
  });

  const result = await app.handleWebhook({ headers, body: groupUpdate({ updateId: 904 }) });

  assert.equal(result.body.ignored, true);
  assert.equal(result.body.reason, 'workspace-responses-off');
  assert.equal(handled.length, 0);
  assert.equal(semanticCalls.length, 0);
});

test('deterministic Telegram mention remains accepted independently of semantic directInvocation', async () => {
  const handled = [];
  const semanticCalls = [];
  const app = integration({ handled, semanticCalls });
  const text = '@garya_bot проверь контекст';

  const result = await app.handleWebhook({
    headers,
    body: groupUpdate({ updateId: 905, text, entities: [{ type: 'mention', offset: 0, length: 10 }] })
  });

  assert.deepEqual(result.body, { ok: true });
  assert.equal(handled.length, 1);
  assert.equal(semanticCalls.length, 1);
});

test('semantic route used for direct invocation is reused for workspace routing without a second AI classification', async () => {
  const semanticCalls = [];
  const naturalLanguageCalls = [];
  const route = { destination: 'telegram-workspace-manager', workspaceOperation: 'configure', directInvocation: true, reason: 'direct-workspace-configuration' };
  const app = integration({ semanticCalls, naturalLanguageCalls, semanticRoute: route });

  const result = await app.handleWebhook({ headers, body: groupUpdate({ updateId: 906, text: 'Сделай так, чтобы здесь отвечал только когда к тебе обращаются.' }) });

  assert.deepEqual(result.body, { ok: true, naturalLanguage: true });
  assert.equal(semanticCalls.length, 1);
  assert.equal(naturalLanguageCalls.length, 1);
  assert.equal(naturalLanguageCalls[0].options.semanticRoute, route);
});

test('semantic router contract requires directInvocation and frames it as meaning-based classification', async () => {
  const requests = [];
  const router = createTelegramSemanticSubsystemRouter({
    aiRouter: {
      async route(request) {
        requests.push(request);
        return { text: JSON.stringify({ destination: 'runtime', workspaceOperation: null, directInvocation: true, reason: 'intended-responder' }) };
      }
    },
    idFactory: (() => { let i = 0; return () => `id-${++i}`; })()
  });

  const route = await router.routeUpdate(groupUpdate({ updateId: 907, text: 'Можешь напомнить, что мы решили раньше?' }));

  assert.equal(route.directInvocation, true);
  assert.ok(requests[0].responseFormat.jsonSchema.required.includes('directInvocation'));
  assert.equal(requests[0].responseFormat.jsonSchema.properties.directInvocation.type, 'boolean');
  assert.match(requests[0].messages[0].content, /semantic meaning/i);
  assert.match(requests[0].messages[0].content, /Do not infer direct invocation from a particular spelling/i);
});
