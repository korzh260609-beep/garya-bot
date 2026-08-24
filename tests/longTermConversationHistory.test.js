import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveLongTermConversationHistory } from '../src/conversation/longTermConversationHistory.js';
import { createPostgresConversationContextStore } from '../src/conversation/postgresConversationContextStore.js';

function request() {
  return {
    actor: { globalUserId: 'user:a', roles: ['monarch'] },
    scope: { projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace:history', requestId: 'request:history' }
  };
}
function row(index) {
  return { messageId: `message:${String(index).padStart(3, '0')}`, conversationId: 'conversation:1', topicId: 'topic:1', direction: index % 2 ? 'outbound' : 'inbound', content: { text: `discussion item ${index}` }, createdAt: index < 4 ? '2026-08-13T08:00:00.000Z' : `2026-08-13T08:00:0${index - 3}.000Z`, replyToMessageId: null };
}
function fakeRouter(calls) {
  return {
    async route(input) {
      calls.push(input);
      const payload = JSON.parse(input.messages[1].content);
      if (input.task === 'conversation-history-plan') return { text: JSON.stringify({ operation: 'summarize-range' }) };
      if (input.task === 'conversation-history-chunk') {
        const first = payload.messages[0]?.id;
        return { text: JSON.stringify({ matched: true, relevanceScore: 0.9, summary: `chunk:${first}`, topics: ['development'], evidenceIds: first ? [first] : [] }) };
      }
      if (input.task === 'conversation-history-merge') {
        const ids = payload.summaries.flatMap((item) => item.evidence ?? []).map((item) => item.id).filter(Boolean).slice(0, 4);
        return { text: JSON.stringify({ matched: true, relevanceScore: 0.9, summary: 'merged bounded history', topics: ['development'], evidenceIds: ids }) };
      }
      if (input.task === 'conversation-history-verify') {
        const ids = payload.originalMessages.map((item) => item.id).slice(0, 4);
        return { text: JSON.stringify({ verified: true, summary: 'verified bounded history', topics: ['development'], evidenceIds: ids }) };
      }
      throw new Error(`unexpected task ${input.task}`);
    }
  };
}

test('Long-Term Conversation History traverses all keyset pages and returns only bounded verified evidence', async () => {
  const rows = Array.from({ length: 7 }, (_, index) => row(index));
  const pageCalls = [];
  const store = {
    async listMessagesByRange() { throw new Error('raw range fallback must not be used when keyset paging exists'); },
    async listMessagesPage(input) {
      pageCalls.push(input);
      const start = input.afterMessageId ? rows.findIndex((item) => item.messageId === input.afterMessageId) + 1 : 0;
      return rows.slice(start, start + input.limit);
    }
  };
  const aiCalls = [];
  const result = await retrieveLongTermConversationHistory({ store, aiRouter: fakeRouter(aiCalls), request: request(), query: 'overview of the discussions in the selected period', temporalRange: { utcStart: '2026-08-13T00:00:00.000Z', utcEndExclusive: '2026-08-14T00:00:00.000Z' }, pageSize: 3, mergeFanout: 2, evidenceLimit: 4 });
  assert.equal(result.retrieval.scannedMessages, 7);
  assert.equal(result.retrieval.pages, 3);
  assert.equal(result.retrieval.completeRange, true);
  assert.equal(result.retrieval.hierarchical, true);
  assert.equal(result.retrieval.sourceVerified, true);
  assert.equal(result.summary, 'verified bounded history');
  assert.ok(result.turns.length <= 4);
  assert.equal(pageCalls[1].afterCreatedAt, rows[2].createdAt);
  assert.equal(pageCalls[1].afterMessageId, rows[2].messageId);
  assert.ok(aiCalls.filter((call) => call.task === 'conversation-history-chunk').every((call) => call.messages[1].content.length < 14000));
});

test('Postgres Conversation History keyset page orders by created_at and message_id with a composite cursor', async () => {
  const calls = [];
  const database = { async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } };
  const store = createPostgresConversationContextStore({ database });
  await store.listMessagesPage({ globalUserId: 'user:a', projectScope: 'sg2.1', utcStart: '2026-08-13T00:00:00.000Z', utcEndExclusive: '2026-08-14T00:00:00.000Z', afterCreatedAt: '2026-08-13T08:00:00.000Z', afterMessageId: 'message:003', limit: 20 });
  assert.match(calls[0].sql, /created_at > \$9::timestamptz/);
  assert.match(calls[0].sql, /created_at = \$9::timestamptz AND message_id > \$10::text/);
  assert.match(calls[0].sql, /ORDER BY created_at,message_id LIMIT \$11/);
  assert.equal(calls[0].params[8], '2026-08-13T08:00:00.000Z');
  assert.equal(calls[0].params[9], 'message:003');
  assert.equal(calls[0].params[10], 20);
});

test('Postgres Conversation History rejects half-defined keyset cursors', async () => {
  const store = createPostgresConversationContextStore({ database: { async query() { return { rows: [] }; } } });
  await assert.rejects(() => store.listMessagesPage({ globalUserId: 'user:a', projectScope: 'sg2.1', afterCreatedAt: '2026-08-13T08:00:00.000Z', limit: 20 }), /requires afterCreatedAt and afterMessageId together/);
});
