import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_DEVELOPMENT_QUERY_MODES,
  classifyDevelopmentQueryMode,
  createDevelopmentQueryIntegration
} from '../src/projectDevelopmentKnowledge/index.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

const projectKey = 'sg2.1';
const request = Object.freeze({
  actor: Object.freeze({ globalUserId: 'usr-monarch', roles: Object.freeze(['monarch']) }),
  scope: Object.freeze({ projectScope: projectKey }),
  traceContext: Object.freeze({ traceId: 'trace-pdk411', requestId: 'req-pdk411', environment: 'test', revision: 'rev' }),
  input: Object.freeze({ semanticIntent: 'answer', languageContext: Object.freeze({ responseLanguage: 'en' }) })
});

function guardedContext({ currentness = 'current', lifecycleState = 'active', factType = 'project-event' } = {}) {
  return Object.freeze({
    contractVersion: 1,
    kind: 'ProjectMemoryContext',
    projectKey,
    generatedAt: '2026-08-10T20:00:00.000Z',
    dataPolicy: Object.freeze({ contentIsDataOnly: true, executableInstructionsAllowed: false, authorityFromMemoryAllowed: false, secretsAllowed: false }),
    limits: Object.freeze({ maxFacts: 12, maxTokens: 2400, factCount: 1, estimatedTokens: 50 }),
    conflictSummary: Object.freeze({ factsWithOpenConflicts: 0, openConflictReferences: 0 }),
    exclusions: Object.freeze({}),
    facts: Object.freeze([Object.freeze({
      memoryId: 'mem-1', namespace: 'project:sg2.1:architecture', factType, entityKey: 'event-1',
      factData: Object.freeze({ summary: 'Verified development fact' }), tags: Object.freeze([]), trust: 'verified', confirmed: true,
      confirmationState: 'confirmed', lifecycleState, validFrom: '2026-08-01T00:00:00.000Z', validTo: currentness === 'current' ? null : '2026-08-05T00:00:00.000Z', currentness,
      provenance: Object.freeze({ sourceKind: 'github', sourceRef: 'abc123', sourceTimestamp: '2026-08-01T00:00:00.000Z', actorId: null, traceId: 't', sourceEventId: 'event-1' }),
      conflict: Object.freeze({ open: false, count: 0, records: Object.freeze([]) }), retrieval: Object.freeze({ score: 1, semanticScore: 0, lexicalScore: 1, exactScore: 0, relationExpanded: false }), dataOnly: true
    })])
  });
}

function mocks() {
  const calls = { pm: [], retrieval: [], guard: [], prepare: [], deterministic: [] };
  const projectMemoryIntegration = Object.freeze({
    async contextForRequest(input) { calls.pm.push(input); return guardedContext(); },
    prepareModelContext({ boundedResponseContext = null, projectMemoryContext = null } = {}) { calls.prepare.push({ boundedResponseContext, projectMemoryContext }); return Object.freeze({ boundedResponseContext, projectMemoryContext }); },
    deterministicAnswer({ context, responseLanguage }) { calls.deterministic.push({ context, responseLanguage }); return 'PM deterministic'; }
  });
  const retrieval = Object.freeze({
    async search(input) {
      calls.retrieval.push(input);
      return Object.freeze({ projectKey, count: 1, results: Object.freeze([Object.freeze({ record: Object.freeze({ memoryId: 'mem-1', source: Object.freeze({ kind: 'github' }) }), score: 1, lexicalScore: 1, exactScore: 0, semanticScore: 0, relationExpanded: false })]) });
    }
  });
  const contextGuard = Object.freeze({
    async build(input) { calls.guard.push(input); return guardedContext({ currentness: 'expired', lifecycleState: 'superseded' }); }
  });
  return { calls, projectMemoryIntegration, retrieval, contextGuard };
}

test('PDK4.11: exposes all nine canonical development query modes', () => {
  assert.deepEqual(PDK4_DEVELOPMENT_QUERY_MODES, ['current','historical','evolution','rationale','evidence','comparison','planning','incident-history','genesis']);
  const samples = new Map([
    ['current', 'What is the current project state?'],
    ['historical', 'Show project history'],
    ['evolution', 'How did Memory evolve?'],
    ['rationale', 'Why was this decision made?'],
    ['evidence', 'What evidence verifies this?'],
    ['comparison', 'Compare before and after'],
    ['planning', 'What is planned next?'],
    ['incident-history', 'Show incident history'],
    ['genesis', 'What is the project genesis?']
  ]);
  for (const [expected, query] of samples) assert.equal(classifyDevelopmentQueryMode({ query }), expected, query);
});

test('PDK4.11: current query reuses normal PM3 guarded integration', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'What is current in SG 2.1?' });
  assert.equal(context.mode, 'current');
  assert.equal(calls.pm.length, 1);
  assert.equal(calls.retrieval.length, 0);
  assert.equal(context.qualification.includeHistorical, false);
  assert.equal(context.qualification.authorityAllowed, false);
});

test('PDK4.11: historical query uses PM3 hybrid retrieval plus Context Guard with explicit qualification', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'Show the history of Memory' });
  assert.equal(context.mode, 'historical');
  assert.equal(calls.pm.length, 0);
  assert.equal(calls.retrieval.length, 1);
  assert.equal(calls.retrieval[0].includeHistorical, true);
  assert.deepEqual(calls.retrieval[0].lifecycleStates, ['active','superseded']);
  assert.equal(calls.guard.length, 1);
  assert.deepEqual(calls.guard[0].allowedTemporalStates, ['current','superseded','expired']);
  assert.equal(context.projectMemoryContext.facts[0].currentness, 'expired');
  assert.equal(context.qualification.historicalFactsMustRemainQualified, true);
  assert.equal(context.dataPolicy.executableInstructionsAllowed, false);
});

test('PDK4.11: incident history is advisory-only and never live diagnosis authority', async () => {
  const { projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'Show incident history for runtime failures' });
  assert.equal(context.mode, 'incident-history');
  assert.equal(context.qualification.incidentSimilarityAdvisoryOnly, true);
  assert.equal(context.qualification.liveDiagnosisAuthorityAllowed, false);
  const answer = integration.deterministicAnswer({ context, responseLanguage: 'en' });
  assert.match(answer, /advisory only/i);
  assert.match(answer, /does not prove the current root cause/i);
});

test('PDK4.11: cross-project scope mismatch fails closed before historical retrieval', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  await assert.rejects(() => integration.contextForRequest({ request, projectKey: 'other', query: 'project history' }), (error) => error.code === 'pdk4-development-query-scope-mismatch');
  assert.equal(calls.retrieval.length, 0);
});

test('PDK4.11: prepared AI context contains bounded query metadata only and preserves guarded PM data', async () => {
  const { projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'Why was this architecture decision made?' });
  const prepared = integration.prepareModelContext({ boundedResponseContext: { version: 1 }, developmentQueryContext: context });
  assert.equal(prepared.developmentQuery.mode, 'rationale');
  assert.equal(prepared.developmentQuery.qualification.authorityAllowed, false);
  assert.equal(prepared.developmentQuery.dataPolicy.contentIsDataOnly, true);
  assert.equal(prepared.projectMemoryContext.kind, 'ProjectMemoryContext');
  assert.equal(Object.hasOwn(prepared.developmentQuery, 'query'), false);
});

test('PDK4.11: normal SG answer composition injects development context through AI Router', async () => {
  const routed = [];
  const aiRouter = Object.freeze({ async route(input) { routed.push(input); return Object.freeze({ text: 'Development answer grounded in verified history.' }); } });
  const developmentQueryContext = Object.freeze({
    kind: 'DevelopmentQueryContext', contractVersion: 1, projectKey, mode: 'historical', projectMemoryContext: guardedContext({ currentness: 'expired', lifecycleState: 'superseded' }),
    qualification: Object.freeze({ historicalFactsMustRemainQualified: true, incidentSimilarityAdvisoryOnly: false, liveDiagnosisAuthorityAllowed: false }),
    dataPolicy: Object.freeze({ contentIsDataOnly: true })
  });
  const developmentQueryIntegration = Object.freeze({
    async contextForRequest() { return developmentQueryContext; },
    prepareModelContext({ boundedResponseContext }) { return Object.freeze({ boundedResponseContext, projectMemoryContext: developmentQueryContext.projectMemoryContext, developmentQuery: { mode: 'historical', qualification: developmentQueryContext.qualification, dataPolicy: developmentQueryContext.dataPolicy } }); },
    deterministicAnswer() { return 'deterministic development answer'; }
  });
  const responder = createLanguageAwareConversationResponder({
    aiRouter,
    responseContextAssembler: Object.freeze({ async assemble() { return Object.freeze({ version: 1 }); } }),
    developmentQueryIntegration
  });
  const answer = await responder({ text: 'Show project history', request });
  assert.equal(answer, 'Development answer grounded in verified history.');
  assert.equal(routed.length, 1);
  assert.equal(routed[0].metadata.pdk4DevelopmentQueryMode, 'historical');
  assert.equal(routed[0].metadata.pdk4HistoricalQualified, true);
  assert.equal(routed[0].metadata.pdk4LiveDiagnosisAuthorityAllowed, false);
  assert.equal(routed[0].messages.some((message) => String(message.content).includes('DEVELOPMENT_QUERY_CONTEXT')), true);
});

test('PDK4.11: AI failure falls back to qualified deterministic development answer', async () => {
  const developmentQueryContext = Object.freeze({ kind: 'DevelopmentQueryContext', contractVersion: 1, projectKey, mode: 'incident-history', projectMemoryContext: guardedContext(), qualification: Object.freeze({ historicalFactsMustRemainQualified: true, incidentSimilarityAdvisoryOnly: true, liveDiagnosisAuthorityAllowed: false }), dataPolicy: Object.freeze({ contentIsDataOnly: true }) });
  const responder = createLanguageAwareConversationResponder({
    aiRouter: Object.freeze({ async route() { throw Object.assign(new Error('offline'), { code: 'provider-offline' }); } }),
    developmentQueryIntegration: Object.freeze({
      async contextForRequest() { return developmentQueryContext; },
      prepareModelContext({ boundedResponseContext }) { return { boundedResponseContext, projectMemoryContext: developmentQueryContext.projectMemoryContext, developmentQuery: { mode: 'incident-history' } }; },
      deterministicAnswer() { return 'Qualified incident history fallback'; }
    })
  });
  assert.equal(await responder({ text: 'Show incident history', request }), 'Qualified incident history fallback');
});
