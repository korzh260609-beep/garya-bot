import { createInternalEventEnvelope, INTERNAL_EVENT_TYPE_SET } from './eventContracts.js';
import { createInMemoryEventStore } from './inMemoryEventStore.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function clone(value) { return structuredClone(value); }
function normalizeFailure(error) {
  return { code: String(error?.code ?? error?.name ?? 'subscriber-failed').slice(0, 120), retryable: error?.retryable !== false };
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value ?? null;
}
function sameStructuredValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function sameEventIdentity(persisted, event) {
  return persisted.eventType === event.eventType
    && persisted.version === event.version
    && persisted.actorGlobalUserId === event.actorGlobalUserId
    && persisted.privacyClass === event.privacyClass
    && persisted.orderingKey === event.orderingKey
    && sameStructuredValue(persisted.traceContext, event.traceContext)
    && sameStructuredValue(persisted.scope, event.scope)
    && sameStructuredValue(persisted.provenance, event.provenance)
    && sameStructuredValue(persisted.payload, event.payload);
}
function normalizeSubscription(input) {
  const subscriberId = required(input?.subscriberId, 'subscriberId');
  const eventTypes = [...new Set(input?.eventTypes ?? [])].map((value) => required(value, 'eventType'));
  if (eventTypes.length === 0) throw new TypeError('eventTypes must contain at least one event type');
  for (const eventType of eventTypes) if (!INTERNAL_EVENT_TYPE_SET.has(eventType)) throw new TypeError(`unsupported internal event type: ${eventType}`);
  const mode = input.mode ?? 'sync';
  if (!['sync','durable'].includes(mode)) throw new TypeError('subscription mode must be sync or durable');
  const scope = input.scope ?? {};
  const maxAttempts = Number(input.maxAttempts ?? 3);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new TypeError('maxAttempts must be an integer from 1 to 20');
  return Object.freeze({
    subscriberId, eventTypes: Object.freeze(eventTypes), mode,
    projectScope: optional(scope.projectScope), globalUserId: optional(scope.globalUserId), resourceId: optional(scope.resourceId),
    privacyClasses: Object.freeze([...(input.privacyClasses ?? ['internal','sensitive'])]),
    maxAttempts, metadata: Object.freeze(clone(input.metadata ?? {}))
  });
}
function matches(subscription, event) {
  if (!subscription.eventTypes.includes(event.eventType) || !subscription.privacyClasses.includes(event.privacyClass)) return false;
  if (subscription.projectScope && subscription.projectScope !== event.scope.projectScope) return false;
  if (subscription.globalUserId && subscription.globalUserId !== event.scope.globalUserId) return false;
  if (subscription.resourceId && subscription.resourceId !== event.scope.resourceId) return false;
  return true;
}

export function createInternalEventBus({
  store = createInMemoryEventStore(), observability = null, clock = () => new Date(),
  idFactory = () => globalThis.crypto.randomUUID(), retryDelayMs = 1000, processingTimeoutMs = 30000, workerIntervalMs = 1000
} = {}) {
  const handlers = new Map();
  const subscriptions = new Map();
  let worker = null;
  let draining = false;

  async function observe(eventType, event, data = {}) {
    if (!observability?.record) return;
    await observability.record({ eventClass: 'system_event', eventType, traceContext: event.traceContext, reason: null, data: {
      internalEventId: event.eventId, internalEventType: event.eventType, projectScope: event.scope.projectScope,
      globalUserId: event.scope.globalUserId, resourceId: event.scope.resourceId, privacyClass: event.privacyClass, ...data
    } });
  }

  async function subscribe(input, handler) {
    if (typeof handler !== 'function') throw new TypeError('subscriber handler is required');
    const subscription = normalizeSubscription(input);
    subscriptions.set(subscription.subscriberId, subscription);
    handlers.set(subscription.subscriberId, handler);
    await store.registerSubscription(subscription);
    return subscription;
  }

  async function publish(input) {
    const event = createInternalEventEnvelope(input, { idFactory, clock });
    const persisted = await store.appendEvent(event);
    if (!sameEventIdentity(persisted, event)) throw new Error('event-id-conflict');
    await observe('internal_event_published', event);
    const registered = [...subscriptions.values()];
    const results = [];
    for (const subscription of registered.filter((item) => matches(item, event))) {
      if (subscription.mode === 'durable') {
        const now = clock().toISOString();
        const delivery = await store.enqueueDelivery({ deliveryId: `event-delivery:${event.eventId}:${subscription.subscriberId}`, eventId: event.eventId,
          subscriberId: subscription.subscriberId, status: 'pending', attempts: 0, failureCode: null, nextAttemptAt: now, createdAt: now, updatedAt: now });
        results.push({ subscriberId: subscription.subscriberId, mode: 'durable', status: delivery.status });
        continue;
      }
      try {
        await handlers.get(subscription.subscriberId)(event);
        results.push({ subscriberId: subscription.subscriberId, mode: 'sync', status: 'delivered' });
        await observe('internal_event_consumed', event, { subscriberId: subscription.subscriberId, mode: 'sync' });
      } catch (error) {
        const failure = normalizeFailure(error);
        results.push({ subscriberId: subscription.subscriberId, mode: 'sync', status: 'failed', failureCode: failure.code });
        await observe('internal_event_consumer_failed', event, { subscriberId: subscription.subscriberId, mode: 'sync', failureCode: failure.code });
      }
    }
    return Object.freeze({ event, deliveries: Object.freeze(results) });
  }

  async function drain({ limit = 20 } = {}) {
    if (draining) return Object.freeze([]);
    draining = true;
    try {
      const now = clock();
      const claimed = await store.claimPending({ limit, now: now.toISOString(), staleBefore: new Date(now.getTime() - processingTimeoutMs).toISOString() });
      const results = [];
      for (const delivery of claimed) {
        const event = await store.getEvent(delivery.eventId);
        const subscription = subscriptions.get(delivery.subscriberId);
        const handler = handlers.get(delivery.subscriberId);
        if (!event || !subscription || subscription.mode !== 'durable' || !handler) {
          const attempts = Number(delivery.attempts ?? 0) + 1;
          await store.markDeadLetter({ eventId: delivery.eventId, subscriberId: delivery.subscriberId, attempts, failureCode: 'subscriber-unavailable', updatedAt: clock().toISOString() });
          results.push({ ...delivery, status: 'dead-letter', attempts, failureCode: 'subscriber-unavailable' });
          if (event) await observe('internal_event_dead_lettered', event, { subscriberId: delivery.subscriberId, failureCode: 'subscriber-unavailable' });
          continue;
        }
        const attempts = Number(delivery.attempts ?? 0) + 1;
        try {
          await handler(event);
          const deliveredAt = clock().toISOString();
          await store.markDelivered({ eventId: event.eventId, subscriberId: subscription.subscriberId, attempts, deliveredAt });
          results.push({ ...delivery, status: 'delivered', attempts });
          await observe('internal_event_consumed', event, { subscriberId: subscription.subscriberId, mode: 'durable', attempts });
        } catch (error) {
          const failure = normalizeFailure(error);
          if (failure.retryable && attempts < subscription.maxAttempts) {
            const current = clock();
            const nextAttemptAt = new Date(current.getTime() + retryDelayMs * attempts).toISOString();
            await store.markRetry({ eventId: event.eventId, subscriberId: subscription.subscriberId, attempts, failureCode: failure.code, nextAttemptAt, updatedAt: current.toISOString() });
            results.push({ ...delivery, status: 'pending', attempts, failureCode: failure.code, nextAttemptAt });
            await observe('internal_event_consumer_failed', event, { subscriberId: subscription.subscriberId, mode: 'durable', attempts, failureCode: failure.code, retryable: true });
          } else {
            const updatedAt = clock().toISOString();
            await store.markDeadLetter({ eventId: event.eventId, subscriberId: subscription.subscriberId, attempts, failureCode: failure.code, updatedAt });
            results.push({ ...delivery, status: 'dead-letter', attempts, failureCode: failure.code });
            await observe('internal_event_dead_lettered', event, { subscriberId: subscription.subscriberId, attempts, failureCode: failure.code });
          }
        }
      }
      return Object.freeze(results);
    } finally { draining = false; }
  }

  function start() {
    if (worker) return;
    worker = setInterval(() => { drain().catch(() => {}); }, workerIntervalMs);
    worker.unref?.();
  }
  function stop() { if (worker) clearInterval(worker); worker = null; }
  async function requeueDeadLetter({ eventId, subscriberId }) {
    return store.requeueDeadLetter({ eventId: required(eventId, 'eventId'), subscriberId: required(subscriberId, 'subscriberId'), updatedAt: clock().toISOString() });
  }
  return Object.freeze({ publish, subscribe, drain, start, stop, requeueDeadLetter, store });
}
