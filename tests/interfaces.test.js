import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalTransportAdapter,
  createTelegramTransportAdapter,
  createWebApiTransportAdapter,
  createDiscordTransportAdapter
} from '../src/interfaces/adapters.js';
import { createInterfaceRegistry } from '../src/interfaces/interfaceRegistry.js';
import { createLocalInterfaceHarness } from '../src/interfaces/localHarness.js';

function fixture(overrides = {}) {
  const calls = [];
  let id = 0;
  const identityResolver = async (facts) => {
    calls.push(facts);
    return {
      identityContext: { globalUserId: 'global:user-1', roles: ['citizen'], grants: ['answer'] },
      scopeContext: { userScope: 'global:user-1', projectScope: 'sg2.1', allowedCapabilities: ['answer'] }
    };
  };
  const requestHandler = async (input) => ({ status: 'success', message: `accepted:${input.metadata.transport}`, data: { globalUserId: input.identityContext.globalUserId } });
  const deliveries = [];
  return {
    calls,
    deliveries,
    options: {
      identityResolver,
      requestHandler,
      responseDeliverer: async (delivery) => deliveries.push(delivery),
      idFactory: () => `id-${++id}`,
      environment: 'test',
      revision: 'block-8',
      ...overrides
    }
  };
}

test('local adapter creates canonical input and delivers normalized response', async () => {
  const f = fixture();
  const adapter = createLocalTransportAdapter(f.options);
  const result = await adapter.receive({ text: 'hello', userId: 'local-1', projectId: 'sg2.1' });
  assert.equal(result.canonicalInput.metadata.transport, 'local');
  assert.equal(result.canonicalInput.identityContext.globalUserId, 'global:user-1');
  assert.equal(result.canonicalInput.traceContext.traceId, 'id-1');
  assert.equal(result.response.message, 'accepted:local');
  assert.equal(f.deliveries.length, 1);
});

test('transports submit platform facts but cannot assign roles grants or scopes', async () => {
  const f = fixture();
  const adapter = createWebApiTransportAdapter(f.options);
  const result = await adapter.receive({
    auth: { subject: 'web-7', roles: ['monarch'], grants: ['repository.write'] },
    body: { text: 'hello', projectId: 'attacker-project', roles: ['monarch'], allowedCapabilities: ['repository.write'] }
  });
  assert.deepEqual(result.canonicalInput.identityContext.roles, ['citizen']);
  assert.deepEqual(result.canonicalInput.identityContext.grants, ['answer']);
  assert.equal(result.canonicalInput.scopeContext.projectScope, 'sg2.1');
  assert.equal(f.calls[0].platformFacts.platformUserId, 'web-7');
  assert.equal(f.calls[0].scopeFacts.projectId, 'attacker-project');
  assert.equal('roles' in f.calls[0].platformFacts, false);
});

test('telegram adapter preserves group and thread facts for centralized scope resolution', async () => {
  const f = fixture();
  const adapter = createTelegramTransportAdapter(f.options);
  await adapter.receive({ message: { message_id: 4, message_thread_id: 8, text: 'hello', from: { id: 11 }, chat: { id: -22, type: 'supergroup' } } });
  assert.deepEqual(f.calls[0].scopeFacts, { projectId: null, groupId: '-22', threadId: '8' });
  assert.equal(f.calls[0].platformFacts.platform, 'telegram');
});

test('discord adapter and web adapter share the same core contract', async () => {
  const discord = fixture();
  const web = fixture();
  const discordResult = await createDiscordTransportAdapter(discord.options).receive({ id: 'm1', content: 'hello', author: { id: 'u1' }, channel_id: 'c1', guild_id: 'g1' });
  const webResult = await createWebApiTransportAdapter(web.options).receive({ auth: { subject: 'u1' }, body: { text: 'hello' } });
  for (const result of [discordResult, webResult]) {
    assert.equal(result.canonicalInput.text, 'hello');
    assert.equal(result.canonicalInput.identityContext.globalUserId, 'global:user-1');
    assert.equal(result.response.status, 'success');
  }
});

test('interface registry rejects duplicates and dispatches by transport name', async () => {
  const f = fixture();
  const local = createLocalTransportAdapter(f.options);
  const registry = createInterfaceRegistry([local]);
  assert.deepEqual(registry.list(), ['local']);
  await assert.rejects(async () => registry.register(local), /already registered/);
  const result = await registry.receive('local', { text: 'hello', userId: 'u1' });
  assert.equal(result.response.message, 'accepted:local');
});

test('local harness provides a deterministic transport integration fixture', async () => {
  const f = fixture();
  const harness = createLocalInterfaceHarness({ identityResolver: f.options.identityResolver, requestHandler: f.options.requestHandler });
  const result = await harness.send({ text: 'hello', userId: 'u1' });
  assert.equal(result.canonicalInput.metadata.transport, 'local');
  assert.equal(harness.deliveries.length, 1);
});

test('invalid transport input fails closed before core execution', async () => {
  const f = fixture();
  const adapter = createTelegramTransportAdapter(f.options);
  await assert.rejects(() => adapter.receive({}), /must contain a message/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.deliveries.length, 0);
});
