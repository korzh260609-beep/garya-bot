import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalOperationResult } from '../src/history/historicalOperationResult.js';
import { createUnifiedHistoricalSearchOrchestrator } from '../src/history/unifiedHistoricalSearchOrchestrator.js';

function plan(operation, overrides = {}) {
  return {
    status: 'planned', query: 'history', operation, semanticSubject: 'memory', temporalRange: null,
    scope: { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    sourceHints: ['user-memory'], entityConstraints: [], outputMode: operation === 'timeline' ? 'timeline' : 'answer', confidence: 0.99,
    ...overrides
  };
}
function evidence(overrides = {}) {
  return {
    rank: 1, score: 0.8, scoreComponents: {}, source: 'memory2', sourceId: 'm1', kind: 'user-memory',
    timestamp: '2026-01-01T00:00:00.000Z', validFrom: '2026-01-01T00:00:00.000Z', validTo: null,
    entityKey: 'memory.mode', text: 'first', value: 'first', trust: 'reported', confirmed: false,
    confidence: 0.7, lifecycle: 'active', verificationState: 'reported', provenance: { sourceId: 'msg-1' },
    metadata: { confirmationState: 'reported' }, duplicateEvidence: [], supersession: null,
    ...overrides
  };
}
function merged(items, overrides = {}) {
  return { status: items.length ? 'merged' : 'empty', items, conflicts: [], supersessionChains: [], diagnostics: {}, contract: {}, ...overrides };
}

test('HS5 first-occurrence and last-occurrence use actual evidence chronology, not HS4 rank order', () => {
  const items = [
    evidence({ sourceId: 'late', rank: 1, timestamp: '2026-08-10T10:00:00.000Z', validFrom: '2026-08-10T10:00:00.000Z', text: 'late' }),
    evidence({ sourceId: 'early', rank: 2, timestamp: '2025-02-01T09:00:00.000Z', validFrom: '2025-02-01T09:00:00.000Z', text: 'early' })
  ];
  const first = buildHistoricalOperationResult({ plan: plan('first-occurrence'), merged: merged(items) });
  const last = buildHistoricalOperationResult({ plan: plan('last-occurrence'), merged: merged(items) });

  assert.equal(first.result.occurrence.date, '2025-02-01T09:00:00.000Z');
  assert.equal(first.result.occurrence.summary, 'early');
  assert.equal(last.result.occurrence.date, '2026-08-10T10:00:00.000Z');
  assert.equal(last.result.occurrence.summary, 'late');
  assert.equal(first.contract.aiUsed, false);
  assert.equal(first.contract.authorizationExpanded, false);
});

test('HS5 timeline is chronological, groups represented months only, and never fabricates empty periods', () => {
  const result = buildHistoricalOperationResult({
    plan: plan('timeline'),
    merged: merged([
      evidence({ sourceId: 'mar', timestamp: '2026-03-20T00:00:00.000Z', validFrom: '2026-03-20T00:00:00.000Z', text: 'March' }),
      evidence({ sourceId: 'jan', timestamp: '2026-01-05T00:00:00.000Z', validFrom: '2026-01-05T00:00:00.000Z', text: 'January' }),
      evidence({ sourceId: 'jul', timestamp: '2026-07-01T00:00:00.000Z', validFrom: '2026-07-01T00:00:00.000Z', text: 'July' })
    ])
  });

  assert.equal(result.result.grouping, 'month');
  assert.deepEqual(result.result.events.map((entry) => entry.event.summary), ['January', 'March', 'July']);
  assert.deepEqual(result.result.groups.map((entry) => entry.period), ['2026-01', '2026-03', '2026-07']);
  assert.equal(result.result.emptyPeriodsFabricated, false);
  assert.equal(result.result.groups.some((entry) => entry.period === '2026-02'), false);
});

test('HS5 fact-history exposes confirmation, lifecycle, provenance and supersession without mixing another entity', () => {
  const oldFact = evidence({
    sourceId: 'old', entityKey: 'memory.mode', timestamp: '2025-01-01T00:00:00.000Z', validFrom: '2025-01-01T00:00:00.000Z',
    validTo: '2026-01-01T00:00:00.000Z', text: 'lexical', value: 'lexical', trust: 'confirmed', confirmed: true,
    confidence: 0.9, lifecycle: 'superseded', verificationState: 'confirmed', metadata: { confirmationState: 'confirmed' },
    supersession: { successorSourceId: 'new', state: 'superseded-by' }, provenance: { sourceType: 'decision', sourceId: 'd-old' }
  });
  const newFact = evidence({
    sourceId: 'new', entityKey: 'memory.mode', timestamp: '2026-01-01T00:00:00.000Z', validFrom: '2026-01-01T00:00:00.000Z',
    text: 'hybrid', value: 'hybrid', trust: 'verified', confirmed: true, confidence: 0.98, lifecycle: 'active',
    verificationState: 'verified', metadata: { confirmationState: 'confirmed' }, provenance: { sourceType: 'decision', sourceId: 'd-new' }
  });
  const unrelated = evidence({
    sourceId: 'other', entityKey: 'automation.mode', timestamp: '2025-06-01T00:00:00.000Z', validFrom: '2025-06-01T00:00:00.000Z',
    text: 'unrelated', value: 'unrelated'
  });
  const result = buildHistoricalOperationResult({
    plan: plan('fact-history'),
    merged: merged([newFact, unrelated, oldFact], {
      supersessionChains: [{
        from: { source: 'memory2', sourceId: 'old', timestamp: oldFact.timestamp, provenance: oldFact.provenance },
        to: { source: 'memory2', sourceId: 'new', timestamp: newFact.timestamp, provenance: newFact.provenance }, complete: true
      }]
    })
  });

  assert.equal(result.result.subject, 'memory.mode');
  assert.equal(result.result.states.length, 2);
  assert.deepEqual(result.result.states.map((state) => state.value), ['lexical', 'hybrid']);
  assert.equal(result.result.firstConfirmedFact.summary, 'lexical');
  assert.equal(result.result.latestSupportedUpdate.summary, 'hybrid');
  assert.equal(result.result.currentState.summary, 'hybrid');
  assert.equal(result.result.supersessionChains.length, 1);
  assert.equal(result.result.states.some((state) => state.value === 'unrelated'), false);
  assert.equal(result.result.states[0].trust, 'confirmed');
  assert.deepEqual(result.result.states[0].provenance, { sourceType: 'decision', sourceId: 'd-old' });
});

test('HS5 human-facing occurrence view omits internal ids and scores while internal evidence stays traceable', () => {
  const result = buildHistoricalOperationResult({ plan: plan('first-occurrence'), merged: merged([evidence({ sourceId: 'secret-id', score: 0.999 })]) });
  assert.deepEqual(Object.keys(result.result.occurrence).sort(), ['date', 'source', 'subject', 'summary']);
  assert.equal('sourceId' in result.result.occurrence, false);
  assert.equal('score' in result.result.occurrence, false);
  assert.equal(result.result.evidence[0].sourceId, 'secret-id');
  assert.equal(result.contract.internalIdsExposedByDefault, false);
  assert.equal(result.contract.internalEvidenceRetained, true);
});

test('HS5 orchestrator integration adds operationResult after HS4 without changing authorization scope', async () => {
  const hsPlan = plan('last-occurrence');
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: async () => hsPlan,
    memory2: {
      async recall() {
        return {
          records: [
            { id: 'm-old', layer: 'user-memory', key: 'memory.mode', value: 'old', recallScore: 0.8, trust: 'confirmed', confirmed: true, confidence: 0.9, lifecycleState: 'superseded', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', supersededAt: '2026-01-01T00:00:00.000Z', supersededBy: 'm-new', provenance: { sourceTimestamp: '2025-01-01T00:00:00.000Z', sourceId: 'msg-old' } },
            { id: 'm-new', layer: 'user-memory', key: 'memory.mode', value: 'new', recallScore: 0.8, trust: 'verified', confirmed: true, confidence: 0.99, lifecycleState: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', supersededBy: null, provenance: { sourceTimestamp: '2026-01-01T00:00:00.000Z', sourceId: 'msg-new' } }
          ], conflicts: [], diagnostics: {}
        };
      }
    }
  });
  const request = { actor: { globalUserId: 'user-1', roles: ['citizen'] }, scope: { projectScope: 'sg-2.1', groupScope: null, threadScope: null }, traceContext: { traceId: 'hs5' } };
  const result = await orchestrator.search({ request, query: 'Когда последний раз менялся режим памяти?' });

  assert.equal(result.operationResult.operation, 'last-occurrence');
  assert.equal(result.operationResult.result.occurrence.summary, 'new');
  assert.equal(result.contract.stage, 'HS5');
  assert.equal(result.contract.sourceOrchestrationStage, 'HS3');
  assert.equal(result.contract.mergeStage, 'HS4');
  assert.equal(result.contract.historicalOperationStage, 'HS5');
  assert.equal(result.contract.authorizationExpanded, false);
});
