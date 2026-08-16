import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentQueryIntegration } from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';

function requestWithIntent(semanticIntent = 'answer') {
  return Object.freeze({
    actor: Object.freeze({ globalUserId: 'usr-monarch', roles: Object.freeze(['monarch']) }),
    scope: Object.freeze({ projectScope: projectKey }),
    input: Object.freeze({ semanticIntent })
  });
}

function autonomousRecord(memoryId = 'auto-weak') {
  return Object.freeze({
    memoryId,
    source: Object.freeze({ kind: 'github' }),
    trust: 'verified',
    confirmed: false,
    confirmationState: 'proposed',
    metadata: Object.freeze({ pdk4AutonomousIngestion: true, pdk4SourceVerified: true })
  });
}

function guardedContext() {
  return Object.freeze({
    projectKey,
    facts: Object.freeze([Object.freeze({ confirmed: false, trust: 'verified' })])
  });
}

function integrationFor(results) {
  const calls = { retrieval: 0, guard: 0 };
  const projectMemoryIntegration = Object.freeze({
    async contextForRequest() { return null; },
    prepareModelContext({ boundedResponseContext = null, projectMemoryContext = null } = {}) { return Object.freeze({ boundedResponseContext, projectMemoryContext }); },
    deterministicAnswer() { return 'unused'; }
  });
  const retrieval = Object.freeze({
    async search() {
      calls.retrieval += 1;
      return Object.freeze({ projectKey, count: results.length, results: Object.freeze(results) });
    }
  });
  const contextGuard = Object.freeze({
    async build() {
      calls.guard += 1;
      return guardedContext();
    }
  });
  return { calls, integration: createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard }) };
}

test('PDK4.13 live regression: generic intent cannot activate on one weak lexical overlap', async () => {
  const weak = Object.freeze({
    record: autonomousRecord(),
    score: 0.12,
    exactScore: 0,
    lexicalScore: 1 / 7,
    semanticScore: 0,
    relationExpanded: false
  });
  const { calls, integration } = integrationFor([weak]);
  const context = await integration.contextForRequest({
    request: requestWithIntent('answer'),
    query: 'ordinary personal-domain statement with one accidental overlap'
  });
  assert.equal(context, null);
  assert.equal(calls.retrieval, 1);
  assert.equal(calls.guard, 0);
});

test('PDK4.13 generic fallback still activates on a strong verified direct lexical anchor', async () => {
  const strong = Object.freeze({
    record: autonomousRecord('auto-strong'),
    score: 0.8,
    exactScore: 0,
    lexicalScore: 0.75,
    semanticScore: 0,
    relationExpanded: false
  });
  const { calls, integration } = integrationFor([strong]);
  const context = await integration.contextForRequest({
    request: requestWithIntent('answer'),
    query: 'project development question with strong direct evidence overlap'
  });
  assert.equal(context?.mode, 'evidence');
  assert.equal(context?.qualification?.semanticFallbackActivated, true);
  assert.equal(context?.qualification?.semanticFallbackBasis, 'strong-direct-relevant-source-verified-project-memory-anchor');
  assert.equal(calls.retrieval, 1);
  assert.equal(calls.guard, 1);
});
