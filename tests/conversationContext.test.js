import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationContextService, createInMemoryConversationContextStore } from '../src/conversation/conversationContextService.js';

function fixture({ maxRecentTurns = 6 } = {}) {
  let sequence = 0;
  let tick = 0;
  const events = [];
  const store = createInMemoryConversationContextStore();
  const service = createConversationContextService({
    store,
    maxRecentTurns,
    idFactory: () => `id-${++sequence}`,
    clock: () => new Date(Date.parse('2026-08-08T16:00:00Z') + (tick++ * 1000)),
    audit: (event) => events.push(event)
  });
  return { service, store, events };
}
const base = { globalUserId: 'user:1', projectScope: 'sg2.1', transport: 'telegram', text: 'hello' };

test('Block 16.11 distinguishes conversation start from deterministic same-session continuation', async () => {
  const { service } = fixture();
  const first = await service.resolveTurn({ ...base, transportSessionId: 'tg-session', platformMessageId: '1' });
  const second = await service.resolveTurn({ ...base, text: 'continue', transportSessionId: 'tg-session', platformMessageId: '2' });
  assert.equal(first.transition, 'start');
  assert.equal(second.transition, 'continuation');
  assert.equal(second.conversationId, first.conversationId);
  assert.equal(second.sessionId, first.sessionId);
  assert.deepEqual(second.recentTurns.map((turn) => turn.text), ['hello', 'continue']);
});

test('Block 16.11 does not automatically merge a new transport session', async () => {
  const { service } = fixture();
  const first = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'web-a', platformMessageId: 'a' });
  const second = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'web-b', platformMessageId: 'b' });
  assert.notEqual(second.conversationId, first.conversationId);
  assert.equal(second.transition, 'start');
});

test('Block 16.11 reply chains continue the correct scoped conversation', async () => {
  const { service } = fixture();
  const first = await service.resolveTurn({ ...base, groupScope: 'group:1', threadScope: 'thread:1', platformMessageId: '100' });
  const reply = await service.resolveTurn({ ...base, groupScope: 'group:1', threadScope: 'thread:1', platformMessageId: '101', replyToMessageId: '100', text: 'reply' });
  assert.equal(reply.transition, 'reply-continuation');
  assert.equal(reply.conversationId, first.conversationId);
  const otherThread = await service.resolveTurn({ ...base, groupScope: 'group:1', threadScope: 'thread:2', platformMessageId: '102', replyToMessageId: '100', text: 'other thread' });
  assert.notEqual(otherThread.conversationId, first.conversationId);
});

test('Block 16.11 topic shift keeps one conversation but isolates recent topic context', async () => {
  const { service } = fixture();
  const first = await service.resolveTurn({ ...base, transportSessionId: 'same', platformMessageId: '1', text: 'topic A' });
  await service.recordOutbound({ conversationContext: first, globalUserId: 'user:1', projectScope: 'sg2.1', transport: 'telegram', text: 'answer A' });
  const shifted = await service.resolveTurn({ ...base, transportSessionId: 'same', platformMessageId: '2', text: 'topic B', topicShift: true, topicKey: 'B' });
  assert.equal(shifted.conversationId, first.conversationId);
  assert.notEqual(shifted.topicId, first.topicId);
  assert.equal(shifted.transition, 'topic-shift');
  assert.deepEqual(shifted.recentTurns.map((turn) => turn.text), ['topic B']);
});

test('Block 16.11 cross-transport continuation is denied until explicitly approved', async () => {
  const { service } = fixture();
  const first = await service.resolveTurn({ ...base, transport: 'telegram', platformMessageId: '1' });
  await assert.rejects(() => service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'web-1', continueConversationId: first.conversationId, platformMessageId: 'web-1' }), (error) => error.code === 'conversation-cross-scope-denied');
  await service.approveCrossTransportContinuation({ conversationId: first.conversationId, globalUserId: 'user:1', projectScope: 'sg2.1' });
  const continued = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'web-1', continueConversationId: first.conversationId, platformMessageId: 'web-2' });
  assert.equal(continued.conversationId, first.conversationId);
  assert.equal(continued.transition, 'approved-cross-transport');
  assert.notEqual(continued.sessionId, first.sessionId);
});

test('Block 16.11 two conversations for one user coexist without recent-turn contamination', async () => {
  const { service } = fixture();
  const a = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'A', text: 'alpha', platformMessageId: 'a1' });
  const b = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'B', text: 'beta', platformMessageId: 'b1' });
  const a2 = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'A', text: 'alpha-2', platformMessageId: 'a2' });
  assert.notEqual(a.conversationId, b.conversationId);
  assert.equal(a2.conversationId, a.conversationId);
  assert.deepEqual(a2.recentTurns.map((turn) => turn.text), ['alpha', 'alpha-2']);
  assert.ok(!a2.recentTurns.some((turn) => turn.text === 'beta'));
});

test('Block 16.11 closure prevents silent continuation and transitions are message-content-free in audit', async () => {
  const { service, events } = fixture();
  const first = await service.resolveTurn({ ...base, transportSessionId: 'same', platformMessageId: '1', text: 'private content' });
  await service.closeConversation({ conversationId: first.conversationId, globalUserId: 'user:1', projectScope: 'sg2.1' });
  const next = await service.resolveTurn({ ...base, transportSessionId: 'same', platformMessageId: '2', text: 'new conversation' });
  assert.notEqual(next.conversationId, first.conversationId);
  assert.ok(events.some((event) => event.outcome === 'closed'));
  assert.ok(!JSON.stringify(events).includes('private content'));
});

test('Block 16.11 recent context is bounded independently from long-term memory', async () => {
  const { service } = fixture({ maxRecentTurns: 3 });
  let current;
  for (let index = 1; index <= 5; index += 1) current = await service.resolveTurn({ ...base, transportSessionId: 'same', platformMessageId: String(index), text: `turn-${index}` });
  assert.deepEqual(current.recentTurns.map((turn) => turn.text), ['turn-3','turn-4','turn-5']);
  assert.equal(typeof service.writeMemory, 'undefined');
});
