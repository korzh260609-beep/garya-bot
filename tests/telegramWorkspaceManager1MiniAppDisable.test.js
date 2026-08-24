import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { loadTelegramConfig } from '../src/telegram/telegramConfig.js';
import { createTelegramBotApiClient } from '../src/telegram/telegramBotApiClient.js';
import { createTelegramWorkspaceMiniAppHttpHandler } from '../src/telegramWorkspace/index.js';

function serviceStub() {
  let calls = 0;
  const service = {};
  for (const method of ['bootstrap', 'workspace', 'propose', 'apply', 'history', 'rollback']) {
    service[method] = async () => { calls += 1; return {}; };
  }
  return { service: Object.freeze(service), calls: () => calls };
}

test('TWM1.13 explicit disable removes Mini App URL/path while preserving Telegram webhook config', () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'test-token',
    BASE_URL: 'https://garya.example',
    TELEGRAM_MINI_APP_ENABLED: 'false'
  });

  assert.equal(config.miniAppEnabled, false);
  assert.equal(config.miniAppPath, null);
  assert.equal(config.miniAppUrl, null);
  assert.equal(config.webhookPath, '/webhooks/telegram');
  assert.equal(config.webhookUrl, 'https://garya.example/webhooks/telegram');
});

test('TWM1.13 disabled HTTP adapter does not claim Mini App or Telegram webhook routes', async () => {
  const stub = serviceStub();
  const handler = createTelegramWorkspaceMiniAppHttpHandler({ service: stub.service, path: null });
  const miniRequest = Readable.from([]);
  miniRequest.method = 'GET';
  miniRequest.url = '/telegram/mini-app';
  miniRequest.headers = {};
  const webhookRequest = Readable.from([]);
  webhookRequest.method = 'POST';
  webhookRequest.url = '/webhooks/telegram';
  webhookRequest.headers = {};
  const response = { setHeader() {}, end() {} };

  assert.equal(await handler(miniRequest, response), false);
  assert.equal(await handler(webhookRequest, response), false);
  assert.equal(stub.calls(), 0);
});

test('TWM1.13 disabling Mini App restores Telegram default menu button instead of failing startup', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, async json() { return { ok: true, result: true }; } };
  };
  const client = createTelegramBotApiClient({ token: 'test-token', fetchImpl, maxRetries: 0 });

  await client.setChatMenuButton({ webAppUrl: null });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/setChatMenuButton$/);
  assert.deepEqual(requests[0].body, { menu_button: { type: 'default' } });

  await client.setChatMenuButton({ text: 'Управление', webAppUrl: 'https://garya.example/telegram/mini-app' });
  assert.deepEqual(requests[1].body, {
    menu_button: {
      type: 'web_app',
      text: 'Управление',
      web_app: { url: 'https://garya.example/telegram/mini-app' }
    }
  });
});
