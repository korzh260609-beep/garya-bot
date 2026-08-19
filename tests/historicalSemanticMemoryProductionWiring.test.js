import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';

function request(input = {}) {
  return {
    actor: { globalUserId: 'user-a', roles: ['citizen'], grants: [], authenticationLevel: 'verified' },
    scope: { userScope: 'user-a', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-hs6-live', requestId: 'request-hs6-live', environment: 'test', revision: 'hs6' },
    input: {
      text: 'Что мы обсуждали год назад?',
      languageContext: { responseLanguage: 'ru' },
      semanticIntent: 'conversation-history',
      conversationHistoryQuery: { query: 'обсуждение год назад', temporalExpression: 'год назад', scope: 'current-scope', maxRecords: 100 },
      ...input
    }
  };
}

function historicalResult() {
  return {
    status: 'completed',
    plan: { operation: 'timeline', semanticSubject: 'история проекта', temporalRange: { utcStart: '2025-01-01T00:00:00.000Z', utcEndExclusive: '2026-01-01T00:00:00.000Z' }, outputMode: 'timeline', confidence: 0.97 },
    sources: [{
      source: 'conversation-history', status: 'ok', summary: 'Обсуждалась архитектура памяти.',
      items: [{ source: 'conversation-history', kind: 'conversation-turn', sourceId: 'internal-message-id', timestamp: '2025-08-19T10:00:00.000Z', text: 'Обсуждали архитектуру памяти.', lifecycle: null, provenance: { conversationId: 'internal-conversation-id' } }]
    }],
    merged: { items: [{ source: 'conversation-history', kind: 'conversation-turn', sourceId: 'internal-message-id', timestamp: '2025-08-19T10:00:00.000Z', text: 'Обсуждали архитектуру памяти.', lifecycle: null }] },
    operationResult: {
      operation: 'timeline',
      result: {
        status: 'available', grouping: 'month', emptyPeriodsFabricated: false,
        events: [{
          at: '2025-08-19T10:00:00.000Z',
          event: { date: '2025-08-19T10:00:00.000Z', source: 'Conversation History', subject: null, summary: 'Обсуждали архитектуру памяти.' },
          lifecycle: null, confirmationState: null,
          evidence: [{ source: 'conversation-history', sourceId: 'operation-secret-id', provenance: { conversationId: 'operation-secret-conversation' } }]
        }]
      },
      contract: { stage: 'HS5', internalEvidenceRetained: true, internalIdsExposedByDefault: false }
    },
    contract: { version: 3, stage: 'HS5', authorizationExpanded: false }
  };
}

const responseContextAssembler = {
  async assemble() {
    return {
      version: '2.4',
      confirmedUserMemory: [], reportedUserMemory: [], confirmedProjectMemory: [], confirmedSharedMemory: [],
      memoryRecall: { knowledgeState: 'UNKNOWN' }, conversationContext: { recentTurns: [] }, conversationHistory: null,
      selfKnowledge: { snapshotVersion: 'test', validationStatus: 'valid', facts: [] }, provenance: {}, truncationEvidence: {}
    };
  }
};

test('HS6 production wiring: historical semantic request uses unified search and bounded authorized result for response composition', async () => {
  const store = createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store, idFactory: (() => { let id = 0; return () => `event-${++id}`; })(), clock: () => '2026-08-19T12:00:00.000Z' });
  let searchCalls = 0;
  let responseCall = null;
  const historicalSearch = {
    async search({ request: searchRequest, query }) {
      searchCalls += 1;
      assert.equal(searchRequest.actor.globalUserId, 'user-a');
      assert.equal(searchRequest.scope.projectScope, 'sg2.1');
      assert.equal(query, 'Что мы обсуждали год назад?');
      return historicalResult();
    }
  };
  const aiRouter = {
    async route(call) {
      responseCall = call;
      return { text: 'Год назад мы обсуждали архитектуру памяти.' };
    }
  };
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler, historicalSearch, observability });
  const answer = await responder({ text: 'Что мы обсуждали год назад?', request: request() });

  assert.equal(answer, 'Год назад мы обсуждали архитектуру памяти.');
  assert.equal(searchCalls, 1);
  const historyMessage = responseCall.messages.find((message) => message.content.startsWith('HISTORICAL_SEARCH_CONTEXT'));
  assert.ok(historyMessage);
  assert.match(historyMessage.content, /Обсуждали архитектуру памяти/);
  assert.equal(historyMessage.content.includes('internal-message-id'), false);
  assert.equal(historyMessage.content.includes('operation-secret-id'), false);
  assert.equal(historyMessage.content.includes('operation-secret-conversation'), false);
  const events = observability.list({ channel: 'telemetry' }).filter((event) => event.stage === 'historical-semantic-search');
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, 'completed');
  assert.equal(events[0].data.operation, 'timeline');
  assert.equal(events[0].data.authorizationExpanded, false);
  const serializedTelemetry = JSON.stringify(events[0]);
  assert.equal(serializedTelemetry.includes('Что мы обсуждали год назад?'), false);
  assert.equal(serializedTelemetry.includes('Обсуждали архитектуру памяти.'), false);
});

test('HS6 production wiring: project historical semantic intent uses unified historical search', async () => {
  let searchCalls = 0;
  const historicalSearch = {
    async search({ query }) {
      searchCalls += 1;
      assert.equal(query, 'Как развивалась память СГ?');
      return historicalResult();
    }
  };
  const aiRouter = { async route() { return { text: 'История развития памяти найдена.' }; } };
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler, historicalSearch });
  const projectHistory = request({
    text: 'Как развивалась память СГ?',
    semanticIntent: 'project_development_evolution',
    conversationHistoryQuery: null
  });
  const answer = await responder({ text: 'Как развивалась память СГ?', request: projectHistory });
  assert.equal(answer, 'История развития памяти найдена.');
  assert.equal(searchCalls, 1);
});

test('HS6 production wiring: ordinary conversation does not invoke historical planner/search', async () => {
  let searchCalls = 0;
  const historicalSearch = { async search() { searchCalls += 1; return historicalResult(); } };
  const aiRouter = { async route() { return { text: 'Обычный ответ.' }; } };
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler, historicalSearch });
  const ordinary = request({ semanticIntent: 'answer', conversationHistoryQuery: null, text: 'Как дела?' });
  const answer = await responder({ text: 'Как дела?', request: ordinary });
  assert.equal(answer, 'Обычный ответ.');
  assert.equal(searchCalls, 0);
});

test('HS6 production wiring: historical scope mismatch remains fail-closed', async () => {
  const error = Object.assign(new Error('scope mismatch'), { code: 'historical-orchestrator-plan-scope-mismatch' });
  const historicalSearch = { async search() { throw error; } };
  const aiRouter = { async route() { throw new Error('response model must not run'); } };
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler, historicalSearch });
  await assert.rejects(
    responder({ text: 'Что мы обсуждали год назад?', request: request() }),
    (caught) => caught.code === 'historical-orchestrator-plan-scope-mismatch'
  );
});
