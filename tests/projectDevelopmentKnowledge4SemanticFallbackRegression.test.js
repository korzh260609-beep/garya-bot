import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentQueryIntegration } from '../src/projectDevelopmentKnowledge/developmentQueryIntegration.js';

const projectKey = 'sg2.1';
function request(semanticIntent = 'answer') {
  return Object.freeze({
    actor: Object.freeze({ globalUserId: 'usr-monarch', roles: Object.freeze(['monarch']) }),
    scope: Object.freeze({ projectScope: projectKey }),
    input: Object.freeze({ semanticIntent })
  });
}
function autonomousRecord(memoryId = 'auto-1') {
  return Object.freeze({
    memoryId,
    source: Object.freeze({ kind: 'github' }),
    trust: 'verified',
    confirmed: false,
    confirmationState: 'proposed',
    metadata: Object.freeze({ pdk4AutonomousIngestion: true, pdk4SourceVerified: true })
  });
}
function guardedFact() {
  return Object.freeze({
    contractVersion: 1,
    kind: 'ProjectMemoryContext',
    projectKey,
    generatedAt: '2026-08-16T07:00:00.000Z',
    dataPolicy: Object.freeze({ contentIsDataOnly: true }),
    facts: Object.freeze([Object.freeze({
      memoryId: 'auto-1',
      trust: 'verified',
      confirmed: false,
      confirmationState: 'proposed',
      currentness: 'current',
      provenance: Object.freeze({ sourceKind: 'github', sourceRef: 'abc' })
    })])
  });
}
function integrationFor(results) {
  const calls = { retrieval: 0, guard: 0, pm: 0 };
  const projectMemoryIntegration = Object.freeze({
    async contextForRequest() { calls.pm += 1; return null; },
    prepareModelContext({ boundedResponseContext = null, projectMemoryContext = null } = {}) { return Object.freeze({ boundedResponseContext, projectMemoryContext }); },
    deterministicAnswer() { return 'deterministic'; }
  });
  const retrieval = Object.freeze({
    async search() { calls.retrieval += 1; return Object.freeze({ projectKey, count: results.length, results: Object.freeze(results) }); }
  });
  const contextGuard = Object.freeze({
    async build() { calls.guard += 1; return guardedFact(); }
  });
  return { calls, integration: createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard }) };
}

test('PDK4.13 live regression: ordinary upstream intent still resolves a genuinely relevant project-development query from verified PDK4 evidence', async () => {
  const results = [Object.freeze({
    record: autonomousRecord(),
    exactScore: 0,
    lexicalScore: 0.9,
    semanticScore: 0.92,
    relationExpanded: false
  })];
  const { calls, integration } = integrationFor(results);
  const context = await integration.contextForRequest({
    request: request('answer'),
    query: 'Что изменилось в твоём проекте в последних коммитах?'
  });
  assert.equal(context?.kind, 'DevelopmentQueryContext');
  assert.equal(context?.mode, 'evidence');
  assert.equal(context?.qualification.semanticFallbackActivated, true);
  assert.equal(context?.qualification.semanticFallbackBasis, 'strong-direct-relevant-source-verified-project-memory-anchor');
  assert.equal(calls.retrieval, 1);
  assert.equal(calls.guard, 1);
  assert.equal(calls.pm, 0);
});

test('PDK4.13 live regression: unrelated Passat statement cannot activate retrieval-backed fallback', async () => {
  const results = [Object.freeze({
    record: autonomousRecord(),
    exactScore: 0,
    lexicalScore: 0,
    semanticScore: 0.12,
    relationExpanded: false
  })];
  const { calls, integration } = integrationFor(results);
  const context = await integration.contextForRequest({
    request: request('answer'),
    query: 'а вторая машина passat b5 1998 года, бензин 1.8 атмосферник'
  });
  assert.equal(context, null);
  assert.equal(calls.retrieval, 1);
  assert.equal(calls.guard, 0);
  assert.equal(calls.pm, 0);
});

test('PDK4.13 live regression: relation-expanded history alone cannot activate fallback without a direct relevant anchor', async () => {
  const results = [Object.freeze({
    record: autonomousRecord('expanded'),
    exactScore: 0,
    lexicalScore: 0,
    semanticScore: 0.95,
    relationExpanded: true,
    relationSourceMemoryId: 'missing-direct-anchor'
  })];
  const { calls, integration } = integrationFor(results);
  const context = await integration.contextForRequest({ request: request('answer'), query: 'ordinary unrelated statement' });
  assert.equal(context, null);
  assert.equal(calls.retrieval, 1);
  assert.equal(calls.guard, 0);
});
