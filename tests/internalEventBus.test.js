import test from 'node:test';
import assert from 'node:assert/strict';
import { createInternalEventBus } from '../src/events/internalEventBus.js';
import { createInMemoryEventStore } from '../src/events/inMemoryEventStore.js';

function fixtureEvent(overrides = {}) {
  return {
    eventId: overrides.eventId,
    eventType: overrides.eventType ?? 'task.completed',
    version: '1.0',
    traceContext: { traceId: 'trace:1', requestId: 'request:1', environment: 'test', revision: 'block-16.14' },
    scope: { globalUserId: 'user:1', projectScope: 'sg2.1', groupScope: null, threadScope: null, resourceId: 'resource:1' },
    actorGlobalUserId: 'user:1',
    privacyClass: overrides.privacyClass ?? 'internal',
    provenance: { source: 'test' },
    payload: overrides.payload ?? { taskId: 'task:1', status: 'completed' }
  };
}

test('Block 16.14 typed sync subscribers receive matching facts without producer coupling', async () => {
  const seen = [];
  const bus = createInternalEventBus({ idFactory: () => 'sync-1' });
  await bus.subscribe({ subscriberId: 'audit-projection', eventTypes: ['task.completed'], mode: 'sync', scope: { projectScope: 'sg2.1' } }, async (event) => seen.push(event));
  const result = await bus.publish(fixtureEvent());
  assert.equal(result.event.eventId, 'event:sync-1');
  assert.equal(result.deliveries[0].status, 'delivered');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].payload.taskId, 'task:1');
});

test('Block 16.14 scope and privacy filters fail closed across users/projects/resources', async () => {
  const seen = [];
  const bus = createInternalEventBus({ idFactory: () => 'scope-1' });
  await bus.subscribe({ subscriberId: 'private-projection', eventTypes: ['task.completed'], mode: 'sync', privacyClasses: ['sensitive'], scope: { projectScope: 'other-project', globalUserId: 'user:2', resourceId: 'resource:2' } }, async (event) => seen.push(event));
  const result = await bus.publish(fixtureEvent({ privacyClass: 'sensitive' }));
  assert.equal(result.deliveries.length, 0);
  assert.equal(seen.length, 0);
});

test('Block 16.14 rejects secrets and unnecessary raw message content in payloads', async () => {
  const bus = createInternalEventBus({ idFactory: () => 'privacy-1' });
  await assert.rejects(() => bus.publish(fixtureEvent({ payload: { taskId: 'task:1', token: 'secret-value' } })), /forbidden/);
  await assert.rejects(() => bus.publish(fixtureEvent({ payload: { message: 'raw user message' } })), /forbidden/);
});

test('Block 16.14 durable delivery is idempotent for duplicate event publication', async () => {
  let calls = 0;
  const store = createInMemoryEventStore();
  const bus = createInternalEventBus({ store, idFactory: () => 'unused' });
  await bus.subscribe({ subscriberId: 'durable-worker', eventTypes: ['task.completed'], mode: 'durable' }, async () => { calls += 1; });
  const event = fixtureEvent({ eventId: 'event:fixed' });
  await bus.publish(event);
  await bus.publish(event);
  const firstDrain = await bus.drain();
  const secondDrain = await bus.drain();
  assert.equal(firstDrain.length, 1);
  assert.equal(firstDrain[0].status, 'delivered');
  assert.equal(secondDrain.length, 0);
  assert.equal(calls, 1);
});

test('Block 16.14 durable failures retry boundedly, dead-letter and can be requeued', async () => {
  let now = new Date('2026-08-08T17:00:00.000Z');
  let failuresRemaining = 3;
  const clock = () => new Date(now);
  const store = createInMemoryEventStore();
  const bus = createInternalEventBus({ store, clock, retryDelayMs: 1000, idFactory: () => 'retry-1' });
  await bus.subscribe({ subscriberId: 'fragile-worker', eventTypes: ['delivery.failed'], mode: 'durable', maxAttempts: 2 }, async () => {
    if (failuresRemaining > 0) { failuresRemaining -= 1; const error = new Error('temporary'); error.code = 'temporary'; error.retryable = true; throw error; }
  });
  const published = await bus.publish(fixtureEvent({ eventType: 'delivery.failed' }));
  const eventId = published.event.eventId;
  const first = await bus.drain();
  assert.equal(first[0].status, 'pending');
  now = new Date(now.getTime() + 1500);
  const second = await bus.drain();
  assert.equal(second[0].status, 'dead-letter');
  const dead = await store.listDeadLetters();
  assert.equal(dead.length, 1);
  failuresRemaining = 0;
  await bus.requeueDeadLetter({ eventId, subscriberId: 'fragile-worker' });
  const recovered = await bus.drain();
  assert.equal(recovered[0].status, 'delivered');
});

test('Block 16.14 stale processing claims are recoverable after worker interruption', async () => {
  let now = new Date('2026-08-08T17:00:00.000Z');
  const clock = () => new Date(now);
  const store = createInMemoryEventStore();
  const bus = createInternalEventBus({ store, clock, processingTimeoutMs: 1000, idFactory: () => 'stale-1' });
  let calls = 0;
  await bus.subscribe({ subscriberId: 'restart-worker', eventTypes: ['schedule.triggered'], mode: 'durable' }, async () => { calls += 1; });
  const published = await bus.publish(fixtureEvent({ eventType: 'schedule.triggered' }));
  const claimed = await store.claimPending({ now: clock().toISOString(), staleBefore: new Date(now.getTime() - 1000).toISOString() });
  assert.equal(claimed.length, 1);
  now = new Date(now.getTime() + 1500);
  const recovered = await bus.drain();
  assert.equal(recovered[0].status, 'delivered');
  assert.equal(calls, 1);
  assert.equal((await store.getDelivery({ eventId: published.event.eventId, subscriberId: 'restart-worker' })).status, 'delivered');
});

test('Block 16.14 event names are typed contracts, not arbitrary keyword commands', async () => {
  const bus = createInternalEventBus({ idFactory: () => 'contract-1' });
  await assert.rejects(() => bus.publish(fixtureEvent({ eventType: 'do-anything-now' })), /unsupported internal event type/);
});
