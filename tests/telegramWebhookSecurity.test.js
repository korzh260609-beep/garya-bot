import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createTelegramWebhookHttpHandler } from '../src/telegram/telegramWebhookHttpHandler.js';
import { createSecurityOperations, createSecurityOperationsConfig } from '../src/operations/securityOperations.js';

function responseFixture() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    end(value = '') { this.body = String(value); },
    header(name) { return headers.get(String(name).toLowerCase()); }
  };
}
function requestFixture({ method = 'POST', body = '{}', contentType = 'application/json', network = '127.0.0.1' } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = '/webhooks/telegram';
  request.headers = { 'content-type': contentType, 'x-forwarded-for': network };
  request.socket = { remoteAddress: network };
  return request;
}
const integration = { async handleWebhook() { return { statusCode: 200, body: { ok: true } }; } };

test('Block 19 webhook applies security headers and rejects non-JSON media type', async () => {
  const handler = createTelegramWebhookHttpHandler({ integration });
  const response = responseFixture();
  await handler(requestFixture({ contentType: 'text/plain' }), response);
  assert.equal(response.statusCode, 415);
  assert.equal(response.header('x-content-type-options'), 'nosniff');
  assert.equal(response.header('x-frame-options'), 'DENY');
  assert.equal(response.header('cache-control'), 'no-store');
});

test('Block 19 webhook ingress emergency switch fails closed', async () => {
  const securityOperations = createSecurityOperations({ config: createSecurityOperationsConfig({ SG_TELEGRAM_INGRESS_DISABLED: 'true' }) });
  const handler = createTelegramWebhookHttpHandler({ integration, securityOperations });
  const response = responseFixture();
  await handler(requestFixture(), response);
  assert.equal(response.statusCode, 503);
  assert.match(response.body, /telegram-ingress-disabled/);
});

test('Block 19 webhook rate limit returns 429 with retry-after', async () => {
  const securityOperations = createSecurityOperations({ config: createSecurityOperationsConfig({ SG_RATE_LIMIT_TRANSPORT_MAX: '1', SG_RATE_LIMIT_NETWORK_MAX: '10' }), clock: () => new Date('2026-08-10T05:00:00.000Z') });
  const handler = createTelegramWebhookHttpHandler({ integration, securityOperations });
  const first = responseFixture();
  const second = responseFixture();
  await handler(requestFixture(), first);
  await handler(requestFixture(), second);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
  assert.ok(Number(second.header('retry-after')) >= 1);
});

test('Block 19 webhook keeps payload size bounded', async () => {
  const handler = createTelegramWebhookHttpHandler({ integration, maxBodyBytes: 4 });
  const response = responseFixture();
  await handler(requestFixture({ body: '{"large":true}' }), response);
  assert.equal(response.statusCode, 413);
});
