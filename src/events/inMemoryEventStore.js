function clone(value) { return structuredClone(value); }

export function createInMemoryEventStore() {
  const events = new Map();
  const deliveries = new Map();
  const subscriptions = new Map();

  return Object.freeze({
    async appendEvent(event) { if (!events.has(event.eventId)) events.set(event.eventId, clone(event)); return clone(events.get(event.eventId)); },
    async getEvent(eventId) { return events.has(eventId) ? clone(events.get(eventId)) : null; },
    async registerSubscription(subscription) { subscriptions.set(subscription.subscriberId, clone(subscription)); return clone(subscription); },
    async listSubscriptions() { return [...subscriptions.values()].map(clone); },
    async enqueueDelivery(delivery) {
      const key = `${delivery.eventId}:${delivery.subscriberId}`;
      if (!deliveries.has(key)) deliveries.set(key, clone(delivery));
      return clone(deliveries.get(key));
    },
    async claimPending({ limit = 20, now = new Date().toISOString(), staleBefore = now } = {}) {
      const ready = [...deliveries.values()]
        .filter((item) => (item.status === 'pending' && (!item.nextAttemptAt || item.nextAttemptAt <= now)) || (item.status === 'processing' && item.updatedAt <= staleBefore))
        .sort((a, b) => `${a.createdAt}:${a.deliveryId}`.localeCompare(`${b.createdAt}:${b.deliveryId}`)).slice(0, limit);
      for (const item of ready) deliveries.set(`${item.eventId}:${item.subscriberId}`, { ...item, status: 'processing', updatedAt: now });
      return ready.map((item) => ({ ...clone(item), status: 'processing', updatedAt: now }));
    },
    async markDelivered({ eventId, subscriberId, attempts, deliveredAt }) {
      const key = `${eventId}:${subscriberId}`; const current = deliveries.get(key); if (!current) return null;
      const next = { ...current, status: 'delivered', attempts, deliveredAt, failureCode: null, nextAttemptAt: null, updatedAt: deliveredAt }; deliveries.set(key, next); return clone(next);
    },
    async markRetry({ eventId, subscriberId, attempts, failureCode, nextAttemptAt, updatedAt }) {
      const key = `${eventId}:${subscriberId}`; const current = deliveries.get(key); if (!current) return null;
      const next = { ...current, status: 'pending', attempts, failureCode, nextAttemptAt, updatedAt }; deliveries.set(key, next); return clone(next);
    },
    async markDeadLetter({ eventId, subscriberId, attempts, failureCode, updatedAt }) {
      const key = `${eventId}:${subscriberId}`; const current = deliveries.get(key); if (!current) return null;
      const next = { ...current, status: 'dead-letter', attempts, failureCode, nextAttemptAt: null, updatedAt }; deliveries.set(key, next); return clone(next);
    },
    async getDelivery({ eventId, subscriberId }) { const item = deliveries.get(`${eventId}:${subscriberId}`); return item ? clone(item) : null; },
    async listDeadLetters() { return [...deliveries.values()].filter((item) => item.status === 'dead-letter').map(clone); },
    async requeueDeadLetter({ eventId, subscriberId, updatedAt }) {
      const key = `${eventId}:${subscriberId}`; const current = deliveries.get(key); if (!current || current.status !== 'dead-letter') return null;
      const next = { ...current, status: 'pending', failureCode: null, nextAttemptAt: updatedAt, updatedAt }; deliveries.set(key, next); return clone(next);
    }
  });
}
