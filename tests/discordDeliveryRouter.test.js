import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryRouter, createDeliveryTransportRegistry, createInMemoryDeliveryStore } from '../src/delivery/deliveryRouter.js';
import { createDiscordDeliveryTransport, splitDiscordMessage } from '../src/delivery/discordDeliveryTransport.js';

const CHANNEL_ID = '1536277203505905706';

test('Discord current response remains origin-bound and idempotent through existing Delivery Router', async () => {
  const calls = [];
  const transport = createDiscordDeliveryTransport({
    restClient: {
      async sendMessage(payload) {
        calls.push(payload);
        return { id: `message-${calls.length}`, channel_id: payload.channelId };
      }
    }
  });
  const registry = createDeliveryTransportRegistry({ transports: [transport] });
  const router = createDeliveryRouter({ store: createInMemoryDeliveryStore(), transportRegistry: registry, maxAttempts: 1 });
  const request = {
    kind: 'current-response',
    actorGlobalUserId: 'usr_48cc07c069030fb3',
    recipientGlobalUserId: 'usr_48cc07c069030fb3',
    projectScope: 'sg2.1',
    message: 'Discord answer',
    originTarget: { transport: 'discord', address: CHANNEL_ID, threadId: CHANNEL_ID, replyToMessageId: '1536279999999999999' },
    idempotencyKey: 'discord-response:1536279999999999999',
    traceContext: { traceId: 'discord-router', requestId: 'discord-router' }
  };
  const first = await router.route(request);
  const duplicate = await router.route(request);
  assert.equal(first.status, 'delivered');
  assert.equal(first.transport, 'discord');
  assert.equal(duplicate.duplicate, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].channelId, CHANNEL_ID);
});

test('Discord delivery splits oversized responses without duplicating reply reference', async () => {
  const chunks = splitDiscordMessage('x'.repeat(4501));
  assert.deepEqual(chunks.map((item) => item.length), [2000, 2000, 501]);

  const calls = [];
  const transport = createDiscordDeliveryTransport({ restClient: { async sendMessage(payload) { calls.push(payload); return { id: `m${calls.length}`, channel_id: payload.channelId }; } } });
  const result = await transport.deliver({ request: { message: 'x'.repeat(4501), metadata: {} }, target: { address: CHANNEL_ID, replyToMessageId: 'origin-message' } });
  assert.equal(result.chunks, 3);
  assert.equal(calls[0].replyToMessageId, 'origin-message');
  assert.equal(calls[1].replyToMessageId, null);
  assert.equal(calls[2].replyToMessageId, null);
});
