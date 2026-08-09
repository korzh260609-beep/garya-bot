import { timingSafeEqual } from 'node:crypto';
import { createTelegramTransportAdapter } from '../interfaces/adapters.js';
import { evaluateTelegramInvocation } from './telegramInvocation.js';
import { redactSensitiveText } from '../secrets/redaction.js';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function secureEqual(actual, expected) {
  const left = Buffer.from(String(actual ?? ''), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function messageFromUpdate(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? null;
}

function visibleFailureText(update) {
  const language = String(messageFromUpdate(update)?.from?.language_code ?? update?.locale ?? 'ru').toLowerCase();
  if (language.startsWith('uk')) return 'Не вдалося обробити повідомлення. Спробуй ще раз трохи пізніше.';
  if (language.startsWith('ru')) return 'Не удалось обработать сообщение. Попробуй ещё раз немного позже.';
  return 'SG could not process the message. Please try again a little later.';
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
  secretToken = null,
  credentialManager = null,
  credentialAccessContext = null,
  webhookCredentialId = 'sg.telegram.webhook',
  botClient,
  deliveryRouter = null,
  updateStore,
  identityResolver,
  runtime,
  observability = null,
  botUserId = null,
  botUsername = null,
  environment = 'production',
  revision = 'unknown',
  acknowledgeBeforeProcessing = false,
  idFactory
} = {}) {
  const hasCredentialManager = credentialManager && typeof credentialManager.useCredential === 'function';
  const legacySecret = hasCredentialManager ? null : requiredString(secretToken, 'telegram webhook secret');
  if (hasCredentialManager && (!credentialAccessContext?.actor || !credentialAccessContext?.scope)) throw new TypeError('telegram webhook credential access context is required');
  if (!botClient || typeof botClient.sendMessage !== 'function') throw new TypeError('botClient.sendMessage is required');
  if (deliveryRouter && typeof deliveryRouter.route !== 'function') throw new TypeError('deliveryRouter.route is required');
  if (!updateStore || typeof updateStore.claim !== 'function' || typeof updateStore.complete !== 'function' || typeof updateStore.fail !== 'function') throw new TypeError('Telegram update store is required');
  if (!identityResolver || typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (!runtime || typeof runtime.handle !== 'function') throw new TypeError('runtime.handle is required');

  const pending = new Set();

  async function verifyWebhookSecret(suppliedSecret) {
    if (!hasCredentialManager) return secureEqual(suppliedSecret, legacySecret);
    return credentialManager.useCredential({
      credentialId: webhookCredentialId,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      purpose: 'telegram.webhook.verify',
      connectionId: 'telegram-webhook',
      operation: (secret) => secureEqual(suppliedSecret, secret)
    });
  }

  const adapter = createTelegramTransportAdapter({
    identityResolver,
    requestHandler: (canonicalInput) => runtime.handle(canonicalInput),
    responseDeliverer: async ({ response, canonicalInput, platformInput }) => {
      const message = messageFromUpdate(platformInput);
      const traceContext = canonicalInput.traceContext;
      observability?.record?.({ eventClass: 'delivery_attempt', channel: 'telemetry', stage: 'telegram-delivery', traceContext, outcome: 'started', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'telegram', routed: Boolean(deliveryRouter) } });
      try {
        if (!deliveryRouter) {
          await botClient.sendMessage({ chatId: message.chat.id, text: response.message, messageThreadId: message.message_thread_id ?? null, replyToMessageId: message.message_id });
        } else {
          const result = await deliveryRouter.route({
            kind: 'current-response',
            actorGlobalUserId: canonicalInput.identityContext.globalUserId,
            recipientGlobalUserId: canonicalInput.identityContext.globalUserId,
            projectScope: canonicalInput.scopeContext.projectScope,
            message: response.message,
            originTarget: { transport: 'telegram', address: String(message.chat.id), threadId: message.message_thread_id == null ? null : String(message.message_thread_id), replyToMessageId: String(message.message_id) },
            idempotencyKey: `telegram-response:${platformInput.update_id}`,
            locale: canonicalInput.locale,
            traceContext,
            metadata: { responseStatus: response.status }
          });
          if (result.status !== 'delivered') {
            const error = new Error(`Telegram delivery failed: ${result.failureCode ?? result.status}`);
            error.code = result.failureCode ?? 'telegram-delivery-failed';
            throw error;
          }
        }
        observability?.record?.({ eventClass: 'delivery_completed', channel: 'telemetry', stage: 'telegram-delivery', traceContext, outcome: 'delivered', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'telegram', routed: Boolean(deliveryRouter) } });
      } catch (error) {
        observability?.recordFailure?.({ traceContext, stage: 'telegram-delivery', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-delivery-failed', data: { transport: 'telegram' } });
        throw error;
      }
    },
    environment,
    revision,
    ...(idFactory ? { idFactory } : {})
  });

  async function deliverVisibleFailure(body, originalError) {
    const message = messageFromUpdate(body);
    if (!message?.chat?.id || !message?.message_id) return false;
    try {
      await botClient.sendMessage({
        chatId: message.chat.id,
        text: visibleFailureText(body),
        messageThreadId: message.message_thread_id ?? null,
        replyToMessageId: message.message_id
      });
      return true;
    } catch (fallbackError) {
      observability?.recordFailure?.({
        stage: 'telegram-webhook-fallback',
        reason: redactSensitiveText(fallbackError?.message ?? 'fallback delivery failed'),
        code: fallbackError?.code ?? 'telegram-fallback-delivery-failed',
        data: { originalFailureCode: originalError?.code ?? 'telegram-update-failed' }
      });
      return false;
    }
  }

  async function processClaimedUpdate(body, claim, invocation) {
    try {
      const result = await adapter.receive(body);
      await updateStore.complete(claim.updateId, 'completed');
      observability?.record?.({ eventClass: 'telegram_update_completed', channel: 'telemetry', stage: 'telegram-webhook', traceContext: result.canonicalInput.traceContext, outcome: result.response.status, data: { invocation: invocation.reason } });
      return Object.freeze({ ok: true, result });
    } catch (error) {
      try { await updateStore.fail(claim.updateId, error.code ?? 'telegram-update-failed'); }
      catch (storeError) {
        observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(storeError?.message ?? 'update failure persistence failed'), code: 'telegram-update-failure-persist-failed' });
      }
      observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-update-failed' });
      await deliverVisibleFailure(body, error);
      return Object.freeze({ ok: false, error });
    }
  }

  function trackBackground(promise) {
    pending.add(promise);
    promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise)
    );
  }

  async function handleWebhook({ headers = {}, body } = {}) {
    const suppliedSecret = headers['x-telegram-bot-api-secret-token'] ?? headers['X-Telegram-Bot-Api-Secret-Token'];
    try {
      if (!(await verifyWebhookSecret(suppliedSecret))) return Object.freeze({ statusCode: 401, body: { ok: false, code: 'invalid-webhook-secret' } });
    } catch (error) {
      observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error?.message ?? 'webhook credential unavailable'), code: error?.code ?? 'telegram-webhook-credential-failed' });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: 'telegram-webhook-credential-failed' } });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Object.freeze({ statusCode: 400, body: { ok: false, code: 'invalid-update' } });

    let claim;
    try { claim = await updateStore.claim(body); }
    catch (error) {
      observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error.message), code: 'telegram-dedupe-failed' });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: 'telegram-dedupe-failed' } });
    }
    if (!claim.claimed) return Object.freeze({ statusCode: 200, body: { ok: true, duplicate: true } });

    const invocation = evaluateTelegramInvocation(body, { botUserId, botUsername });
    if (!invocation.accepted) {
      await updateStore.complete(claim.updateId, 'ignored');
      return Object.freeze({ statusCode: 200, body: { ok: true, ignored: true, reason: invocation.reason } });
    }

    if (acknowledgeBeforeProcessing) {
      const work = processClaimedUpdate(body, claim, invocation);
      trackBackground(work);
      return Object.freeze({ statusCode: 200, body: { ok: true, accepted: true } });
    }

    const processed = await processClaimedUpdate(body, claim, invocation);
    if (processed.ok) return Object.freeze({ statusCode: 200, body: { ok: true } });
    return Object.freeze({ statusCode: 503, body: { ok: false, code: processed.error.code ?? 'telegram-update-failed' } });
  }

  async function drainPending() {
    while (pending.size > 0) await Promise.allSettled([...pending]);
  }

  return Object.freeze({ handleWebhook, adapter, drainPending });
}
