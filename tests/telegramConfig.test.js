import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTelegramConfig } from '../src/telegram/telegramConfig.js';

test('Block 16.8 reuses existing Render token secret through a stable credential handle', () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'existing-token',
    RENDER_EXTERNAL_URL: 'https://garya.onrender.com/'
  });

  assert.equal(config.botTokenCredentialId, 'sg.telegram.bot');
  assert.equal(config.webhookSecretCredentialId, 'sg.telegram.webhook');
  assert.equal(config.webhookUrl, 'https://garya.onrender.com/webhooks/telegram');
  assert.equal(config.webhookPath, '/webhooks/telegram');
  assert.equal(config.miniAppUrl, 'https://garya.onrender.com/telegram/mini-app');
  assert.equal(config.miniAppPath, '/telegram/mini-app');
  assert.equal('token' in config, false);
  assert.equal('webhookSecret' in config, false);
  assert.equal(JSON.stringify(config).includes('existing-token'), false);
  assert.equal(config.botUserId, null);
  assert.equal(config.botUsername, null);
});

test('Block 16.8 accepts legacy SG 2.0 BOT_TOKEN without propagating its value', () => {
  const config = loadTelegramConfig({
    BOT_TOKEN: 'legacy-token',
    RENDER_EXTERNAL_HOSTNAME: 'garya.onrender.com'
  });

  assert.equal(config.botTokenCredentialId, 'sg.telegram.bot');
  assert.equal(config.webhookUrl, 'https://garya.onrender.com/webhooks/telegram');
  assert.equal(config.miniAppUrl, 'https://garya.onrender.com/telegram/mini-app');
  assert.equal(JSON.stringify(config).includes('legacy-token'), false);
});

test('Block 16.8 keeps optional webhook secret in the deployment store rather than ordinary config', () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'token',
    BASE_URL: 'https://example.test/',
    TELEGRAM_WEBHOOK_SECRET: 'explicit-secret',
    TELEGRAM_WEBHOOK_PATH: 'telegram-hook',
    TELEGRAM_MINI_APP_PATH: 'custom-mini-app/',
    TELEGRAM_API_TIMEOUT_MS: '5000',
    WEBHOOK_SET_RETRIES: '4'
  });

  assert.equal(config.webhookUrl, 'https://example.test/telegram-hook');
  assert.equal(config.miniAppUrl, 'https://example.test/custom-mini-app');
  assert.equal(config.miniAppPath, '/custom-mini-app');
  assert.equal(config.webhookSecretCredentialId, 'sg.telegram.webhook');
  assert.equal(JSON.stringify(config).includes('explicit-secret'), false);
  assert.equal(config.apiTimeoutMs, 5000);
  assert.equal(config.apiMaxRetries, 4);
});

test('Block 16.8 rejects deployment without token secret or public URL', () => {
  assert.throws(() => loadTelegramConfig({ RENDER_EXTERNAL_URL: 'https://garya.onrender.com' }), /Telegram bot token is required/);
  assert.throws(() => loadTelegramConfig({ TELEGRAM_BOT_TOKEN: 'token' }), /Public base URL is required/);
});
