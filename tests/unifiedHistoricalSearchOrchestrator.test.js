import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnifiedHistoricalSearchOrchestrator } from '../src/history/unifiedHistoricalSearchOrchestrator.js';

function request(overrides = {}) {
  return {
    actor: { globalUserId: 'user-1', roles: ['citizen'] },
    scope: { projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-hs3' },
    ...overrides
  };
}

function plan(overrides = {}) {
  return {
    status: 'planned',
    query: 'Что было про машину?',
    operation: 'search',
    semanticSubject: 'машина',
    temporalRange: null,
    scope: { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    sourceHints: ['conversation-history', 'user-memory'],
    entityConstraints: [],
    outputMode: 'answer',
    confidence: 0.95,
    ...overrides
  };
}

function plannerReturning(value) {
  return async () => value;
}

function memoryRecord(overrides = {}) {
  return {
    id: 'm1', layer: 'user-memory', key: 'car', value: 'Freelander 2',
    recallScore: 4.2, trust: 'reported', confirmed: false, confidence: 0.8,
    lifecycleState: 'active', createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z',
    provenance: { sourceType: 'conversation', sourceId: 'msg-1', sourceTimestamp: '2026-07-01T10:00:00.000Z' },
    privacyClass: 'private', tags: [], ...overrides
  };
}

test('HS3 personal default queries only Conversation History and personal Memory 2.0', async () => {
  const calls = [];
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ sourceHints: [] })),
    conversationHistoryStore: {},
    conversationHistoryRetrieve: async (input) => {
      calls.push(['conversation', input]);
      return { summary: 'Обсуждали машину', turns: [{ messageId: 'c1', createdAt: '2026-07-01T09:00:00.000Z', text: 'Про машину', direction: 'in' }], retrieval: { sourceVerified: true } };
    },
    memory2: { async recall(input) { calls.push(['memory2', input]); return { records: [memoryRecord()], conflicts: [], diagnostics: { returnedCount: 1 } }; } },
    projectMemoryRetrieval: { async search() { throw new Error('must not be called'); } },
    pdk4: { async contextForRequest() { throw new Error('must not be called'); } }
  });

  const result = await orchestrator.search({ request: request(), query: 'Что было про машину?' });
  assert.equal(result.status, 'completed');
  assert.equal(result.selection.defaulted, true);
  assert.deepEqual(result.selection.canonicalSources, ['conversation-history', 'memory2']);
  assert.deepEqual(calls.map(([name]) => name), ['conversation', 'memory2']);
  assert.deepEqual(calls[1][1].layers, ['user-memory']);
  assert.equal(result.contract.authorizationExpanded, false);
});

test('HS3 group/thread hints stay resource-bound and omit unavailable thread scope', async () => {
  const memoryCalls = [];
  const req = request({ scope: { projectScope: 'sg-2.1', groupScope: 'group-7', threadScope: null } });
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({
      scope: { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: 'group-7', threadScope: null },
      sourceHints: ['user-memory', 'group-memory', 'thread-memory']
    })),
    memory2: { async recall(input) { memoryCalls.push(input); return { records: [], conflicts: [], diagnostics: {} }; } }
  });

  const result = await orchestrator.search({ request: req, query: 'Что было в группе?' });
  assert.equal(result.status, 'partial');
  assert.equal(memoryCalls.length, 1);
  assert.deepEqual(memoryCalls[0].scope, { userScope: 'user-1', globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: 'group-7', threadScope: null });
  assert.deepEqual(memoryCalls[0].layers, ['user-memory', 'user-group-memory', 'group-memory']);
  const omitted = result.sources.find((source) => source.source === 'thread-memory');
  assert.equal(omitted.status, 'omitted');
  assert.equal(omitted.omission.reason, 'thread-scope-required');
});

test('HS3 project development combines Conversation History + PM3 + PDK4 without changing scope', async () => {
  const calls = [];
  const projectPlan = plan({
    semanticSubject: 'память СГ',
    operation: 'timeline',
    sourceHints: ['conversation-history', 'project-memory', 'pdk4'],
    outputMode: 'timeline'
  });
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(projectPlan),
    conversationHistoryStore: {},
    conversationHistoryRetrieve: async () => ({ summary: 'История обсуждения', turns: [], retrieval: {} }),
    projectMemoryRetrieval: { async search(input) { calls.push(['pm3', input]); return { projectKey: 'sg-2.1', count: 1, semanticMode: 'none', results: [{ score: 0.8, record: { memoryId: 'pm1', projectKey: 'sg-2.1', factType: 'architecture-decision', entityKey: 'memory', fact: { status: 'active' }, validFrom: '2026-06-01T00:00:00.000Z', validTo: null, trust: 'verified', confirmed: true, confidence: 1, lifecycleState: 'active', source: { kind: 'github' } } }] }; } },
    pdk4: { async contextForRequest(input) { calls.push(['pdk4', input]); return { mode: 'evolution', qualification: { includeHistorical: true }, projectMemoryContext: { facts: [{ memoryId: 'pdk1', factType: 'project-event', entityKey: 'hs', factData: { status: 'implemented' }, validFrom: '2026-08-01T00:00:00.000Z', validTo: null, trust: 'verified', confirmed: false, confidence: 0.9, lifecycleState: 'active', provenance: { kind: 'github' }, retrieval: { score: 0.9 } }] } }; } }
  });

  const result = await orchestrator.search({ request: request(), query: 'Как развивалась память СГ?' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.selection.canonicalSources, ['conversation-history', 'project-memory', 'pdk4']);
  assert.equal(calls[0][1].projectKey, 'sg-2.1');
  assert.equal(calls[1][1].projectKey, 'sg-2.1');
  assert.equal(calls[1][1].semanticIntent, 'project_development_evolution');
});

test('HS3 rejects planner scope broadening before querying any source', async () => {
  let called = false;
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ scope: { globalUserId: 'other-user', projectScope: 'other-project', groupScope: null, threadScope: null } })),
    memory2: { async recall() { called = true; return { records: [] }; } }
  });

  await assert.rejects(
    orchestrator.search({ request: request(), query: 'Найди историю' }),
    (error) => error.code === 'historical-orchestrator-plan-scope-mismatch'
  );
  assert.equal(called, false);
});

test('HS3 preserves source failures and continues mixed-source search', async () => {
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ sourceHints: ['conversation-history', 'user-memory', 'project-memory'] })),
    conversationHistoryStore: {},
    conversationHistoryRetrieve: async () => { const error = new Error('history unavailable'); error.code = 'history-down'; throw error; },
    memory2: { async recall() { return { records: [memoryRecord()], conflicts: [], diagnostics: {} }; } },
    projectMemoryRetrieval: { async search() { return { projectKey: 'sg-2.1', count: 0, results: [] }; } }
  });

  const result = await orchestrator.search({ request: request(), query: 'Найди историю' });
  assert.equal(result.status, 'partial');
  const failed = result.sources.find((source) => source.source === 'conversation-history');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error.code, 'history-down');
  assert.equal(result.sources.find((source) => source.source === 'memory2').status, 'ok');
  assert.equal(result.sources.find((source) => source.source === 'project-memory').status, 'empty');
  assert.equal(result.contract.sourceFailuresExplicit, true);
});

test('HS3 applies requested temporal range to normalized Memory 2.0 results', async () => {
  const temporalRange = { utcStart: '2026-08-01T00:00:00.000Z', utcEndExclusive: '2026-09-01T00:00:00.000Z' };
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ temporalRange, sourceHints: ['user-memory'] })),
    memory2: { async recall() { return { records: [
      memoryRecord({ id: 'old', provenance: { sourceType: 'conversation', sourceId: 'old', sourceTimestamp: '2026-07-01T00:00:00.000Z' } }),
      memoryRecord({ id: 'in', provenance: { sourceType: 'conversation', sourceId: 'in', sourceTimestamp: '2026-08-10T00:00:00.000Z' } })
    ], conflicts: [], diagnostics: {} }; } }
  });

  const result = await orchestrator.search({ request: request(), query: 'Что было в августе?' });
  assert.deepEqual(result.sources[0].items.map((item) => item.sourceId), ['in']);
});

test('HS3 uses canonical incident seam and keeps incident result advisory-only', async () => {
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: plannerReturning(plan({ semanticSubject: 'ошибка памяти', sourceHints: ['incident-memory'] })),
    decisionIncidentMemory: { async findIncidentGuidance() { return { advisoryOnly: true, provesLiveRootCause: false, requiresLiveVerification: true, incidents: [{ memoryId: 'i1', entityKey: 'memory-error', symptom: 'memory failed', occurredAt: '2026-08-01T00:00:00.000Z', trust: 'verified', confirmed: true, lifecycleState: 'archived', provenance: { kind: 'github' }, retrieval: { score: 0.8 } }] }; } }
  });

  const result = await orchestrator.search({ request: request(), query: 'Были похожие инциденты?' });
  assert.equal(result.status, 'completed');
  assert.equal(result.sources[0].diagnostics.advisoryOnly, true);
  assert.equal(result.sources[0].items[0].metadata.provesLiveRootCause, false);
});
