import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnifiedHistoricalSearchOrchestrator } from '../src/history/unifiedHistoricalSearchOrchestrator.js';
import { createInMemoryMemory2Store } from '../src/memory2/inMemoryMemory2Store.js';
import { createMemory2Service } from '../src/memory2/memory2.js';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';

function request(overrides = {}) {
  return {
    actor: { globalUserId: 'user-a', roles: ['citizen'], grants: [], authenticationLevel: 'verified' },
    scope: { projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-hs6', requestId: 'request-hs6', environment: 'test', revision: 'hs6' },
    ...overrides
  };
}

function plan(overrides = {}) {
  return {
    status: 'planned',
    query: 'historical query',
    operation: 'search',
    semanticSubject: 'memory',
    temporalRange: null,
    scope: { globalUserId: 'user-a', projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    sourceHints: ['user-memory'],
    entityConstraints: [],
    outputMode: 'answer',
    confidence: 1,
    ...overrides
  };
}

const plannerReturning = (value) => async () => value;

function memoryScope(user = 'user-a', groupScope = null, threadScope = null) {
  return { userScope: user, globalUserId: user, projectScope: 'sg-2.1', groupScope, threadScope };
}

function actor(user = 'user-a') {
  return { globalUserId: user, roles: ['citizen'], grants: [], authenticationLevel: 'verified' };
}

async function writeMemory(service, { user = 'user-a', id, key, value, timestamp = '2025-08-19T12:00:00.000Z' }) {
  return service.write({
    id,
    key,
    value,
    scope: memoryScope(user),
    actor: actor(user),
    confirmed: true,
    trust: 'confirmed',
    provenance: { sourceType: 'test', sourceId: id, sourceTimestamp: timestamp }
  });
}

test('HS6: one-year historical range keeps supported old evidence available', async () => {
  const range = { utcStart: '2025-08-01T00:00:00.000Z', utcEndExclusive: '2025-09-01T00:00:00.000Z' };
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ temporalRange: range })),
    memory2: {
      async recall() {
        return {
          records: [{
            id: 'old-1', layer: 'user-memory', key: 'memory', value: 'supported historical fact',
            recallScore: 1, trust: 'confirmed', confirmed: true, confidence: 1,
            lifecycleState: 'superseded', createdAt: '2025-08-19T12:00:00.000Z', updatedAt: '2025-08-19T12:00:00.000Z',
            provenance: { sourceType: 'test', sourceId: 'old-1', sourceTimestamp: '2025-08-19T12:00:00.000Z' },
            privacyClass: 'private', tags: []
          }],
          conflicts: [], diagnostics: {}
        };
      }
    }
  });

  const result = await orchestrator.search({ request: request(), query: 'Что было год назад?' });
  assert.equal(result.status, 'completed');
  assert.equal(result.sources[0].items.length, 1);
  assert.equal(result.sources[0].items[0].lifecycle, 'superseded');
  assert.equal(result.contract.authorizationExpanded, false);
});

test('HS6: cross-user/project scope broadening fails before retrieval', async () => {
  let retrievalCalled = false;
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({
      scope: { globalUserId: 'user-b', projectScope: 'other-project', groupScope: null, threadScope: null }
    })),
    memory2: { async recall() { retrievalCalled = true; return { records: [] }; } }
  });

  await assert.rejects(
    orchestrator.search({ request: request(), query: 'show other memory' }),
    (error) => error.code === 'historical-orchestrator-plan-scope-mismatch'
  );
  assert.equal(retrievalCalled, false);
});

test('HS6: group/thread mismatch fails closed before semantic retrieval', async () => {
  let retrievalCalled = false;
  const req = request({ scope: { projectScope: 'sg-2.1', groupScope: 'group-a', threadScope: 'thread-a' } });
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({
      scope: { globalUserId: 'user-a', projectScope: 'sg-2.1', groupScope: 'group-b', threadScope: 'thread-b' },
      sourceHints: ['group-memory', 'thread-memory']
    })),
    memory2: { async recall() { retrievalCalled = true; return { records: [] }; } }
  });

  await assert.rejects(
    orchestrator.search({ request: req, query: 'group history' }),
    (error) => error.code === 'historical-orchestrator-plan-scope-mismatch'
  );
  assert.equal(retrievalCalled, false);
});

test('HS6: unauthorized Memory 2.0 content never reaches semantic processing', async () => {
  let semanticPayload = null;
  const aiRouter = {
    async route(input) {
      semanticPayload = JSON.parse(input.messages.at(-1).content);
      return { text: JSON.stringify({ scores: semanticPayload.candidates.map(({ id }) => ({ id, relevance: 0.5 })) }) };
    }
  };
  const service = createMemory2Service({
    store: createInMemoryMemory2Store(),
    clock: () => new Date('2026-08-19T12:00:00.000Z'),
    aiRouter
  });

  await writeMemory(service, { id: 'own', key: 'own-memory', value: 'authorized content' });
  await writeMemory(service, { user: 'user-b', id: 'other', key: 'other-memory', value: 'PRIVATE-OTHER-USER-CONTENT' });

  await service.recall({ scope: memoryScope('user-a'), actor: actor('user-a'), query: 'memory', maxRecords: 10, maxCharacters: 5000 });
  assert.ok(semanticPayload);
  const serialized = JSON.stringify(semanticPayload);
  assert.equal(serialized.includes('PRIVATE-OTHER-USER-CONTENT'), false);
  assert.deepEqual(semanticPayload.candidates.map((candidate) => candidate.id), ['own']);
});

test('HS6: observability redacts credentials and preserves bounded model accounting fields', () => {
  const store = createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store, idFactory: () => 'event-hs6', clock: () => '2026-08-19T12:00:00.000Z' });

  observability.recordModelCall({
    traceContext: request().traceContext,
    actorRef: 'user-a',
    transport: 'telegram',
    model: 'test-model',
    provider: 'test-provider',
    reason: 'memory2-hybrid-semantic-retrieval',
    outcome: 'success',
    durationMs: 12,
    costUsd: 0.001,
    usage: { inputTokens: 10, outputTokens: 2 },
    error: { token: 'ghp_123456789012345678901234567890', authorization: 'Bearer secret-value' }
  });

  const [event] = observability.list({ channel: 'telemetry', eventClass: 'model_call' });
  assert.ok(event);
  assert.equal(event.reason, 'memory2-hybrid-semantic-retrieval');
  assert.equal(event.traceContext.traceId, 'trace-hs6');
  assert.equal(event.data.model, 'test-model');
  assert.equal(event.data.provider, 'test-provider');
  assert.equal(event.costUsd, 0.001);
  assert.equal(event.data.error.token, '[REDACTED]');
  assert.equal(event.data.error.authorization, '[REDACTED]');
  assert.equal(JSON.stringify(event).includes('secret-value'), false);
});
