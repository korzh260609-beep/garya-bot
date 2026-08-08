import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDeliveryRouter, createDeliveryTransportRegistry, createInMemoryDeliveryStore } from '../src/delivery/deliveryRouter.js';
import { createPostgresDeliveryStore } from '../src/delivery/postgresDeliveryStore.js';
import { createUserSettingsService } from '../src/settings/userSettingsService.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

const connectionString = process.env.DATABASE_URL;
const postgresIntegration = connectionString ? test : test.skip;

function registry(deliver) { return createDeliveryTransportRegistry({ transports: [{ name: 'telegram', deliver }] }); }
function base(overrides = {}) {
  return {
    kind: 'current-response', actorGlobalUserId: 'user-a', recipientGlobalUserId: 'user-a', projectScope: 'sg2.1', message: 'hello',
    originTarget: { transport: 'telegram', address: 'chat-a', replyToMessageId: '10' }, idempotencyKey: 'delivery-key-1', traceContext: { traceId: 't', requestId: 'r' }, ...overrides
  };
}

test('current response is bound to its origin and returns normalized DeliveryResult', async () => {
  const sent = [];
  const router = createDeliveryRouter({ transportRegistry: registry(async ({ request, target }) => { sent.push({ request, target }); return { messageId: 'm1' }; }) });
  const result = await router.route(base());
  assert.equal(result.status, 'delivered');
  assert.equal(result.transport, 'telegram');
  assert.equal(result.attempts, 1);
  assert.equal(sent[0].target.address, 'chat-a');
});

test('idempotency prevents duplicate delivery', async () => {
  let calls = 0;
  const router = createDeliveryRouter({ transportRegistry: registry(async () => { calls += 1; }) });
  const first = await router.route(base());
  const second = await router.route(base());
  assert.equal(first.status, 'delivered');
  assert.equal(second.duplicate, true);
  assert.equal(calls, 1);
});

test('retry is bounded and visible', async () => {
  let calls = 0;
  const router = createDeliveryRouter({ maxAttempts: 2, transportRegistry: registry(async () => { calls += 1; const error = new Error('temporary'); error.code = 'ECONNRESET'; error.retryable = true; throw error; }) });
  const result = await router.route(base());
  assert.equal(result.status, 'failed');
  assert.equal(result.retryable, true);
  assert.equal(result.attempts, 2);
  assert.equal(calls, 2);
});

test('notification preferences can suppress and quiet hours can defer without transport execution', async () => {
  let calls = 0;
  const settings = createUserSettingsService();
  const router = createDeliveryRouter({ userSettingsService: settings, clock: () => new Date('2026-08-08T21:30:00Z'), transportRegistry: registry(async () => { calls += 1; }) });
  await settings.update('user-a', { notifications: { enabled: false } }, { projectScope: 'sg2.1' });
  let result = await router.route(base({ kind: 'notification', originTarget: null, target: { transport: 'telegram', resourceId: 'r1', address: 'chat-a' }, explicitTarget: true, idempotencyKey: 'disabled' }));
  assert.equal(result.status, 'suppressed');
  await settings.update('user-a', { notifications: { enabled: true, quietHours: { enabled: true, start: '22:00', end: '08:00', timeZone: 'UTC' } } }, { projectScope: 'sg2.1' });
  result = await router.route(base({ kind: 'notification', originTarget: null, target: { transport: 'telegram', resourceId: 'r1', address: 'chat-a' }, explicitTarget: true, idempotencyKey: 'quiet' }));
  assert.equal(result.status, 'deferred');
  assert.equal(result.failureCode, 'quiet-hours');
  assert.equal(calls, 0);
});

test('preferred transport is honored only when target is authorized', async () => {
  const settings = createUserSettingsService();
  await settings.update('user-a', { delivery: { preferredTransport: 'telegram' } }, { projectScope: 'sg2.1' });
  const authority = { async checkAuthority({ actorGlobalUserId, resourceId }) { return { allowed: actorGlobalUserId === 'user-a' && resourceId === 'r1', reason: 'test' }; } };
  const router = createDeliveryRouter({ userSettingsService: settings, resourceAuthorityRegistry: authority, transportRegistry: registry(async () => ({ ok: true })) });
  const result = await router.route(base({ kind: 'notification', originTarget: null, target: null, idempotencyKey: 'preferred', metadata: { targets: { telegram: { transport: 'telegram', resourceId: 'r1', address: 'chat-a' } } } }));
  assert.equal(result.status, 'delivered');
  assert.equal(result.target.resourceId, 'r1');
});

test('cross-user and cross-resource delivery fail closed', async () => {
  let calls = 0;
  const authority = { async checkAuthority({ resourceId }) { return { allowed: resourceId === 'owned', reason: resourceId === 'owned' ? 'ok' : 'resource-authority-missing' }; } };
  const router = createDeliveryRouter({ resourceAuthorityRegistry: authority, transportRegistry: registry(async () => { calls += 1; }) });
  const crossUser = await router.route(base({ kind: 'notification', recipientGlobalUserId: 'user-b', originTarget: null, target: { transport: 'telegram', resourceId: 'owned', address: 'chat-b' }, explicitTarget: true, idempotencyKey: 'cross-user' }));
  assert.equal(crossUser.status, 'failed');
  assert.equal(crossUser.failureCode, 'cross-user-delivery-not-authorized');
  const crossResource = await router.route(base({ kind: 'notification', originTarget: null, target: { transport: 'telegram', resourceId: 'foreign', address: 'chat-x' }, explicitTarget: true, idempotencyKey: 'cross-resource' }));
  assert.equal(crossResource.status, 'failed');
  assert.equal(crossResource.failureCode, 'resource-authority-missing');
  assert.equal(calls, 0);
});

postgresIntegration('Block 16.13 delivery status and idempotency survive PostgreSQL service recreation', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-delivery-test-a' });
  await persistence.start();
  const key = `delivery-${randomUUID()}`;
  try {
    const store = createPostgresDeliveryStore({ database: persistence.database });
    const router = createDeliveryRouter({ store, transportRegistry: registry(async () => ({ messageId: 'persisted' })) });
    const first = await router.route(base({ idempotencyKey: key }));
    assert.equal(first.status, 'delivered');
  } finally { await persistence.close(); }

  const verifier = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-delivery-test-b' });
  await verifier.start();
  try {
    const store = createPostgresDeliveryStore({ database: verifier.database });
    let calls = 0;
    const router = createDeliveryRouter({ store, transportRegistry: registry(async () => { calls += 1; }) });
    const duplicate = await router.route(base({ idempotencyKey: key }));
    assert.equal(duplicate.status, 'delivered');
    assert.equal(duplicate.duplicate, true);
    assert.equal(calls, 0);
  } finally { await verifier.close(); }
});
