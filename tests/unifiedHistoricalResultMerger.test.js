import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHistoricalSearchResults } from '../src/history/unifiedHistoricalResultMerger.js';
import { createUnifiedHistoricalSearchOrchestrator } from '../src/history/unifiedHistoricalSearchOrchestrator.js';

function plan(overrides = {}) {
  return {
    status: 'planned',
    query: 'Что было про машину?',
    operation: 'search',
    semanticSubject: 'Freelander',
    temporalRange: null,
    scope: { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    sourceHints: ['user-memory'],
    entityConstraints: ['car'],
    outputMode: 'answer',
    confidence: 0.95,
    ...overrides
  };
}
function source(sourceName, items) {
  return { source: sourceName, status: items.length ? 'ok' : 'empty', items, diagnostics: {} };
}
function item(overrides = {}) {
  return {
    source: 'memory2', kind: 'user-memory', sourceId: 'm1',
    timestamp: '2026-08-01T00:00:00.000Z', validFrom: '2026-08-01T00:00:00.000Z', validTo: null,
    entityKey: 'car', text: 'Freelander 2', value: 'Freelander 2', relevance: 0.8,
    trust: 'confirmed', confirmed: true, confidence: 0.9, lifecycle: 'active',
    provenance: { sourceType: 'conversation', sourceId: 'c1' }, metadata: { layer: 'user-memory' },
    ...overrides
  };
}
function request() {
  return {
    actor: { globalUserId: 'user-1', roles: ['citizen'] },
    scope: { projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-hs4' }
  };
}

test('HS4 deduplicates Conversation History and durable memory through shared provenance while retaining both references', () => {
  const result = mergeHistoricalSearchResults({ plan: plan(), sources: [
    source('conversation-history', [{
      source: 'conversation-history', kind: 'conversation-turn', sourceId: 'c1',
      timestamp: '2026-08-01T00:00:00.000Z', entityKey: null, text: 'Freelander 2',
      value: { direction: 'in' }, relevance: null, trust: null, confirmed: null, confidence: null,
      lifecycle: null, provenance: { conversationId: 'conv-1' }, metadata: {}
    }]),
    source('memory2', [item()])
  ] });

  assert.equal(result.items.length, 1);
  assert.equal(result.diagnostics.duplicateSuppressedCount, 1);
  assert.equal(result.items[0].duplicateEvidence.length, 1);
  assert.deepEqual(new Set([result.items[0].source, result.items[0].duplicateEvidence[0].source]), new Set(['memory2', 'conversation-history']));
  assert.equal(result.contract.sourceReferencesRetained, true);
});

test('HS4 preserves contradictory current facts as an unresolved conflict instead of inventing a winner', () => {
  const result = mergeHistoricalSearchResults({ plan: plan(), sources: [source('memory2', [
    item({ sourceId: 'm1', value: 'Freelander 2', text: 'Freelander 2' }),
    item({ sourceId: 'm2', value: 'Passat B5', text: 'Passat B5', provenance: { sourceType: 'conversation', sourceId: 'c2' } })
  ])] });

  assert.equal(result.items.length, 2);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].status, 'unresolved');
  assert.equal(result.conflicts[0].values.length, 2);
  assert.equal(result.diagnostics.unresolvedConflictCount, 1);
});

test('HS4 keeps superseded evidence in historical mode and exposes the real supersession chain', () => {
  const historicalPlan = plan({ temporalRange: { utcStart: '2025-01-01T00:00:00.000Z', utcEndExclusive: '2027-01-01T00:00:00.000Z' } });
  const result = mergeHistoricalSearchResults({ plan: historicalPlan, sources: [source('memory2', [
    item({
      sourceId: 'm-old', value: 'old', text: 'old', lifecycle: 'superseded',
      validFrom: '2025-01-01T00:00:00.000Z', validTo: '2026-01-01T00:00:00.000Z',
      metadata: { layer: 'user-memory', supersededBy: 'm-new' },
      provenance: { sourceType: 'conversation', sourceId: 'old-msg' }
    }),
    item({
      sourceId: 'm-new', value: 'new', text: 'new', timestamp: '2026-01-01T00:00:00.000Z',
      validFrom: '2026-01-01T00:00:00.000Z',
      provenance: { sourceType: 'conversation', sourceId: 'new-msg' }
    })
  ])] });

  assert.equal(result.items.length, 2);
  assert.equal(result.supersessionChains.length, 1);
  assert.equal(result.supersessionChains[0].from.sourceId, 'm-old');
  assert.equal(result.supersessionChains[0].to.sourceId, 'm-new');
  assert.equal(result.supersessionChains[0].complete, true);
  assert.equal(result.conflicts[0].status, 'superseded-history');
});

test('HS4 current-state ranking prefers an active supported value over a superseded value', () => {
  const result = mergeHistoricalSearchResults({ plan: plan(), sources: [source('memory2', [
    item({
      sourceId: 'old', relevance: 0.95, lifecycle: 'superseded', value: 'old', text: 'old',
      metadata: { layer: 'user-memory', supersededBy: 'new' },
      provenance: { sourceType: 'conversation', sourceId: 'old-msg' }
    }),
    item({
      sourceId: 'new', relevance: 0.7, lifecycle: 'active', value: 'new', text: 'new',
      provenance: { sourceType: 'conversation', sourceId: 'new-msg' }
    })
  ])] });

  assert.equal(result.items[0].sourceId, 'new');
  assert.equal(result.items[0].lifecycle, 'active');
});

test('HS4 does not deduplicate identical text that belongs to different explicit entities', () => {
  const result = mergeHistoricalSearchResults({ plan: plan(), sources: [source('memory2', [
    item({ sourceId: 'a', entityKey: 'car-a', text: 'active', value: { state: 'active' }, provenance: { sourceType: 'conversation', sourceId: 'a-msg' } }),
    item({ sourceId: 'b', entityKey: 'car-b', text: 'active', value: { state: 'active' }, provenance: { sourceType: 'conversation', sourceId: 'b-msg' } })
  ])] });

  assert.equal(result.items.length, 2);
  assert.equal(result.diagnostics.duplicateSuppressedCount, 0);
});

test('HS4 integration keeps explicit source failure partial while merging available authorized evidence', async () => {
  const orchestrator = createUnifiedHistoricalSearchOrchestrator({
    planner: async () => plan({ sourceHints: ['conversation-history', 'user-memory'] }),
    conversationHistoryStore: {},
    conversationHistoryRetrieve: async () => { const error = new Error('history down'); error.code = 'history-down'; throw error; },
    memory2: {
      async recall() {
        return {
          records: [{
            id: 'm1', layer: 'user-memory', key: 'car', value: 'Freelander 2', recallScore: 4.2,
            trust: 'confirmed', confirmed: true, confidence: 0.9, lifecycleState: 'active',
            createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
            provenance: { sourceType: 'conversation', sourceId: 'c1', sourceTimestamp: '2026-08-01T00:00:00.000Z' },
            privacyClass: 'private', tags: [], supersededBy: null
          }],
          conflicts: [], diagnostics: {}
        };
      }
    }
  });

  const result = await orchestrator.search({ request: request(), query: 'Что было про машину?' });
  assert.equal(result.status, 'partial');
  assert.equal(result.sources.find((entry) => entry.source === 'conversation-history').status, 'failed');
  assert.equal(result.merged.status, 'merged');
  assert.equal(result.merged.items.length, 1);
  assert.equal(result.merged.items[0].sourceId, 'm1');
  assert.equal(result.contract.stage, 'HS4');
  assert.equal(result.contract.sourceOrchestrationStage, 'HS3');
  assert.equal(result.contract.crossSourceRanking, true);
  assert.equal(result.contract.authorizationExpanded, false);
});
