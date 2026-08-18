import test from 'node:test';
import assert from 'node:assert/strict';
import { planHistoricalQuery } from '../src/history/historicalQueryPlanner.js';
import { createTemporalService } from '../src/temporal/temporalService.js';

function request() {
  return {
    actor: { globalUserId: 'user-1', roles: ['citizen'] },
    scope: { projectScope: 'sg-2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-hs1' },
    temporalContext: { referenceInstant: '2026-08-18T16:00:00.000Z' }
  };
}

function aiValue(overrides = {}) {
  return {
    supported: true,
    operation: 'search',
    semanticSubject: 'машина',
    temporalExpression: null,
    temporalStartExpression: null,
    temporalEndExpression: null,
    sourceHints: ['conversation-history'],
    entityConstraints: [],
    outputMode: 'answer',
    ambiguous: false,
    ambiguityReason: null,
    confidence: 0.94,
    ...overrides
  };
}

function routerReturning(value, calls = []) {
  return {
    async route(input) {
      calls.push(input);
      return { text: JSON.stringify(value) };
    }
  };
}

async function realTemporalService() {
  const service = createTemporalService({ clock: () => new Date('2026-08-18T16:00:00.000Z') });
  await service.setUserTimezone('user-1', 'Europe/Kiev');
  return service;
}

test('HS1 plans semantic historical search and delegates relative time to Temporal Service', async () => {
  const aiCalls = [];
  const temporalService = await realTemporalService();
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      operation: 'search', semanticSubject: 'машина', temporalExpression: '1 month ago',
      sourceHints: ['conversation-history', 'user-memory', 'not-a-source'], entityConstraints: ['машина']
    }), aiCalls),
    temporalService,
    request: request(),
    query: 'Что мы обсуждали месяц назад про машину?'
  });

  assert.equal(plan.status, 'planned');
  assert.equal(plan.operation, 'search');
  assert.equal(plan.semanticSubject, 'машина');
  assert.deepEqual(plan.sourceHints, ['conversation-history', 'user-memory']);
  assert.equal(plan.temporalRange.status, 'resolved');
  assert.equal(plan.temporalRange.source, 'deterministic-temporal-parser');
  assert.deepEqual(plan.scope, { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: null, threadScope: null });
  assert.equal(plan.planner.phraseTableRouting, false);
  assert.equal(plan.planner.temporalResolver, 'temporal-service');
  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0].task, 'historical-query-plan');
  assert.equal(aiCalls[0].identityContext.globalUserId, 'user-1');
  assert.equal(aiCalls[0].metadata.context.stage, 'HS1');
});

test('HS1 supports first-occurrence without requiring internal IDs or a time range', async () => {
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      operation: 'first-occurrence', semanticSubject: 'Haldex', entityConstraints: ['Haldex']
    })),
    temporalService: await realTemporalService(),
    request: request(),
    query: 'Когда я впервые говорил про Haldex?'
  });

  assert.equal(plan.status, 'planned');
  assert.equal(plan.operation, 'first-occurrence');
  assert.equal(plan.semanticSubject, 'Haldex');
  assert.equal(plan.temporalRange, null);
  assert.equal('memoryId' in plan, false);
});

test('HS1 resolves a one-year timeline as a Temporal Service interval', async () => {
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      operation: 'timeline', semanticSubject: 'решение по памяти СГ',
      temporalStartExpression: '12 months ago', temporalEndExpression: 'now',
      sourceHints: ['conversation-history', 'project-memory', 'pdk4'],
      entityConstraints: ['память СГ'], outputMode: 'timeline'
    })),
    temporalService: await realTemporalService(),
    request: request(),
    query: 'Покажи как менялось решение по памяти СГ за год'
  });

  assert.equal(plan.status, 'planned');
  assert.equal(plan.operation, 'timeline');
  assert.equal(plan.temporalRange.kind, 'range');
  assert.equal(plan.temporalRange.source, 'temporal-service');
  assert.ok(Date.parse(plan.temporalRange.utcStart) < Date.parse(plan.temporalRange.utcEndExclusive));
});

test('HS1 fails closed on ambiguous historical interpretation', async () => {
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      ambiguous: true, ambiguityReason: 'неясно, о какой машине речь', confidence: 0.8
    })),
    temporalService: await realTemporalService(),
    request: request(),
    query: 'Найди старое про машину'
  });

  assert.equal(plan.status, 'clarification-required');
  assert.match(plan.clarification, /Уточните/);
  assert.match(plan.ambiguityReason, /машине/);
});

test('HS1 fails closed when request is not a supported historical-memory request', async () => {
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      supported: false, semanticSubject: '', ambiguityReason: 'это не исторический поиск', confidence: 0.98
    })),
    temporalService: await realTemporalService(),
    request: request(),
    query: 'Включи музыку'
  });

  assert.equal(plan.status, 'clarification-required');
  assert.match(plan.ambiguityReason, /не исторический поиск/);
});

test('HS1 keeps identity and authorization scope exclusively from resolved request', async () => {
  const aiCalls = [];
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({
      operation: 'fact-history', semanticSubject: 'память СГ', sourceHints: ['project-memory'], outputMode: 'facts'
    }), aiCalls),
    temporalService: await realTemporalService(),
    request: request(),
    query: 'Как менялся факт о памяти СГ?'
  });

  assert.deepEqual(plan.scope, { globalUserId: 'user-1', projectScope: 'sg-2.1', groupScope: null, threadScope: null });
  assert.equal(aiCalls[0].identityContext.globalUserId, 'user-1');
  assert.equal(plan.planner.authorizationScopeFromRequestOnly, true);
});

test('HS1 fails closed when Temporal Service cannot resolve the requested period', async () => {
  const plan = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({ temporalExpression: 'когда-то прошлым летом' })),
    temporalService: { async resolveForUser() { return { status: 'unresolved', reason: 'no-supported-temporal-expression' }; } },
    request: request(),
    query: 'Что было когда-то прошлым летом про машину?'
  });

  assert.equal(plan.status, 'clarification-required');
  assert.match(plan.clarification, /период/);
});

test('HS1 rejects incomplete temporal intervals and low-confidence plans', async () => {
  const temporalService = await realTemporalService();
  const incomplete = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({ temporalStartExpression: '12 months ago' })),
    temporalService,
    request: request(),
    query: 'Покажи историю за период'
  });
  assert.equal(incomplete.status, 'clarification-required');
  assert.match(incomplete.ambiguityReason, /неполный/);

  const lowConfidence = await planHistoricalQuery({
    aiRouter: routerReturning(aiValue({ confidence: 0.2 })),
    temporalService,
    request: request(),
    query: 'Найди что-то старое'
  });
  assert.equal(lowConfidence.status, 'clarification-required');
  assert.match(lowConfidence.ambiguityReason, /уверенности/);
});
