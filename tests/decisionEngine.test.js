import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';
import { createSemanticInterpretation } from '../src/contracts/semantic.js';

const canonicalInput = Object.freeze({
  traceContext: Object.freeze({ traceId: 'trace-decision', requestId: 'request-decision' })
});

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

test('chooses the highest-priority candidate deterministically', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput,
    interpretation: interpretation({
      candidateActions: [
        { type: 'answer', name: 'lower', actionClass: 'analysis', priority: 1 },
        { type: 'answer', name: 'higher', actionClass: 'analysis', priority: 10 }
      ]
    })
  });

  assert.equal(result.decisionEnvelope.selectedAction.name, 'higher');
  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.diagnostics.selectedCandidateIndex, 1);
});

test('requests clarification when essential information is missing', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput,
    interpretation: interpretation({
      missingInformation: ['recipient'],
      clarificationQuestion: 'Which recipient should be used?'
    })
  });

  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
  assert.equal(result.responsePlan.message, 'Which recipient should be used?');
});

test('uses uncertainty threshold only when a clarification question exists', () => {
  const engine = createDecisionEngine({ uncertaintyThreshold: 0.6 });
  const result = engine.decide({
    canonicalInput,
    interpretation: interpretation({
      uncertainty: 0.8,
      clarificationQuestion: 'Should I use the latest version?'
    })
  });

  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
});

test('keeps evidence needs explicit without checking permissions', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput,
    interpretation: interpretation({ evidenceNeeds: ['repository-state'] })
  });

  assert.deepEqual(result.decisionEnvelope.evidenceNeeds, ['repository-state']);
  assert.equal(result.decisionEnvelope.diagnostics.requiresEvidence, true);
  assert.equal(result.decisionEnvelope.diagnostics.permissionChecked, false);
  assert.equal(result.decisionEnvelope.diagnostics.capabilityExecuted, false);
});

test('converts executable and protected intent into prepare-only decision', () => {
  const engine = createDecisionEngine();
  const external = engine.decide({
    canonicalInput,
    interpretation: interpretation({
      candidateActions: [{ type: 'execute', name: 'send-report', actionClass: 'external' }]
    })
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
  const engine = createDecisionEngine();
  assert.throws(
    () => engine.decide({
      canonicalInput,
      interpretation: interpretation({ missingInformation: ['document'] })
    }),
    /clarificationQuestion is required/
  );
});
