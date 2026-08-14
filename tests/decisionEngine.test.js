import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';
import { createSemanticInterpretation } from '../src/contracts/semantic.js';

const canonicalInput = Object.freeze({
  text: 'привет',
  traceContext: Object.freeze({ traceId: 'trace-decision', requestId: 'request-decision' })
});
const SAFE_RESPONSE_FALLBACK = 'SG could not compose a conversational answer. Please try the request again.';

function interpretation(overrides = {}) {
  return createSemanticInterpretation({
    meaning: 'Provide a useful answer',
    goal: 'answer-user',
    intent: 'answer',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: null,
    ...overrides
  });
}

test('chooses the highest-priority conversational candidate but canonicalizes execution through compose-answer', () => {
  const result = createDecisionEngine().decide({
    canonicalInput,
    interpretation: interpretation({
      candidateActions: [
        { type: 'answer', name: 'lower', actionClass: 'analysis', priority: 1 },
        { type: 'answer', name: 'higher', actionClass: 'analysis', priority: 10 }
      ]
    })
  });
  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
  assert.equal(result.decisionEnvelope.selectedAction.priority, 10);
  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.diagnostics.selectedCandidateIndex, 1);
  assert.equal(result.decisionEnvelope.diagnostics.conversationalAnswerCanonicalized, true);
  assert.equal(result.responsePlan.message, SAFE_RESPONSE_FALLBACK);
  assert.notEqual(result.responsePlan.message, canonicalInput.text);
});

test('semantic meaning and canonical user text never become the conversational response plan message', () => {
  const semanticMeaning = "The user is greeting the assistant with a casual Russian 'привет' (hi/hello), initiating a conversation.";
  const result = createDecisionEngine().decide({
    canonicalInput,
    interpretation: interpretation({
      meaning: semanticMeaning,
      candidateActions: [{ type: 'answer', name: 'describe-greeting', actionClass: 'analysis' }]
    })
  });
  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'answer');
  assert.equal(result.responsePlan.message, SAFE_RESPONSE_FALLBACK);
  assert.notEqual(result.responsePlan.message, canonicalInput.text);
  assert.notEqual(result.responsePlan.message, semanticMeaning);
  assert.equal(result.decisionEnvelope.diagnostics.semanticMeaningExposedAsResponse, false);
});

test('protected actions retain their explicit capability identity', () => {
  const result = createDecisionEngine().decide({
    canonicalInput,
    interpretation: interpretation({ candidateActions: [{ type: 'execute', name: 'send-report', actionClass: 'external' }] })
  });
  assert.equal(result.decisionEnvelope.selectedAction.name, 'send-report');
  assert.equal(result.decisionEnvelope.decisionType, 'prepare');
  assert.equal(result.decisionEnvelope.diagnostics.conversationalAnswerCanonicalized, false);
});

test('requests clarification when essential information is missing', () => {
  const result = createDecisionEngine().decide({
    canonicalInput,
    interpretation: interpretation({ missingInformation: ['recipient'], clarificationQuestion: 'Which recipient should be used?' })
  });
  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
  assert.equal(result.responsePlan.message, 'Which recipient should be used?');
});

test('uses uncertainty threshold only when a clarification question exists', () => {
  const result = createDecisionEngine({ uncertaintyThreshold: 0.6 }).decide({
    canonicalInput,
    interpretation: interpretation({ uncertainty: 0.8, clarificationQuestion: 'Should I use the latest version?' })
  });
  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
});

test('keeps evidence needs explicit without checking permissions', () => {
  const result = createDecisionEngine().decide({ canonicalInput, interpretation: interpretation({ evidenceNeeds: ['repository-state'] }) });
  assert.deepEqual(result.decisionEnvelope.evidenceNeeds, ['repository-state']);
  assert.equal(result.decisionEnvelope.diagnostics.requiresEvidence, true);
  assert.equal(result.decisionEnvelope.diagnostics.permissionChecked, false);
  assert.equal(result.decisionEnvelope.diagnostics.capabilityExecuted, false);
});

test('converts executable and protected intent into prepare-only decision', () => {
  const external = createDecisionEngine().decide({
    canonicalInput,
    interpretation: interpretation({ candidateActions: [{ type: 'execute', name: 'send-report', actionClass: 'external' }] })
  });
  assert.equal(external.decisionEnvelope.decisionType, 'prepare');
  assert.equal(external.responsePlan.preparedAction.name, 'send-report');
  assert.equal(external.responsePlan.requiresConfirmation, false);
});

test('equivalent semantic inputs produce compatible decisions', () => {
  const engine = createDecisionEngine();
  const first = engine.decide({ canonicalInput, interpretation: interpretation() });
  const second = engine.decide({ canonicalInput, interpretation: interpretation() });
  assert.deepEqual(first.decisionEnvelope, second.decisionEnvelope);
  assert.deepEqual(first.responsePlan, second.responsePlan);
});

test('fails closed when missing information has no clarification question', () => {
  assert.throws(
    () => createDecisionEngine().decide({ canonicalInput, interpretation: interpretation({ missingInformation: ['document'] }) }),
    /clarificationQuestion is required/
  );
});
