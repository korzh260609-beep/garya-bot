import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryTelegramUpdateStore,
  createTelegramProductionIntegration
} from '../src/telegram/telegramProductionIntegration.js';

function identityResolver() {
  return Object.freeze({
    identityContext: Object.freeze({ globalUserId: 'usr_twm19', roles: Object.freeze(['citizen']), grants: Object.freeze([]) }),
    scopeContext: Object.freeze({ userScope: 'usr_twm19', projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: Object.freeze([]) })
  });
}

function privateMessage(updateId, text) {
  return Object.freeze({
    update_id: updateId,
    message: Object.freeze({
      message_id: updateId,
      text,
      chat: Object.freeze({ id: 19001, type: 'private' }),
      from: Object.freeze({ id: 19001, first_name: 'Owner', language_code: 'ru' })
    })
  });
}

function callback(updateId, data) {
  return Object.freeze({
    update_id: updateId,
    callback_query: Object.freeze({
      id: `cb-${updateId}`,
      data,
      from: Object.freeze({ id: 19001, first_name: 'Owner', language_code: 'ru' }),
      message: Object.freeze({ message_id: 44, chat: Object.freeze({ id: 19001, type: 'private' }) })
    })
  });
}

function fixture({ nlHandler, acknowledgeBeforeProcessing = false } = {}) {
  const nlCalls = [];
  const runtimeCalls = [];
  const deliveries = [];
  const updateStore = createInMemoryTelegramUpdateStore();
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret-19',
    botClient: Object.freeze({ async sendMessage(input) { deliveries.push(input); } }),
    updateStore,
    identityResolver: async () => identityResolver(),
    runtime: Object.freeze({
      async handle(input) {
        runtimeCalls.push(input.text);
        return Object.freeze({ status: 'success', message: 'ordinary-response' });
      }
    }),
    naturalLanguage: Object.freeze({
      async handleUpdate(update) {
        nlCalls.push(update.update_id);
        return nlHandler ? nlHandler(update) : Object.freeze({ handled: false });
      }
    }),
    acknowledgeBeforeProcessing,
    botUserId: '999',
    botUsername: 'sg_bot',
    idFactory: (() => { let id = 0; return () => `id-${++id}`; })()
  });
  const headers = Object.freeze({ 'x-telegram-bot-api-secret-token': 'secret-19' });
  return { integration, updateStore, nlCalls, runtimeCalls, deliveries, headers };
}

test('TWM1.9 handled natural-language configuration is consumed before ordinary runtime', async () => {
  const fx = fixture({ nlHandler: async () => Object.freeze({ handled: true, outcome: 'proposal-pending' }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19001, 'В Crypto отвечай только по упоминанию') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.naturalLanguage, true);
  assert.deepEqual(fx.nlCalls, [19001]);
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(19001).status, 'completed');
});

test('TWM1.9 not-twm classification passes the original text unchanged to existing runtime', async () => {
  const fx = fixture({ nlHandler: async () => Object.freeze({ handled: false }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19002, 'привет, кто ты?') });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fx.nlCalls, [19002]);
  assert.deepEqual(fx.runtimeCalls, ['привет, кто ты?']);
  assert.equal(fx.deliveries.at(-1).text, 'ordinary-response');
});

test('TWM1.9 classifier failure fails open only to ordinary SG runtime', async () => {
  const fx = fixture({ nlHandler: async () => { throw Object.assign(new Error('AI unavailable'), { code: 'AI_PROVIDER_DOWN' }); } });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19003, 'расскажи о проекте') });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fx.runtimeCalls, ['расскажи о проекте']);
  assert.equal(fx.updateStore.snapshot().get(19003).status, 'completed');
});

test('TWM1.9 confirmation callback is consumed before invocation filter and never enters ordinary runtime', async () => {
  const fx = fixture({ nlHandler: async () => Object.freeze({ handled: true, outcome: 'applied' }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(19004, 'twm19|confirm|twn_testtokenabcdefghijkl') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.naturalLanguage, true);
  assert.deepEqual(fx.nlCalls, [19004]);
  assert.deepEqual(fx.runtimeCalls, []);
});

test('TWM1.9 callback failure fails closed and marks update failed without runtime fallback', async () => {
  const fx = fixture({ nlHandler: async () => { throw Object.assign(new Error('confirmation denied'), { code: 'twm-action-gate-denied' }); } });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(19005, 'twm19|confirm|twn_testtokenabcdefghijkl') });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'twm-action-gate-denied');
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(19005).status, 'failed');
});

test('TWM1.9 background acknowledgement preserves NL handling and durable completion', async () => {
  const fx = fixture({ acknowledgeBeforeProcessing: true, nlHandler: async () => Object.freeze({ handled: true, outcome: 'proposal-pending' }) });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(19006, 'включи антиспам в Crypto') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.accepted, true);
  await fx.integration.drainPending();
  assert.deepEqual(fx.nlCalls, [19006]);
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(19006).status, 'completed');
});
