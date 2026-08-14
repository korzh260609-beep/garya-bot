import { createDiscordTransportAdapter } from '../interfaces/adapters.js';
import { redactSensitiveText } from '../secrets/redaction.js';
import { assessFinalResponse, fingerprintFinalResponse } from '../response/finalResponseGuard.js';

function snowflake(value, name) {
  const id = String(value ?? '').trim();
  if (!/^\d{15,22}$/.test(id)) throw new TypeError(`${name} must be a Discord snowflake`);
  return id;
}

function visibleFailureText(event) {
  const locale = String(event?.locale ?? event?.guild_locale ?? 'en').toLowerCase();
  if (locale.startsWith('uk')) return 'Не вдалося обробити повідомлення. Спробуй ще раз трохи пізніше.';
  if (locale.startsWith('ru')) return 'Не удалось обработать сообщение. Попробуй ещё раз немного позже.';
  return 'SG could not process the message. Please try again a little later.';
}

function mentionedBot(event, botUserId) {
  return Array.isArray(event?.mentions) && event.mentions.some((item) => String(item?.id ?? '') === botUserId);
}

function repliedToBot(event, botUserId) {
  return String(event?.referenced_message?.author?.id ?? '') === botUserId;
}

export function evaluateDiscordInvocation(event, { botUserId } = {}) {
  const botId = snowflake(botUserId, 'discord bot user id');
  if (!event || typeof event !== 'object' || Array.isArray(event)) return Object.freeze({ accepted: false, reason: 'invalid-event' });
  if (String(event.author?.id ?? '') === botId || event.author?.bot === true) return Object.freeze({ accepted: false, reason: 'bot-message' });
  if (!event.author?.id || !event.channel_id || !event.id) return Object.freeze({ accepted: false, reason: 'missing-message-identity' });
  const hasContent = typeof event.content === 'string' && event.content.trim() !== '';
  const hasAttachments = Array.isArray(event.attachments) && event.attachments.length > 0;
  if (!hasContent && !hasAttachments) return Object.freeze({ accepted: false, reason: 'empty-message' });
  if (!event.guild_id) return Object.freeze({ accepted: true, reason: 'direct-message' });
  if (mentionedBot(event, botId)) return Object.freeze({ accepted: true, reason: 'mention' });
  if (repliedToBot(event, botId)) return Object.freeze({ accepted: true, reason: 'reply-to-bot' });
  return Object.freeze({ accepted: false, reason: 'guild-not-addressed' });
}

export function createInMemoryDiscordEventStore() {
  const events = new Map();
  return Object.freeze({
    async claim(event) {
      const eventId = snowflake(event?.id, 'discord event id');
      if (events.has(eventId)) return Object.freeze({ claimed: false, eventId });
      events.set(eventId, { status: 'processing' });
      return Object.freeze({ claimed: true, eventId });
    },
    async complete(eventId, status = 'completed') { events.set(snowflake(eventId, 'discord event id'), { status }); },
    async fail(eventId, failureCode = 'discord-event-failed') { events.set(snowflake(eventId, 'discord event id'), { status: 'failed', failureCode }); },
    snapshot: () => new Map(events)
  });
}

export function createDiscordProductionIntegration({
  restClient,
  deliveryRouter = null,
  eventStore,
  identityResolver,
  runtime,
  observability = null,
  botUserId,
  environment = 'production',
  revision = 'unknown',
  idFactory
} = {}) {
  if (!restClient || typeof restClient.sendMessage !== 'function') throw new TypeError('restClient.sendMessage is required');
  if (deliveryRouter && typeof deliveryRouter.route !== 'function') throw new TypeError('deliveryRouter.route is required');
  if (!eventStore || typeof eventStore.claim !== 'function' || typeof eventStore.complete !== 'function' || typeof eventStore.fail !== 'function') throw new TypeError('Discord event store is required');
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (!runtime || typeof runtime.handle !== 'function') throw new TypeError('runtime.handle is required');
  const configuredBotUserId = snowflake(botUserId, 'discord bot user id');
  const pending = new Set();

  function record(event) {
    try { observability?.record?.(event); } catch {}
  }

  function normalizedInput(event) {
    const content = typeof event.content === 'string' && event.content.trim() !== ''
      ? event.content
      : Array.isArray(event.attachments) && event.attachments.length > 0
        ? '[Discord attachment]'
        : '';
    return Object.freeze({
      ...event,
      content,
      type: event.type ?? 'MESSAGE_CREATE',
      thread_id: event.thread_id ?? (event.guild_id ? event.channel_id : null),
      attachments: Object.freeze((event.attachments ?? []).map((item) => Object.freeze({
        id: item.id == null ? null : String(item.id),
        filename: item.filename ?? null,
        contentType: item.content_type ?? null,
        size: item.size ?? null,
        url: item.url ?? null,
        proxyUrl: item.proxy_url ?? null,
        width: item.width ?? null,
        height: item.height ?? null
      })))
    });
  }

  const adapter = createDiscordTransportAdapter({
    identityResolver,
    requestHandler: (canonicalInput) => runtime.handle(canonicalInput),
    responseDeliverer: async ({ response, canonicalInput, platformInput }) => {
      const traceContext = canonicalInput.traceContext;
      const assessment = assessFinalResponse({ userText: canonicalInput.text, candidateText: response.message });
      const salt = traceContext?.traceId ?? traceContext?.requestId ?? '';
      record({
        eventClass: 'final_response_observed', channel: 'telemetry', stage: 'response', traceContext,
        outcome: assessment.ok ? 'accepted' : 'rejected', actorRef: canonicalInput.identityContext.globalUserId,
        data: {
          responseEventClass: 'final_response_observed', reason: assessment.reason,
          exactEcho: assessment.reason === 'exact-user-echo',
          inputHash: fingerprintFinalResponse(canonicalInput.text, { salt }),
          outputHash: fingerprintFinalResponse(response.message, { salt }),
          responseStatus: response.status ?? null, transport: 'discord'
        }
      });
      record({ eventClass: 'delivery_attempt', channel: 'telemetry', stage: 'discord-delivery', traceContext, outcome: 'started', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'discord', routed: Boolean(deliveryRouter) } });
      try {
        if (!deliveryRouter) {
          await restClient.sendMessage({ channelId: platformInput.channel_id, text: response.message, replyToMessageId: platformInput.id });
        } else {
          const result = await deliveryRouter.route({
            kind: 'current-response',
            actorGlobalUserId: canonicalInput.identityContext.globalUserId,
            recipientGlobalUserId: canonicalInput.identityContext.globalUserId,
            projectScope: canonicalInput.scopeContext.projectScope,
            message: response.message,
            originTarget: {
              transport: 'discord',
              address: String(platformInput.channel_id),
              threadId: canonicalInput.scopeContext.threadScope ?? null,
              replyToMessageId: String(platformInput.id),
              metadata: { guildId: platformInput.guild_id == null ? null : String(platformInput.guild_id) }
            },
            idempotencyKey: `discord-response:${platformInput.id}`,
            locale: canonicalInput.locale,
            traceContext,
            metadata: { responseStatus: response.status }
          });
          if (result.status !== 'delivered') {
            const error = new Error(`Discord delivery failed: ${result.failureCode ?? result.status}`);
            error.code = result.failureCode ?? 'discord-delivery-failed';
            throw error;
          }
        }
        record({ eventClass: 'delivery_completed', channel: 'telemetry', stage: 'discord-delivery', traceContext, outcome: 'delivered', actorRef: canonicalInput.identityContext.globalUserId, data: { transport: 'discord', routed: Boolean(deliveryRouter) } });
      } catch (error) {
        try { observability?.recordFailure?.({ traceContext, stage: 'discord-delivery', reason: redactSensitiveText(error.message), code: error.code ?? 'discord-delivery-failed', data: { transport: 'discord' } }); } catch {}
        throw error;
      }
    },
    environment,
    revision,
    ...(idFactory ? { idFactory } : {})
  });

  async function deliverVisibleFailure(event, originalError) {
    if (!event?.channel_id || !event?.id) return false;
    try {
      await restClient.sendMessage({ channelId: event.channel_id, text: visibleFailureText(event), replyToMessageId: event.id });
      return true;
    } catch (fallbackError) {
      try { observability?.recordFailure?.({ stage: 'discord-fallback', reason: redactSensitiveText(fallbackError?.message ?? 'fallback delivery failed'), code: fallbackError?.code ?? 'discord-fallback-delivery-failed', data: { originalFailureCode: originalError?.code ?? 'discord-event-failed' } }); } catch {}
      return false;
    }
  }

  async function processClaimedEvent(event, claim, invocation) {
    try {
      const result = await adapter.receive(normalizedInput(event));
      await eventStore.complete(claim.eventId, 'completed');
      record({ eventClass: 'audit_event', channel: 'telemetry', stage: 'discord-gateway', traceContext: result.canonicalInput.traceContext, outcome: result.response.status, actorRef: result.canonicalInput.identityContext.globalUserId, data: { discordEventClass: 'discord_event_completed', invocation: invocation.reason, guildId: event.guild_id ?? null, channelId: event.channel_id ?? null } });
      return Object.freeze({ ok: true, result });
    } catch (error) {
      try { await eventStore.fail(claim.eventId, error.code ?? 'discord-event-failed'); } catch {}
      try { observability?.recordFailure?.({ stage: 'discord-gateway', reason: redactSensitiveText(error.message), code: error.code ?? 'discord-event-failed' }); } catch {}
      await deliverVisibleFailure(event, error);
      return Object.freeze({ ok: false, error });
    }
  }

  function track(promise) {
    pending.add(promise);
    promise.finally(() => pending.delete(promise)).catch(() => {});
  }

  async function handleDispatch(dispatch) {
    if (dispatch?.type !== 'MESSAGE_CREATE') return Object.freeze({ accepted: false, ignored: true, reason: 'unsupported-dispatch' });
    const event = dispatch.data;
    const invocation = evaluateDiscordInvocation(event, { botUserId: configuredBotUserId });
    let claim;
    try { claim = await eventStore.claim({ ...event, type: dispatch.type }); }
    catch (error) {
      try { observability?.recordFailure?.({ stage: 'discord-dedupe', reason: redactSensitiveText(error.message), code: 'discord-dedupe-failed' }); } catch {}
      return Object.freeze({ accepted: false, error });
    }
    if (!claim.claimed) return Object.freeze({ accepted: false, duplicate: true });
    if (!invocation.accepted) {
      await eventStore.complete(claim.eventId, 'ignored');
      return Object.freeze({ accepted: false, ignored: true, reason: invocation.reason });
    }
    const work = processClaimedEvent(event, claim, invocation);
    track(work);
    return Object.freeze({ accepted: true, eventId: claim.eventId });
  }

  async function drainPending() {
    while (pending.size > 0) await Promise.allSettled([...pending]);
  }

  return Object.freeze({ handleDispatch, drainPending, adapter, evaluateInvocation: (event) => evaluateDiscordInvocation(event, { botUserId: configuredBotUserId }) });
}
