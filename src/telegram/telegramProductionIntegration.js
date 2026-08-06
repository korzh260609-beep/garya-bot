import { timingSafeEqual } from 'node:crypto';
import { createTelegramTransportAdapter } from '../interfaces/adapters.js';
import { evaluateTelegramInvocation } from './telegramInvocation.js';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function secureEqual(actual, expected) {
  const left = Buffer.from(String(actual ?? ''), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createInMemoryTelegramUpdateStore() {
  const updates = new Map();
  return Object.freeze({
    async claim(update) {
      const updateId = Number(update?.update_id);
      if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('telegram update_id must be a non-negative safe integer');
      if (updates.has(updateId)) return Object.freeze({ claimed: false, updateId });
      updates.set(updateId, { status: 'processing' });
      return Object.freeze({ claimed: true, updateId });
    },
    async complete(updateId, status = 'completed') { updates.set(Number(updateId), { status }); },
    async fail(updateId, failureCode = 'telegram-update-failed') { updates.set(Number(updateId), { status: 'failed', failureCode }); },
    snapshot: () => new Map(updates)
  });
}

export function createTelegramProductionIntegration({
  secretToken,
  botClient,
  updateStore,
  identityResolver,
  runtime,
  observability = null,
  botUserId = null,
  botUsername = null,
  environment = 'production',
  revision = 'unknown',
  idFactory
} = {}) {
  const secret = requiredString(secretToken, 'telegram webhook secret');
  if (!botClient || typeof botClient.sendMessage !== 'function') throw new TypeError('botClient.sendMessage is required');
  if (!updateStore || typeof updateStore.claim !== 'function' || typeof updateStore.complete !== 'function' || typeof updateStore.fail !== 'function') throw new TypeError('Telegram update store is required');
  if (!identityResolver || typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (!runtime || typeof runtime.handle !== 'function') throw new TypeError('runtime.handle is required');

  const adapter = createTelegramTransportAdapter({
    identityResolver,
    requestHandler: (canonicalInput) => runtime.handle(canonicalInput),
    responseDeliverer: async ({ response, platformInput }) => {
      const message = platformInput.message ?? platformInput.edited_message ?? platformInput.channel_post;
      await botClient.sendMessage({
        chatId: message.chat.id,
        text: response.message,
        messageThreadId: message.message_thread_id ?? null,
        replyToMessageId: message.message_id
      });
    },
    environment,
    revision,
    ...(idFactory ? { idFactory } : {})
  });

  async function handleWebhook({ headers = {}, body } = {}) {
    const suppliedSecret = headers['x-telegram-bot-api-secret-token'] ?? headers['X-Telegram-Bot-Api-Secret-Token'];
    if (!secureEqual(suppliedSecret, secret)) return Object.freeze({ statusCode: 401, body: { ok: false, code: 'invalid-webhook-secret' } });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Object.freeze({ statusCode: 400, body: { ok: false, code: 'invalid-update' } });

    let claim;
    try {
      claim = await updateStore.claim(body);
    } catch (error) {
      observability?.recordFailure?.({ stage: 'telegram-webhook', reason: error.message, code: 'telegram-dedupe-failed' });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: 'telegram-dedupe-failed' } });
    }
    if (!claim.claimed) return Object.freeze({ statusCode: 200, body: { ok: true, duplicate: true } });

    const invocation = evaluateTelegramInvocation(body, { botUserId, botUsername });
    if (!invocation.accepted) {
      await updateStore.complete(claim.updateId, 'ignored');
      return Object.freeze({ statusCode: 200, body: { ok: true, ignored: true, reason: invocation.reason } });
    }

    try {
      const result = await adapter.receive(body);
      await updateStore.complete(claim.updateId, 'completed');
      observability?.record?.({ eventClass: 'telegram_update_completed', channel: 'telemetry', stage: 'telegram-webhook', traceContext: result.canonicalInput.traceContext, outcome: result.response.status, data: { invocation: invocation.reason } });
      return Object.freeze({ statusCode: 200, body: { ok: true } });
    } catch (error) {
      await updateStore.fail(claim.updateId, error.code ?? 'telegram-update-failed');
      observability?.recordFailure?.({ stage: 'telegram-webhook', reason: error.message, code: error.code ?? 'telegram-update-failed' });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: error.code ?? 'telegram-update-failed' } });
    }
  }

  return Object.freeze({ handleWebhook, adapter });
}
