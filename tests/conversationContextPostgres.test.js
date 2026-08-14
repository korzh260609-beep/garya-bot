import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresConversationContextStore } from '../src/conversation/postgresConversationContextStore.js';
import { createConversationContextService } from '../src/conversation/conversationContextService.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Block 16.11 conversation state survives PostgreSQL restart and remains identity/scope isolated', async () => {
  const suffix = randomUUID();
  const user = `conversation-user:${suffix}`;
  const otherUser = `conversation-other:${suffix}`;
  let sequence = 0;
  const idFactory = () => `${suffix}-${++sequence}`;
  const clock = () => new Date('2026-08-08T16:00:00Z');

  let persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-16-11-conversation-test' });
  await persistence.start();
  await persistence.repositories.users.upsert({ globalUserId: user });
  await persistence.repositories.users.upsert({ globalUserId: otherUser });
  const service = createConversationContextService({ store: createPostgresConversationContextStore({ database: persistence.database }), idFactory, clock, maxRecentTurns: 6 });

  const first = await service.resolveTurn({ globalUserId: user, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1', transport: 'telegram', platformMessageId: `msg-${suffix}-1`, text: 'first durable turn' });
  await service.recordOutbound({ conversationContext: first, globalUserId: user, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1', transport: 'telegram', text: 'durable answer' });
  await persistence.close();

  persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-16-11-conversation-restart-test' });
  await persistence.start();
  const restarted = createConversationContextService({ store: createPostgresConversationContextStore({ database: persistence.database }), idFactory, clock, maxRecentTurns: 6 });
  const continued = await restarted.resolveTurn({ globalUserId: user, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1', transport: 'telegram', platformMessageId: `msg-${suffix}-2`, text: 'after restart' });
  assert.equal(continued.conversationId, first.conversationId);
  assert.equal(continued.transition, 'continuation');
  assert.deepEqual(continued.recentTurns.map((turn) => turn.text), ['first durable turn','durable answer','after restart']);

  const isolated = await restarted.resolveTurn({ globalUserId: otherUser, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1', transport: 'telegram', platformMessageId: `msg-${suffix}-3`, text: 'other user' });
  assert.notEqual(isolated.conversationId, first.conversationId);
  assert.ok(!isolated.recentTurns.some((turn) => turn.text === 'first durable turn'));

  const wrongThread = await restarted.resolveTurn({ globalUserId: user, projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:2', transport: 'telegram', platformMessageId: `msg-${suffix}-4`, text: 'other thread' });
  assert.notEqual(wrongThread.conversationId, first.conversationId);
  await persistence.close();
});
