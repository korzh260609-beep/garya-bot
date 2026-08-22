import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';

function canonicalInput() {
  return {
    text: 'Реализуй этап LA1',
    locale: 'ru',
    traceContext: { traceId: 't-github-runtime-binding', requestId: 'r-github-runtime-binding' }
  };
}

function interpretation(action) {
  return {
    intent: 'github-development',
    goal: 'execute-github-development',
    uncertainty: 0.01,
    clarificationQuestion: null,
    missingInformation: [],
    evidenceNeeds: [],
    contextNeeds: [],
    candidateActions: [action],
    memoryCandidates: [],
    memoryQuery: null,
    conversationHistoryQuery: null,
    subsystemRequest: null,
    rationale: 'runtime binding regression'
  };
}

function canonicalModel(action) {
  return {
    version: '1.0',
    resolutionStatus: 'resolved',
    intent: 'github-development',
    goal: 'execute-github-development',
    action,
    diagnostics: { selectedCandidateIndex: 0, selectedCandidatePriority: 0 },
    confidence: 0.99
  };
}

test('canonical github development action binds to the existing GH3 runtime capability without changing canonical meaning', () => {
  const action = {
    type: 'github-development',
    name: 'github.development.execute',
    actionClass: 'state-change',
    payload: { mode: 'execute', instruction: 'Implement LA1' }
  };
  const result = createDecisionEngine().decide({
    canonicalInput: canonicalInput(),
    interpretation: interpretation(action),
    canonicalSemanticModel: canonicalModel(action),
    interpreterName: 'production-ai-meaning-interpreter-with-gh3'
  });

  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.development.execute');
  assert.equal(result.decisionEnvelope.selectedAction.payload.instruction, 'Implement LA1');
  assert.equal(result.decisionEnvelope.diagnostics.canonicalGitHubAction, 'github.development.execute');
});

test('github workspace status request binds to the same GH3 capability in read-only status mode', () => {
  const action = {
    type: 'github-development',
    name: 'github.repository.inspect',
    actionClass: 'read-only',
    payload: { mode: 'status' }
  };
  const result = createDecisionEngine().decide({
    canonicalInput: canonicalInput(),
    interpretation: interpretation(action),
    canonicalSemanticModel: canonicalModel(action),
    interpreterName: 'production-ai-meaning-interpreter-with-gh3'
  });

  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'github-development-status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.mode, 'status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.repository.inspect');
});
