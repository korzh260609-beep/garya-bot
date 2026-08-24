import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryTelegramUpdateStore, createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';

function identityResolver() {
  return Object.freeze({
    identityContext: Object.freeze({ globalUserId: 'usr_twm19', roles: Object.freeze(['citizen']), grants: Object.freeze([]) }),
    scopeContext: Object.freeze({ userScope: 'usr_twm19', projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: Object.freeze([]) })
  });
}
function privateMessage(updateId, text) {
  return Object.freeze({ update_id: updateId, message: Object.freeze({ message_id: updateId, text, chat: Object.freeze({ id: 19001, type: 'private' }), from: Object.freeze({ id: 19001, first_name: 'Owner', language_code: 'ru' }) }) });
}
function callback(updateId, data) {
  return Object.freeze({ update_id: updateId, callback_query: Object.freeze({ id: `cb-${updateId}`, data, from: Object.freeze({ id: 19001, first_name: 'Owner', language_code: 'ru' }), message: Object.freeze({ message_id: 44, chat: Object.freeze({ id: 19001, type: 'private' }) }) }) });
}
function fixture({ routeHandler, nlHandler, acknowledgeBeforeProcessing = false } = {}) {
  const routeCalls = [], nlCalls = [], runtimeCalls = [], deliveries = [];
  const updateStore = createInMemoryTelegramUpdateStore();
  const naturalLanguage = Object.freeze({
    async routeUpdate(update) {
      routeCalls.push(update.update_id);
      return routeHandler ? routeHandler(update) : Object.freeze({ destination: 'runtime', workspaceOperation: null, reason: 'fixture-runtime' });
    },
    async handleUpdate(update, options) {
      nlCalls.push({ updateId: update.update_id, options });
      return nlHandler ? nlHandler(update, options) : Object.freeze({ handled: false });
    }
  });
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret-19',
    botClient: Object.freeze({ async sendMessage(input) { deliveries.push(input); } }),
    updateStore,
    identityResolver: async () => identityResolver(),
    runtime: Object.freeze({ async handle(input) { runtimeCalls.push(input.text); return Object.freeze({ status: 'success', message: 'ordinary-response' }); } }),
    naturalLanguage,
    acknowledgeBeforeProcessing,
    botUserId: '999', botUsername: 'sg_bot',
    idFactory: (() => { let id = 0; return () => `id-${++id}`; })()
  });
  return { integration, updateStore, routeCalls, nlCalls, runtimeCalls, deliveries, headers: Object.freeze({ 'x-telegram-bot-api-secret-token': 'secret-19' }) };
}

test('ordinary conversation history is routed to runtime without invoking TWM classifier', async () => {
  const fx = fixture({ routeHandler: async () => Object.freeze({ destination: 'runtime', workspaceOperation: null, reason: 'conversation-history' }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19001, 'О чём мы вчера говорили?') });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fx.routeCalls, [19001]);
  assert.deepEqual(fx.nlCalls, []);
  assert.deepEqual(fx.runtimeCalls, ['О чём мы вчера говорили?']);
  assert.equal(fx.deliveries.at(-1).text, 'ordinary-response');
});

test('semantic routing works for paraphrased prior-conversation recall without lexical exceptions', async () => {
  const fx = fixture({ routeHandler: async () => Object.freeze({ destination: 'runtime', workspaceOperation: null, reason: 'ordinary-conversation-recall' }) });
  await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19002, 'Напомни содержание нашей беседы за предыдущий день') });
  assert.deepEqual(fx.nlCalls, []);
  assert.deepEqual(fx.runtimeCalls, ['Напомни содержание нашей беседы за предыдущий день']);
});

test('only a semantic Telegram workspace request enters TWM1.9', async () => {
  const fx = fixture({
    routeHandler: async () => Object.freeze({ destination: 'telegram-workspace-manager', workspaceOperation: 'configure', reason: 'workspace-configuration' }),
    nlHandler: async (_update, options) => {
      assert.equal(options.semanticRoute.workspaceOperation, 'configure');
      return Object.freeze({ handled: true, outcome: 'proposal-pending' });
    }
  });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19003, 'Настрой ответы в рабочей группе') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.naturalLanguage, true);
  assert.equal(fx.nlCalls.length, 1);
  assert.deepEqual(fx.runtimeCalls, []);
});

test('semantic router failure fails open to ordinary SG runtime, never to TWM', async () => {
  const fx = fixture({ routeHandler: async () => { throw Object.assign(new Error('AI unavailable'), { code: 'AI_PROVIDER_DOWN' }); } });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19004, 'расскажи о проекте') });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fx.nlCalls, []);
  assert.deepEqual(fx.runtimeCalls, ['расскажи о проекте']);
  assert.equal(fx.updateStore.snapshot().get(19004).status, 'completed');
});

test('TWM1.9 confirmation callback stays protocol-routed and never enters ordinary runtime', async () => {
  const fx = fixture({ nlHandler: async () => Object.freeze({ handled: true, outcome: 'applied' }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(19005, 'twm19|confirm|twn_testtokenabcdefghijkl') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.naturalLanguage, true);
  assert.equal(fx.nlCalls.length, 1);
  assert.deepEqual(fx.routeCalls, []);
  assert.deepEqual(fx.runtimeCalls, []);
});

test('TWM1.9 callback failure remains fail-closed without runtime fallback', async () => {
  const fx = fixture({ nlHandler: async () => { throw Object.assign(new Error('confirmation denied'), { code: 'twm-action-gate-denied' }); } });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(19006, 'twm19|confirm|twn_testtokenabcdefghijkl') });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'twm-action-gate-denied');
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(19006).status, 'failed');
});

test('background acknowledgement preserves semantic routing and durable completion', async () => {
  const fx = fixture({
    acknowledgeBeforeProcessing: true,
    routeHandler: async () => Object.freeze({ destination: 'telegram-workspace-manager', workspaceOperation: 'configure', reason: 'workspace-configuration' }),
    nlHandler: async () => Object.freeze({ handled: true, outcome: 'proposal-pending' })
  });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19007, 'Настрой антиспам для рабочей группы') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.accepted, true);
  await fx.integration.drainPending();
  assert.equal(fx.nlCalls.length, 1);
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(19007).status, 'completed');
});
