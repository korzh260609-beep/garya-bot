import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresEventStore } from '../src/events/postgresEventStore.js';
import { createInternalEventBus } from '../src/events/internalEventBus.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function eventInput(eventId, projectScope = 'sg2.1') {
  return {
    eventId,
    eventType: 'task.completed',
    version: '1.0',
    traceContext: { traceId: `trace:${eventId}`, requestId: `request:${eventId}`, environment: 'test', revision: 'block-16.14' },
    scope: { globalUserId: 'user:postgres', projectScope, groupScope: null, threadScope: null, resourceId: null },
    actorGlobalUserId: 'user:postgres',
    privacyClass: 'internal',
    provenance: { source: 'postgres-test' },
    payload: { taskId: `task:${eventId}`, status: 'completed' }
  };
}

integration('Block 16.14 PostgreSQL durable event survives restart and duplicate publication stays single-delivery', async () => {
  const suffix = randomUUID();
  const eventId = `event:${suffix}`;
  const subscriberId = `subscriber:${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'event-bus-test' });
  await persistence.start();
  const store = createPostgresEventStore({ database: persistence.database });
  const firstBus = createInternalEventBus({ store });
  await firstBus.subscribe({ subscriberId, eventTypes: ['task.completed'], mode: 'durable', scope: { projectScope: 'sg2.1' } }, async () => {});
  await firstBus.publish(eventInput(eventId));
  await firstBus.publish(eventInput(eventId));
  const queued = await store.getDelivery({ eventId, subscriberId });
  assert.equal(queued.status, 'pending');
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'event-bus-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresEventStore({ database: restarted.database });
  let calls = 0;
  const restartedBus = createInternalEventBus({ store: restartedStore });
  await restartedBus.subscribe({ subscriberId, eventTypes: ['task.completed'], mode: 'durable', scope: { projectScope: 'sg2.1' } }, async () => { calls += 1; });
  const drained = await restartedBus.drain();
  assert.equal(drained.length, 1);
  assert.equal(drained[0].status, 'delivered');
  assert.equal(calls, 1);
  assert.equal((await restartedStore.getDelivery({ eventId, subscriberId })).status, 'delivered');
  const count = await restarted.database.query('SELECT count(*)::int AS count FROM internal_event_deliveries WHERE event_id=$1 AND subscriber_id=$2', [eventId, subscriberId]);
  assert.equal(count.rows[0].count, 1);
  await restarted.close();
});
