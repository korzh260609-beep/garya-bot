import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryTelegramUpdateStore,
  createTelegramProductionIntegration
} from '../src/telegram/telegramProductionIntegration.js';

function identityResolver() {
  return Object.freeze({
    identityContext: Object.freeze({ globalUserId: 'usr_twm18', roles: Object.freeze(['citizen']), grants: Object.freeze([]) }),
    scopeContext: Object.freeze({ userScope: 'usr_twm18', projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: Object.freeze([]) })
  });
}

function privateMessage(updateId, text) {
  return Object.freeze({
    update_id: updateId,
    message: Object.freeze({
      message_id: updateId,
      text,
      chat: Object.freeze({ id: 18001, type: 'private' }),
      from: Object.freeze({ id: 18001, first_name: 'Owner', language_code: 'ru' })
    })
  });
}

function callback(updateId, data) {
  return Object.freeze({
    update_id: updateId,
    callback_query: Object.freeze({
      id: `cb-${updateId}`,
      data,
      from: Object.freeze({ id: 18001, first_name: 'Owner', language_code: 'ru' }),
      message: Object.freeze({ message_id: 44, chat: Object.freeze({ id: 18001, type: 'private' }) })
    })
  });
}

function fixture({ acknowledgeBeforeProcessing = false } = {}) {
  const nativeCalls = [];
  const runtimeCalls = [];
  const deliveries = [];
  const updateStore = createInMemoryTelegramUpdateStore();
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret-18',
    botClient: Object.freeze({ async sendMessage(input) { deliveries.push(input); } }),
    updateStore,
    identityResolver: async () => identityResolver(),
    runtime: Object.freeze({
      async handle(input) {
        runtimeCalls.push(input.text);
        return Object.freeze({ status: 'success', message: 'ordinary-response' });
      }
    }),
    nativeUi: Object.freeze({
      async handleUpdate(update) {
        nativeCalls.push(update.update_id);
        return Object.freeze({ handled: true, ok: true });
      }
    }),
    acknowledgeBeforeProcessing,
    botUserId: '999',
    botUsername: 'sg_bot',
    idFactory: (() => { let id = 0; return () => `id-${++id}`; })()
  });
  const headers = Object.freeze({ 'x-telegram-bot-api-secret-token': 'secret-18' });
  return { integration, updateStore, nativeCalls, runtimeCalls, deliveries, headers };
}

test('TWM1.8 native /workspaces command is consumed before Semantic Kernel runtime', async () => {
  const fx = fixture();
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(18001, '/workspaces') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.nativeUi, true);
  assert.deepEqual(fx.nativeCalls, [18001]);
  assert.deepEqual(fx.runtimeCalls, []);
  assert.equal(fx.updateStore.snapshot().get(18001).status, 'completed');
});

test('TWM1.8 callback is consumed before ordinary invocation filtering', async () => {
  const fx = fixture();
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(18002, 'twm|list') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.nativeUi, true);
  assert.deepEqual(fx.nativeCalls, [18002]);
  assert.deepEqual(fx.runtimeCalls, []);
});

test('TWM1.8 ordinary natural-language Telegram message keeps the existing runtime path', async () => {
  const fx = fixture();
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: privateMessage(18003, 'привет, кто ты?') });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fx.nativeCalls, []);
  assert.deepEqual(fx.runtimeCalls, ['привет, кто ты?']);
  assert.equal(fx.deliveries.at(-1).text, 'ordinary-response');
});

test('TWM1.8 background acknowledgment preserves native UI processing and durable completion', async () => {
  const fx = fixture({ acknowledgeBeforeProcessing: true });
  const response = await fx.integration.handleWebhook({ headers: fx.headers, body: callback(18004, 'twm|w|tgw_ui1') });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.accepted, true);
  assert.equal(response.body.nativeUi, true);
  await fx.integration.drainPending();
  assert.deepEqual(fx.nativeCalls, [18004]);
  assert.equal(fx.updateStore.snapshot().get(18004).status, 'completed');
});
