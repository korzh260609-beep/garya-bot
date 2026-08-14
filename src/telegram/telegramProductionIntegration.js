import { timingSafeEqual } from 'node:crypto';
import { createTelegramTransportAdapter } from '../interfaces/adapters.js';
import { evaluateTelegramInvocation } from './telegramInvocation.js';
import { redactSensitiveText } from '../secrets/redaction.js';
import { assessFinalResponse, fingerprintFinalResponse } from '../response/finalResponseGuard.js';

const TWM_NATIVE_COMMANDS = new Set(['/workspace', '/workspaces', '/sg_workspace', '/sg_workspaces']);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function secureEqual(actual, expected) {
  const left = Buffer.from(String(actual ?? ''), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
function messageFromUpdate(update) { return update?.message ?? update?.edited_message ?? update?.channel_post ?? null; }
function isNativeWorkspaceUiUpdate(update) {
  const callbackData = update?.callback_query?.data;
  if (typeof callbackData === 'string' && callbackData.startsWith('twm|')) return true;
  const message = update?.message;
  if (message?.chat?.type !== 'private' || typeof message?.text !== 'string') return false;
  const command = message.text.trim().split(/\s+/, 1)[0]?.split('@', 1)[0]?.toLowerCase();
  return TWM_NATIVE_COMMANDS.has(command);
}
function isNaturalLanguageWorkspaceCallback(update) {
  const callbackData = update?.callback_query?.data;
  return typeof callbackData === 'string' && callbackData.startsWith('twm19|');
}
function visibleFailureText(update) {
  const language = String(messageFromUpdate(update)?.from?.language_code ?? update?.locale ?? 'ru').toLowerCase();
  if (language.startsWith('uk')) return 'Не вдалося обробити повідомлення. Спробуй ще раз трохи пізніше.';
  if (language.startsWith('ru')) return 'Не удалось обработать сообщение. Попробуй ещё раз немного позже.';
  return 'SG could not process the message. Please try again a little later.';
}
function normalizedBotUsername(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().replace(/^@/, '') : null;
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
  workspaceRuntime = null,
  nativeUi = null,
  semanticRouter = null,
  naturalLanguage = null,
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
  if (workspaceRuntime !== null && (typeof workspaceRuntime?.handle !== 'function' || typeof workspaceRuntime?.evaluateInvocation !== 'function')) throw new TypeError('workspaceRuntime.handle and workspaceRuntime.evaluateInvocation are required');
  if (nativeUi !== null && typeof nativeUi?.handleUpdate !== 'function') throw new TypeError('nativeUi.handleUpdate is required');
  if (semanticRouter !== null && typeof semanticRouter?.routeUpdate !== 'function') throw new TypeError('semanticRouter.routeUpdate is required');
  if (naturalLanguage !== null && typeof naturalLanguage?.handleUpdate !== 'function') throw new TypeError('naturalLanguage.handleUpdate is required');

  const effectiveSemanticRouter = semanticRouter ?? (typeof naturalLanguage?.routeUpdate === 'function' ? naturalLanguage : null);
  const pending = new Set();
  const runtimeHandler = workspaceRuntime?.handle ?? ((canonicalInput) => runtime.handle(canonicalInput));
  let resolvedBotIdentity = Object.freeze({ botUserId: botUserId ?? null, botUsername: normalizedBotUsername(botUsername) });
  let botIdentityPromise = null;

  async function resolveBotInvocationIdentity() {
    if (resolvedBotIdentity.botUserId != null && resolvedBotIdentity.botUsername) return resolvedBotIdentity;
    if (typeof botClient.getMe !== 'function') return resolvedBotIdentity;
    if (!botIdentityPromise) {
      botIdentityPromise = Promise.resolve()
        .then(() => botClient.getMe())
        .then((me) => {
          resolvedBotIdentity = Object.freeze({
            botUserId: resolvedBotIdentity.botUserId ?? me?.id ?? null,
            botUsername: resolvedBotIdentity.botUsername ?? normalizedBotUsername(me?.username)
          });
          return resolvedBotIdentity;
        })
        .catch((error) => {
          botIdentityPromise = null;
          try { observability?.recordFailure?.({ stage: 'telegram-bot-identity', reason: redactSensitiveText(error?.message ?? 'Telegram getMe failed'), code: error?.code ?? 'telegram-bot-identity-failed' }); } catch {}
          return resolvedBotIdentity;
        });
    }
    return botIdentityPromise;
  }

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

  function recordDiagnosticSensor(event) {
    try { observability?.record?.(event); return true; }
    catch (error) {
      try { observability?.recordFailure?.({ traceContext: event.traceContext, stage: 'diagnostic-sensor', reason: redactSensitiveText(error?.message ?? 'diagnostic sensor failed'), code: error?.code ?? 'diagnostic-sensor-failed', data: { sensorEventClass: event.eventClass } }); } catch {}
      return false;
    }
  }

  const adapter = createTelegramTransportAdapter({
    identityResolver,
    requestHandler: (canonicalInput) => runtimeHandler(canonicalInput),
    responseDeliverer: async ({ response, canonicalInput, platformInput }) => {
      const message = messageFromUpdate(platformInput);
      const traceContext = canonicalInput.traceContext;
      const responseAssessment = assessFinalResponse({ userText: canonicalInput.text, candidateText: response.message });
      const fingerprintSalt = traceContext?.traceId ?? traceContext?.requestId ?? '';
      recordDiagnosticSensor({ eventClass: 'final_response_observed', channel: 'telemetry', stage: 'response', traceContext, outcome: responseAssessment.ok ? 'accepted' : 'rejected', actorRef: canonicalInput.identityContext.globalUserId, data: { responseEventClass: 'final_response_observed', reason: responseAssessment.reason, exactEcho: responseAssessment.reason === 'exact-user-echo', inputHash: fingerprintFinalResponse(canonicalInput.text, { salt: fingerprintSalt }), outputHash: fingerprintFinalResponse(response.message, { salt: fingerprintSalt }), responseStatus: response.status ?? null, transport: 'telegram' } });
      recordDiagnosticSensor({ eventClass: 'delivery_attempt', channel: 'telemetry', stage: 'telegram-delivery', traceContext, outcome: 'started', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'telegram', routed: Boolean(deliveryRouter) } });
      try {
        if (!deliveryRouter) {
          await botClient.sendMessage({ chatId: message.chat.id, text: response.message, messageThreadId: message.message_thread_id ?? null, replyToMessageId: message.message_id });
        } else {
          const result = await deliveryRouter.route({ kind: 'current-response', actorGlobalUserId: canonicalInput.identityContext.globalUserId, recipientGlobalUserId: canonicalInput.identityContext.globalUserId, projectScope: canonicalInput.scopeContext.projectScope, message: response.message, originTarget: { transport: 'telegram', address: String(message.chat.id), threadId: message.message_thread_id == null ? null : String(message.message_thread_id), replyToMessageId: String(message.message_id) }, idempotencyKey: `telegram-response:${platformInput.update_id}`, locale: canonicalInput.locale, traceContext, metadata: { responseStatus: response.status } });
          if (result.status !== 'delivered') { const error = new Error(`Telegram delivery failed: ${result.failureCode ?? result.status}`); error.code = result.failureCode ?? 'telegram-delivery-failed'; throw error; }
        }
        recordDiagnosticSensor({ eventClass: 'delivery_completed', channel: 'telemetry', stage: 'telegram-delivery', traceContext, outcome: 'delivered', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'telegram', routed: Boolean(deliveryRouter) } });
      } catch (error) {
        try { observability?.recordFailure?.({ traceContext, stage: 'telegram-delivery', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-delivery-failed', data: { transport: 'telegram' } }); } catch {}
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
      await botClient.sendMessage({ chatId: message.chat.id, text: visibleFailureText(body), messageThreadId: message.message_thread_id ?? null, replyToMessageId: message.message_id });
      return true;
    } catch (fallbackError) {
      try { observability?.recordFailure?.({ stage: 'telegram-webhook-fallback', reason: redactSensitiveText(fallbackError?.message ?? 'fallback delivery failed'), code: fallbackError?.code ?? 'telegram-fallback-delivery-failed', data: { originalFailureCode: originalError?.code ?? 'telegram-update-failed' } }); } catch {}
      return false;
    }
  }

  async function processNativeUiUpdate(body, claim) {
    try {
      const result = await nativeUi.handleUpdate(body);
      if (!result?.handled) throw Object.assign(new Error('native Telegram UI declined a classified update'), { code: 'twm-native-ui-declined' });
      await updateStore.complete(claim.updateId, 'completed');
      recordDiagnosticSensor({ eventClass: 'telegram_native_ui_completed', channel: 'telemetry', stage: 'telegram-workspace-native-ui', outcome: 'success', data: { updateId: claim.updateId } });
      return Object.freeze({ ok: true, result });
    } catch (error) {
      try { await updateStore.fail(claim.updateId, error.code ?? 'twm-native-ui-failed'); } catch {}
      try { observability?.recordFailure?.({ stage: 'telegram-workspace-native-ui', reason: redactSensitiveText(error.message), code: error.code ?? 'twm-native-ui-failed' }); } catch {}
      return Object.freeze({ ok: false, error });
    }
  }

  async function processClaimedUpdate(body, claim, invocation) {
    try {
      const result = await adapter.receive(body);
      await updateStore.complete(claim.updateId, 'completed');
      recordDiagnosticSensor({ eventClass: 'telegram_update_completed', channel: 'telemetry', stage: 'telegram-webhook', traceContext: result.canonicalInput.traceContext, outcome: result.response.status, data: { invocation: invocation.reason } });
      return Object.freeze({ ok: true, result });
    } catch (error) {
      try { await updateStore.fail(claim.updateId, error.code ?? 'telegram-update-failed'); }
      catch (storeError) { try { observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(storeError?.message ?? 'update failure persistence failed'), code: 'telegram-update-failure-persist-failed' }); } catch {} }
      try { observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-update-failed' }); } catch {}
      await deliverVisibleFailure(body, error);
      return Object.freeze({ ok: false, error });
    }
  }

  async function processNaturalLanguageCallback(body, claim) {
    try {
      const result = await naturalLanguage.handleUpdate(body);
      if (!result?.handled) throw Object.assign(new Error('TWM1.9 callback declined'), { code: 'twm19-callback-declined' });
      await updateStore.complete(claim.updateId, 'completed');
      recordDiagnosticSensor({ eventClass: 'telegram_workspace_nl_completed', channel: 'telemetry', stage: 'telegram-workspace-natural-language', outcome: result.outcome ?? 'handled', data: { updateId: claim.updateId, callback: true } });
      return Object.freeze({ ok: true, result });
    } catch (error) {
      try { await updateStore.fail(claim.updateId, error.code ?? 'twm19-callback-failed'); } catch {}
      try { observability?.recordFailure?.({ stage: 'telegram-workspace-natural-language', reason: redactSensitiveText(error.message), code: error.code ?? 'twm19-callback-failed' }); } catch {}
      return Object.freeze({ ok: false, error });
    }
  }

  async function processSemanticallyRoutedUpdate(body, claim, invocation, precomputedRoute = null) {
    let route = precomputedRoute;
    if (!route) {
      try { route = await effectiveSemanticRouter.routeUpdate(body); }
      catch (error) {
        try { observability?.recordFailure?.({ stage: 'telegram-semantic-subsystem-routing', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-semantic-routing-failed' }); } catch {}
        return processClaimedUpdate(body, claim, invocation);
      }
    }
    if (route?.destination !== 'telegram-workspace-manager') return processClaimedUpdate(body, claim, invocation);
    try {
      const result = await naturalLanguage.handleUpdate(body, { semanticRoute: route });
      if (!result?.handled) throw Object.assign(new Error('TWM declined a semantically routed workspace request'), { code: 'twm19-semantic-route-declined' });
      await updateStore.complete(claim.updateId, 'completed');
      recordDiagnosticSensor({ eventClass: 'telegram_workspace_nl_completed', channel: 'telemetry', stage: 'telegram-workspace-natural-language', outcome: result.outcome ?? 'handled', data: { updateId: claim.updateId, callback: false, semanticRoute: true, workspaceOperation: route.workspaceOperation ?? null } });
      return Object.freeze({ ok: true, naturalLanguage: true, result });
    } catch (error) {
      try { observability?.recordFailure?.({ stage: 'telegram-workspace-natural-language', reason: redactSensitiveText(error.message), code: error.code ?? 'twm19-semantic-route-failed' }); } catch {}
      return Object.freeze({ ok: false, error });
    }
  }

  function trackBackground(promise) {
    pending.add(promise);
    promise.then(() => pending.delete(promise), () => pending.delete(promise));
  }

  async function handleWebhook({ headers = {}, body } = {}) {
    const suppliedSecret = headers['x-telegram-bot-api-secret-token'] ?? headers['X-Telegram-Bot-Api-Secret-Token'];
    try {
      if (!(await verifyWebhookSecret(suppliedSecret))) return Object.freeze({ statusCode: 401, body: { ok: false, code: 'invalid-webhook-secret' } });
    } catch (error) {
      try { observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error?.message ?? 'webhook credential unavailable'), code: error?.code ?? 'telegram-webhook-credential-failed' }); } catch {}
      return Object.freeze({ statusCode: 503, body: { ok: false, code: 'telegram-webhook-credential-failed' } });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Object.freeze({ statusCode: 400, body: { ok: false, code: 'invalid-update' } });

    let claim;
    try { claim = await updateStore.claim(body); }
    catch (error) {
      try { observability?.recordFailure?.({ stage: 'telegram-webhook', reason: redactSensitiveText(error.message), code: 'telegram-dedupe-failed' }); } catch {}
      return Object.freeze({ statusCode: 503, body: { ok: false, code: 'telegram-dedupe-failed' } });
    }
    if (!claim.claimed) return Object.freeze({ statusCode: 200, body: { ok: true, duplicate: true } });

    if (naturalLanguage && isNaturalLanguageWorkspaceCallback(body)) {
      if (acknowledgeBeforeProcessing) { trackBackground(processNaturalLanguageCallback(body, claim)); return Object.freeze({ statusCode: 200, body: { ok: true, accepted: true, naturalLanguage: true } }); }
      const processed = await processNaturalLanguageCallback(body, claim);
      if (processed.ok) return Object.freeze({ statusCode: 200, body: { ok: true, naturalLanguage: true } });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: processed.error.code ?? 'twm19-callback-failed' } });
    }

    if (nativeUi && isNativeWorkspaceUiUpdate(body)) {
      if (acknowledgeBeforeProcessing) { trackBackground(processNativeUiUpdate(body, claim)); return Object.freeze({ statusCode: 200, body: { ok: true, accepted: true, nativeUi: true } }); }
      const processed = await processNativeUiUpdate(body, claim);
      if (processed.ok) return Object.freeze({ statusCode: 200, body: { ok: true, nativeUi: true } });
      return Object.freeze({ statusCode: 503, body: { ok: false, code: processed.error.code ?? 'twm-native-ui-failed' } });
    }

    const message = messageFromUpdate(body);
    const groupChat = ['group', 'supergroup'].includes(message?.chat?.type);
    const invocationIdentity = groupChat ? await resolveBotInvocationIdentity() : resolvedBotIdentity;
    const baseInvocation = evaluateTelegramInvocation(body, invocationIdentity);
    let invocation = workspaceRuntime ? await workspaceRuntime.evaluateInvocation({ update: body, baseInvocation }) : baseInvocation;
    let semanticRoute = null;

    const semanticDirectInvocationAllowed =
      !invocation.accepted &&
      groupChat &&
      invocation.reason === 'group-not-invoked' &&
      invocation.workspaceRuntimePolicy?.responseMode === 'mention_only' &&
      invocation.workspaceRuntimePolicy?.aiEnabled !== false &&
      effectiveSemanticRouter;

    if (semanticDirectInvocationAllowed) {
      try {
        semanticRoute = await effectiveSemanticRouter.routeUpdate(body);
        if (semanticRoute?.directInvocation === true) {
          invocation = Object.freeze({ ...invocation, accepted: true, reason: 'group-semantic-invocation' });
        }
      } catch (error) {
        try { observability?.recordFailure?.({ stage: 'telegram-semantic-direct-invocation', reason: redactSensitiveText(error.message), code: error.code ?? 'telegram-semantic-direct-invocation-failed' }); } catch {}
      }
    }

    if (!invocation.accepted) {
      await updateStore.complete(claim.updateId, 'ignored');
      return Object.freeze({ statusCode: 200, body: { ok: true, ignored: true, reason: invocation.reason } });
    }

    const semanticRoutingAllowed = effectiveSemanticRouter && naturalLanguage && invocation.workspaceRuntimePolicy?.aiEnabled !== false;
    const work = semanticRoutingAllowed ? processSemanticallyRoutedUpdate(body, claim, invocation, semanticRoute) : processClaimedUpdate(body, claim, invocation);

    if (acknowledgeBeforeProcessing) { trackBackground(work); return Object.freeze({ statusCode: 200, body: { ok: true, accepted: true } }); }
    const processed = await work;
    if (processed.ok) return Object.freeze({ statusCode: 200, body: processed.naturalLanguage === true ? { ok: true, naturalLanguage: true } : { ok: true } });
    return Object.freeze({ statusCode: 503, body: { ok: false, code: processed.error.code ?? 'telegram-update-failed' } });
  }

  async function drainPending() { while (pending.size > 0) await Promise.allSettled([...pending]); }
  return Object.freeze({ handleWebhook, adapter, drainPending });
}
