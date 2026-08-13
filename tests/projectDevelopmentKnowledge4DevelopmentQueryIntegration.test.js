import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_DEVELOPMENT_QUERY_MODES,
  classifyDevelopmentQueryMode,
  createDevelopmentQueryIntegration
} from '../src/projectDevelopmentKnowledge/index.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

const projectKey = 'sg2.1';
function requestWithIntent(semanticIntent) {
  return Object.freeze({
    actor: Object.freeze({ globalUserId: 'usr-monarch', roles: Object.freeze(['monarch']) }),
    scope: Object.freeze({ projectScope: projectKey }),
    traceContext: Object.freeze({ traceId: 'trace-pdk411', requestId: 'req-pdk411', environment: 'test', revision: 'rev' }),
    input: Object.freeze({ semanticIntent, languageContext: Object.freeze({ responseLanguage: 'en' }) })
  });
}
const request = requestWithIntent('project_development_current');

function guardedContext({ currentness = 'current', lifecycleState = 'active', factType = 'project-event', confirmed = true } = {}) {
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
      factData: Object.freeze({ summary: 'Verified development fact' }), tags: Object.freeze([]), trust: 'verified', confirmed,
      confirmationState: confirmed ? 'confirmed' : 'proposed', lifecycleState, validFrom: '2026-08-01T00:00:00.000Z', validTo: currentness === 'current' ? null : '2026-08-05T00:00:00.000Z', currentness,
      provenance: Object.freeze({ sourceKind: 'github', sourceRef: 'abc123', sourceTimestamp: '2026-08-01T00:00:00.000Z', actorId: null, traceId: 't', sourceEventId: 'event-1' }),
      conflict: Object.freeze({ open: false, count: 0, records: Object.freeze([]) }), retrieval: Object.freeze({ score: 1, semanticScore: 0, lexicalScore: 1, exactScore: 0, relationExpanded: false }), dataOnly: true
    })])
  });
}

function mocks({ projectContext = guardedContext(), retrievalResults = null, guardContext = null } = {}) {
  const calls = { pm: [], retrieval: [], guard: [], prepare: [], deterministic: [] };
  const projectMemoryIntegration = Object.freeze({
    async contextForRequest(input) { calls.pm.push(input); return projectContext; },
    prepareModelContext({ boundedResponseContext = null, projectMemoryContext = null } = {}) { calls.prepare.push({ boundedResponseContext, projectMemoryContext }); return Object.freeze({ boundedResponseContext, projectMemoryContext }); },
    deterministicAnswer({ context, responseLanguage }) { calls.deterministic.push({ context, responseLanguage }); return 'PM deterministic'; }
  });
  const defaultResult = Object.freeze({
    projectKey,
    count: 1,
    results: Object.freeze([Object.freeze({ record: Object.freeze({ memoryId: 'mem-1', source: Object.freeze({ kind: 'github' }) }), score: 1, lexicalScore: 1, exactScore: 0, semanticScore: 0, relationExpanded: false })])
  });
  const retrieval = Object.freeze({ async search(input) { calls.retrieval.push(input); return retrievalResults ?? defaultResult; } });
  const contextGuard = Object.freeze({ async build(input) { calls.guard.push(input); return guardContext ?? guardedContext({ currentness: 'expired', lifecycleState: 'superseded' }); } });
  return { calls, projectMemoryIntegration, retrieval, contextGuard };
}

test('PDK4.11: exposes all nine canonical development query modes through semantic intents only', () => {
  assert.deepEqual(PDK4_DEVELOPMENT_QUERY_MODES, ['current','historical','evolution','rationale','evidence','comparison','planning','incident-history','genesis']);
  const samples = new Map([
    ['project_development_current', 'current'],
    ['project_development_historical', 'historical'],
    ['project_development_evolution', 'evolution'],
    ['project_development_rationale', 'rationale'],
    ['project_development_evidence', 'evidence'],
    ['project_development_comparison', 'comparison'],
    ['project_development_planning', 'planning'],
    ['project_development_incident_history', 'incident-history'],
    ['project_development_genesis', 'genesis']
  ]);
  for (const [semanticIntent, expected] of samples) assert.equal(classifyDevelopmentQueryMode({ semanticIntent }), expected, semanticIntent);
  assert.equal(classifyDevelopmentQueryMode({ semanticIntent: 'answer' }), null);
  assert.equal(classifyDevelopmentQueryMode({ semanticIntent: 'user_identity' }), null);
});

test('PDK4.11 regression: unrelated semantic intent cannot activate Project Development Knowledge', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request: requestWithIntent('answer'), query: 'arbitrary user-domain statement' });
  assert.equal(context, null);
  assert.equal(calls.pm.length, 0);
  assert.equal(calls.retrieval.length, 0);
  assert.equal(calls.guard.length, 0);
});

test('PDK4.11: current semantic development query reuses normal PM3 guarded integration', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'current project question' });
  assert.equal(context.mode, 'current');
  assert.equal(calls.pm.length, 1);
  assert.equal(calls.retrieval.length, 0);
  assert.equal(context.qualification.includeHistorical, false);
  assert.equal(context.qualification.authorityAllowed, false);
});

test('PDK4.11: historical semantic development query uses PM3 retrieval plus Context Guard', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request: requestWithIntent('project_development_historical'), query: 'historical project question' });
  assert.equal(context.mode, 'historical');
  assert.equal(calls.pm.length, 0);
  assert.equal(calls.retrieval.length, 1);
  assert.equal(calls.retrieval[0].includeHistorical, true);
  assert.deepEqual(calls.retrieval[0].lifecycleStates, ['active','superseded']);
  assert.equal(calls.guard.length, 1);
  assert.deepEqual(calls.guard[0].allowedTemporalStates, ['current','superseded','expired']);
  assert.equal(context.projectMemoryContext.facts[0].currentness, 'expired');
  assert.equal(context.qualification.historicalFactsMustRemainQualified, true);
});

test('PDK4.11 regression: autonomous proposed facts require a genuinely relevant anchor before relation expansion', async () => {
  const autonomousRecord = Object.freeze({
    memoryId: 'auto-1', source: Object.freeze({ kind: 'github' }), trust: 'verified', confirmed: false, confirmationState: 'proposed',
    metadata: Object.freeze({ pdk4AutonomousIngestion: true, pdk4SourceVerified: true })
  });
  const retrievalResults = Object.freeze({
    projectKey,
    count: 1,
    results: Object.freeze([Object.freeze({ record: autonomousRecord, exactScore: 0, lexicalScore: 0, semanticScore: 0.1, relationExpanded: true })])
  });
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks({ projectContext: null, retrievalResults, guardContext: guardedContext({ confirmed: false }) });
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request, query: 'semantically unrelated content' });
  assert.equal(context, null);
  assert.equal(calls.pm.length, 1);
  assert.equal(calls.retrieval.length, 1);
  assert.equal(calls.guard.length, 0);
});

test('PDK4.11: incident history stays advisory-only and never live diagnosis authority', async () => {
  const { projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const context = await integration.contextForRequest({ request: requestWithIntent('project_development_incident_history'), query: 'incident history question' });
  assert.equal(context.mode, 'incident-history');
  assert.equal(context.qualification.incidentSimilarityAdvisoryOnly, true);
  assert.equal(context.qualification.liveDiagnosisAuthorityAllowed, false);
  const answer = integration.deterministicAnswer({ context, responseLanguage: 'en' });
  assert.match(answer, /advisory only/i);
});

test('PDK4.11: cross-project scope mismatch fails closed before historical retrieval', async () => {
  const { calls, projectMemoryIntegration, retrieval, contextGuard } = mocks();
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  await assert.rejects(() => integration.contextForRequest({ request: requestWithIntent('project_development_historical'), projectKey: 'other', query: 'history' }), (error) => error.code === 'pdk4-development-query-scope-mismatch');
  assert.equal(calls.retrieval.length, 0);
});

test('PDK4.11: normal SG answer composition injects development context only for semantic development intent', async () => {
  const routed = [];
  const aiRouter = Object.freeze({ async route(input) { routed.push(input); return Object.freeze({ text: 'Development answer grounded in verified history.' }); } });
  const developmentQueryContext = Object.freeze({
    kind: 'DevelopmentQueryContext', contractVersion: 1, projectKey, mode: 'historical', projectMemoryContext: guardedContext({ currentness: 'expired', lifecycleState: 'superseded' }),
    qualification: Object.freeze({ historicalFactsMustRemainQualified: true, incidentSimilarityAdvisoryOnly: false, liveDiagnosisAuthorityAllowed: false }),
    dataPolicy: Object.freeze({ contentIsDataOnly: true })
  });
  const developmentQueryIntegration = Object.freeze({
    async contextForRequest({ semanticIntent }) { return semanticIntent === 'project_development_historical' ? developmentQueryContext : null; },
    prepareModelContext({ boundedResponseContext, developmentQueryContext: context }) { return Object.freeze({ boundedResponseContext, projectMemoryContext: context?.projectMemoryContext ?? null, developmentQuery: context ? { mode: context.mode, qualification: context.qualification, dataPolicy: context.dataPolicy } : null }); },
    deterministicAnswer() { return 'deterministic development answer'; }
  });
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler: Object.freeze({ async assemble() { return Object.freeze({ version: 1 }); } }), developmentQueryIntegration });
  const answer = await responder({ text: 'history request', request: requestWithIntent('project_development_historical') });
  assert.equal(answer, 'Development answer grounded in verified history.');
  assert.equal(routed[0].metadata.pdk4DevelopmentQueryMode, 'historical');

  routed.length = 0;
  const normalAnswer = await responder({ text: 'ordinary personal statement', request: requestWithIntent('answer') });
  assert.equal(normalAnswer, 'Development answer grounded in verified history.');
  assert.equal(routed[0].metadata.pdk4DevelopmentQueryMode, null);
  assert.equal(routed[0].messages.some((message) => String(message.content).includes('DEVELOPMENT_QUERY_CONTEXT') && String(message.content).includes('null')), true);
});
