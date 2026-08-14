import { randomUUID } from 'node:crypto';

const KINDS = new Set(['current-response', 'notification']);
const TRANSPORTS = new Set(['telegram', 'discord', 'email', 'web', 'voice']);

function required(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`); return value.trim(); }
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function positiveInt(value, name, fallback) { const n = value == null ? fallback : Number(value); if (!Number.isSafeInteger(n) || n <= 0) throw new TypeError(`${name} must be a positive integer`); return n; }
function clone(value) { return value == null ? value : structuredClone(value); }
function transport(value) { const normalized = required(value, 'target.transport').toLowerCase(); if (!TRANSPORTS.has(normalized)) throw new TypeError(`unsupported delivery transport: ${normalized}`); return normalized; }
function normalizeTarget(value, name = 'target') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} is required`);
  return Object.freeze({ transport: transport(value.transport), resourceId: optional(value.resourceId), connectionId: optional(value.connectionId), address: optional(value.address), threadId: optional(value.threadId), replyToMessageId: optional(value.replyToMessageId), metadata: Object.freeze(clone(value.metadata ?? {})) });
}
function sameTarget(left, right) { return Boolean(left && right && left.transport === right.transport && left.address === right.address && left.resourceId === right.resourceId && left.threadId === right.threadId); }
function normalizeRequest(input, idFactory) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('DeliveryRequest is required');
  const kind = required(input.kind, 'kind'); if (!KINDS.has(kind)) throw new TypeError(`unsupported delivery kind: ${kind}`);
  const actorGlobalUserId = required(input.actorGlobalUserId, 'actorGlobalUserId');
  const recipientGlobalUserId = required(input.recipientGlobalUserId ?? actorGlobalUserId, 'recipientGlobalUserId');
  return Object.freeze({ deliveryId: optional(input.deliveryId) ?? `delivery:${idFactory()}`, idempotencyKey: required(input.idempotencyKey ?? `${kind}:${input.traceContext?.requestId ?? idFactory()}`, 'idempotencyKey'), kind, actorGlobalUserId, recipientGlobalUserId, projectScope: required(input.projectScope, 'projectScope'), message: required(input.message, 'message'), target: input.target ? normalizeTarget(input.target) : null, originTarget: input.originTarget ? normalizeTarget(input.originTarget, 'originTarget') : null, explicitTarget: input.explicitTarget === true, crossUserAuthorization: input.crossUserAuthorization == null ? null : Object.freeze(clone(input.crossUserAuthorization)), locale: optional(input.locale), traceContext: Object.freeze(clone(input.traceContext ?? {})), metadata: Object.freeze(clone(input.metadata ?? {})) });
}
function publicResult(record) { return Object.freeze({ deliveryId: record.deliveryId, idempotencyKey: record.idempotencyKey, kind: record.kind, status: record.status, transport: record.transport ?? null, target: record.target ? Object.freeze(clone(record.target)) : null, attempts: record.attempts ?? 0, duplicate: record.duplicate === true, failureCode: record.failureCode ?? null, retryable: record.retryable === true, deliveredAt: record.deliveredAt ?? null }); }
function isRetryable(error) { return error?.retryable === true || ['ETIMEDOUT','ECONNRESET','EAI_AGAIN','delivery-timeout','rate-limited'].includes(error?.code); }
function withTimeout(promiseFactory, timeoutMs) { let timer; return Promise.race([Promise.resolve().then(promiseFactory), new Promise((_, reject) => { timer = setTimeout(() => { const e = new Error('delivery timeout'); e.code = 'delivery-timeout'; e.retryable = true; reject(e); }, timeoutMs); })]).finally(() => clearTimeout(timer)); }
function isQuietHour(settings, now) {
  const quiet = settings?.notifications?.quietHours; if (!quiet?.enabled) return false;
  const zone = quiet.timeZone ?? settings?.timeZone ?? 'UTC';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const current = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const parse = (text) => { const [hh, mm] = String(text).split(':').map(Number); return hh * 60 + mm; };
  const start = parse(quiet.start); const end = parse(quiet.end); return start === end ? true : start < end ? current >= start && current < end : current >= start || current < end;
}
function validCrossUserEvidence(request) {
  if (request.recipientGlobalUserId === request.actorGlobalUserId) return true;
  const evidence = request.crossUserAuthorization;
  return Boolean(evidence && evidence.authorized === true && typeof evidence.authorizationId === 'string' && evidence.authorizationId.trim() !== '' && evidence.actorGlobalUserId === request.actorGlobalUserId && evidence.recipientGlobalUserId === request.recipientGlobalUserId && evidence.projectScope === request.projectScope);
}

export function createInMemoryDeliveryStore() {
  const byId = new Map(); const byKey = new Map();
  return Object.freeze({ async getByIdempotencyKey(key) { const id = byKey.get(key); return id ? clone(byId.get(id)) : null; }, async put(record) { byId.set(record.deliveryId, clone(record)); byKey.set(record.idempotencyKey, record.deliveryId); return clone(record); }, async get(deliveryId) { return clone(byId.get(deliveryId) ?? null); } });
}

export function createDeliveryTransportRegistry({ transports = [] } = {}) {
  const map = new Map();
  for (const item of transports) { const name = transport(item?.name); if (map.has(name)) throw new TypeError(`duplicate delivery transport: ${name}`); if (typeof item.deliver !== 'function') throw new TypeError(`${name}.deliver is required`); map.set(name, Object.freeze({ name, deliver: item.deliver })); }
  return Object.freeze({ get(name) { return map.get(transport(name)) ?? null; }, register(item) { const name = transport(item?.name); if (map.has(name)) throw new TypeError(`duplicate delivery transport: ${name}`); if (typeof item.deliver !== 'function') throw new TypeError(`${name}.deliver is required`); map.set(name, Object.freeze({ name, deliver: item.deliver })); return this; }, names: () => Object.freeze([...map.keys()].sort()) });
}

export function createDeliveryRouter({ store = createInMemoryDeliveryStore(), transportRegistry = createDeliveryTransportRegistry(), userSettingsService = null, resourceAuthorityRegistry = null, connectionRegistry = null, connectionAccessContext = null, observability = null, clock = () => new Date(), idFactory = randomUUID, timeoutMs = 10_000, maxAttempts = 3, fallbackTransports = [] } = {}) {
  if (!store?.getByIdempotencyKey || !store?.put) throw new TypeError('delivery store is required');
  if (!transportRegistry?.get) throw new TypeError('transportRegistry is required');
  timeoutMs = positiveInt(timeoutMs, 'timeoutMs', 10_000); maxAttempts = positiveInt(maxAttempts, 'maxAttempts', 3);

  async function resolveSettings(request) { if (!userSettingsService?.resolve) return null; return userSettingsService.resolve(request.recipientGlobalUserId, { projectScope: request.projectScope }); }
  async function authorizeTarget(request, target) {
    if (!validCrossUserEvidence(request)) return { allowed: false, reason: 'cross-user-delivery-not-authorized' };
    if (request.kind === 'current-response' && request.originTarget && !request.explicitTarget) return sameTarget(request.originTarget, target) ? { allowed: true, reason: 'origin-bound-current-response' } : { allowed: false, reason: 'current-response-target-mismatch' };
    if (request.kind === 'notification' && request.metadata?.originBoundSelfNotification === true && request.recipientGlobalUserId === request.actorGlobalUserId && request.originTarget && !request.explicitTarget) return sameTarget(request.originTarget, target) ? { allowed: true, reason: 'origin-bound-self-notification' } : { allowed: false, reason: 'self-notification-target-mismatch' };
    if (!target.resourceId) return { allowed: false, reason: 'explicit-delivery-requires-resource' };
    if (!resourceAuthorityRegistry?.checkAuthority) return { allowed: false, reason: 'resource-authority-unavailable' };
    const authority = await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: request.actorGlobalUserId, projectScope: request.projectScope, resourceId: target.resourceId, relation: 'can_publish' });
    if (!authority.allowed) return { allowed: false, reason: authority.reason };
    if (target.connectionId) {
      if (!connectionRegistry?.requireUsable || !connectionAccessContext?.actor) return { allowed: false, reason: 'connection-state-unavailable' };
      try { await connectionRegistry.requireUsable({ connectionId: target.connectionId, capability: 'notification.delivery', actor: connectionAccessContext.actor, projectScope: request.projectScope }); } catch (error) { return { allowed: false, reason: error?.code ?? 'connection-unusable' }; }
    }
    return { allowed: true, reason: 'resource-authority-verified', authority };
  }
  function pickTargets(request, settings) {
    if (request.target) return [request.target];
    if (request.kind === 'current-response' && request.originTarget) return [request.originTarget];
    if (request.kind === 'notification' && request.metadata?.originBoundSelfNotification === true && request.originTarget) return [request.originTarget];
    const preferred = settings?.settings?.delivery?.preferredTransport; const targets = [];
    if (preferred && request.metadata?.targets?.[preferred]) targets.push(normalizeTarget(request.metadata.targets[preferred]));
    for (const name of fallbackTransports) if (request.metadata?.targets?.[name] && !targets.some((t) => t.transport === name)) targets.push(normalizeTarget(request.metadata.targets[name]));
    return targets;
  }
  async function recordEvent(request, outcome, data = {}) { observability?.record?.({ eventClass: 'delivery_attempt', channel: outcome === 'delivered' ? 'telemetry' : 'audit', stage: 'delivery-router', traceContext: request.traceContext, outcome, actorRef: request.actorGlobalUserId, data: { deliveryId: request.deliveryId, kind: request.kind, recipientGlobalUserId: request.recipientGlobalUserId, ...data } }); }
  async function route(input) {
    const request = normalizeRequest(input, idFactory); const duplicate = await store.getByIdempotencyKey(request.idempotencyKey); if (duplicate) return publicResult({ ...duplicate, duplicate: true });
    const settings = await resolveSettings(request);
    if (request.kind === 'notification') {
      if (settings?.settings?.notifications?.enabled === false) { const record = { ...request, status: 'suppressed', attempts: 0, failureCode: 'notifications-disabled', retryable: false }; await store.put(record); await recordEvent(request, 'suppressed', { reason: record.failureCode }); return publicResult(record); }
      if (isQuietHour(settings?.settings, clock())) { const record = { ...request, status: 'deferred', attempts: 0, failureCode: 'quiet-hours', retryable: true }; await store.put(record); await recordEvent(request, 'deferred', { reason: record.failureCode }); return publicResult(record); }
    }
    const targets = pickTargets(request, settings); if (targets.length === 0) { const record = { ...request, status: 'failed', attempts: 0, failureCode: 'delivery-target-unavailable', retryable: false }; await store.put(record); await recordEvent(request, 'failed', { reason: record.failureCode }); return publicResult(record); }
    let totalAttempts = 0; let lastError = null;
    for (const target of targets) {
      const auth = await authorizeTarget(request, target); if (!auth.allowed) { lastError = Object.assign(new Error(auth.reason), { code: auth.reason, retryable: false }); await recordEvent(request, 'denied', { transport: target.transport, reason: auth.reason }); continue; }
      const provider = transportRegistry.get(target.transport); if (!provider) { lastError = Object.assign(new Error('delivery transport unavailable'), { code: 'delivery-transport-unavailable', retryable: false }); continue; }
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        totalAttempts += 1;
        try { const result = await withTimeout(() => provider.deliver(Object.freeze({ request, target, attempt, locale: request.locale ?? settings?.settings?.locale ?? null })), timeoutMs); const record = { ...request, target, transport: target.transport, status: 'delivered', attempts: totalAttempts, failureCode: null, retryable: false, deliveredAt: clock().toISOString(), providerResult: clone(result ?? null) }; await store.put(record); await recordEvent(request, 'delivered', { transport: target.transport, attempts: totalAttempts }); return publicResult(record); }
        catch (error) { lastError = error; const retryable = isRetryable(error); await recordEvent(request, 'attempt-failed', { transport: target.transport, attempt, code: error?.code ?? 'delivery-failed', retryable }); if (!retryable) break; }
      }
    }
    const record = { ...request, target: targets.at(-1), transport: targets.at(-1)?.transport ?? null, status: 'failed', attempts: totalAttempts, failureCode: lastError?.code ?? 'delivery-failed', retryable: isRetryable(lastError) }; await store.put(record); await recordEvent(request, 'failed', { transport: record.transport, attempts: totalAttempts, reason: record.failureCode }); return publicResult(record);
  }
  return Object.freeze({ route, normalizeRequest: (input) => normalizeRequest(input, idFactory) });
}
