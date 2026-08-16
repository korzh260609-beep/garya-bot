import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalInput, createSemanticInterpretation } from '../src/contracts/semantic.js';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';

function canonicalInput() {
  return createCanonicalInput({
    text: 'project history request',
    locale: 'ru',
    identityContext: { globalUserId: 'usr-test' },
    scopeContext: { projectScope: 'sg2.1' },
    traceContext: { traceId: 'trace-test', requestId: 'request-test' }
  });
}

function interpretation({ action, intent = 'project_development_historical' }) {
  return createSemanticInterpretation({
    meaning: 'User asks for verified project development history.',
    goal: 'Answer from project development knowledge.',
    intent,
    uncertainty: 0.05,
    evidenceNeeds: ['verified project history'],
    candidateActions: [action]
  });
}

function repositoryReadAction() {
  return {
    type: 'prepare',
    name: 'repository-analyze',
    actionClass: 'read-only',
    priority: 100,
    payload: { mode: 'read-only' }
  };
}

test('PDK4 live regression: read-only repository prepare is canonicalized to conversational answer', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput: canonicalInput(),
    interpretation: interpretation({ action: repositoryReadAction() }),
    interpreterName: 'regression-test'
  });

  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
  assert.equal(result.decisionEnvelope.selectedAction.actionClass, 'analysis');
  assert.equal(result.decisionEnvelope.selectedAction.payload.semanticIntent, 'project_development_historical');
  assert.equal(result.decisionEnvelope.diagnostics.conversationalRepositoryReadCanonicalized, true);
  assert.equal(result.decisionEnvelope.diagnostics.projectDevelopmentConversationalCanonicalized, true);
  assert.equal(result.responsePlan.mode, 'answer');
  assert.equal(result.responsePlan.preparedAction, null);
});

test('PDK4 live regression: generic upstream intent cannot leak repository prepare-only stub to the user', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput: canonicalInput(),
    interpretation: interpretation({ action: repositoryReadAction(), intent: 'answer' }),
    interpreterName: 'generic-upstream-regression-test'
  });

  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
  assert.equal(result.decisionEnvelope.selectedAction.actionClass, 'analysis');
  assert.equal(result.decisionEnvelope.selectedAction.payload.semanticIntent, 'answer');
  assert.equal(result.decisionEnvelope.diagnostics.conversationalRepositoryReadCanonicalized, true);
  assert.equal(result.decisionEnvelope.diagnostics.projectDevelopmentConversationalCanonicalized, false);
  assert.equal(result.responsePlan.mode, 'answer');
  assert.equal(result.responsePlan.preparedAction, null);
});

test('PDK4 safety regression: protected state-changing execution is not canonicalized', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput: canonicalInput(),
    interpretation: interpretation({
      action: {
        type: 'execute',
        name: 'repository-write',
        actionClass: 'state-change',
        priority: 100,
        payload: { operation: 'write' }
      }
    }),
    interpreterName: 'regression-test'
  });

  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'execute');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'repository-write');
  assert.equal(result.decisionEnvelope.selectedAction.actionClass, 'state-change');
  assert.equal(result.decisionEnvelope.diagnostics.conversationalRepositoryReadCanonicalized, false);
  assert.equal(result.decisionEnvelope.diagnostics.projectDevelopmentConversationalCanonicalized, false);
  assert.equal(result.responsePlan.mode, 'execute');
});
