import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTelegramConfig } from '../src/telegram/telegramConfig.js';

test('Block 14 reuses SG 2.0 Render environment without new mandatory variables', () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'existing-token',
    RENDER_EXTERNAL_URL: 'https://garya.onrender.com/'
  });

  assert.equal(config.token, 'existing-token');
  assert.equal(config.webhookUrl, 'https://garya.onrender.com/webhooks/telegram');
  assert.equal(config.webhookPath, '/webhooks/telegram');
  assert.match(config.webhookSecret, /^[a-f0-9]{64}$/);
  assert.equal(config.botUserId, null);
  assert.equal(config.botUsername, null);
});

test('Block 14 accepts legacy SG 2.0 BOT_TOKEN and Render hostname', () => {
  const config = loadTelegramConfig({
    BOT_TOKEN: 'legacy-token',
    RENDER_EXTERNAL_HOSTNAME: 'garya.onrender.com'
  });

  assert.equal(config.token, 'legacy-token');
  assert.equal(config.webhookUrl, 'https://garya.onrender.com/webhooks/telegram');
});

test('Block 14 allows existing BASE_URL and optional overrides', () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'token',
    BASE_URL: 'https://example.test/',
    TELEGRAM_WEBHOOK_SECRET: 'explicit-secret',
    TELEGRAM_WEBHOOK_PATH: 'telegram-hook',
    TELEGRAM_API_TIMEOUT_MS: '5000',
    WEBHOOK_SET_RETRIES: '4'
  });

  assert.equal(config.webhookUrl, 'https://example.test/telegram-hook');
  assert.equal(config.webhookSecret, 'explicit-secret');
  assert.equal(config.apiTimeoutMs, 5000);
  assert.equal(config.apiMaxRetries, 4);
});

test('Block 14 rejects deployment without token or public URL', () => {
  assert.throws(() => loadTelegramConfig({ RENDER_EXTERNAL_URL: 'https://garya.onrender.com' }), /Telegram bot token is required/);
  assert.throws(() => loadTelegramConfig({ TELEGRAM_BOT_TOKEN: 'token' }), /Public base URL is required/);
});
