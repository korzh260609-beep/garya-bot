import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createIdentityContext, createScopeContext, createTraceContext } from '../src/contracts/context.js';
import { createFixtureMeaningInterpreter } from '../src/semantic/meaningInterpreter.js';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { executeSafeNoop } from '../src/semantic/noopCapability.js';

function baseInput(text = 'Analyze the project') {
  const identityContext = createIdentityContext({ globalUserId: 'user:1', platform: 'local', platformUserId: '1' });
  return {
    text,
    locale: 'en',
    identityContext,
    scopeContext: createScopeContext({ userScope: identityContext.globalUserId, projectScope: 'sg2.1' }),
    traceContext: createTraceContext({ traceId: randomUUID(), requestId: randomUUID(), environment: 'test', revision: 'test' })
  };
}

function interpretation(overrides = {}) {
  return {
    meaning: 'Analyze the project and return findings.',
    goal: 'understand project state',
    intent: 'analyze',
    entities: [{ type: 'project', value: 'sg2.1' }],
    constraints: [],
    uncertainty: 0.1,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: ['project context'],
    evidenceNeeds: ['repository facts'],
    candidateActions: [{ type: 'answer', name: 'analyze-project', actionClass: 'analysis' }],
    rationale: 'The user requests analysis, not execution.',
    ...overrides
  };
}

test('produces a validated answer DecisionEnvelope', async () => {
  const kernel = createSemanticKernel({ meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation()) });
  const result = await kernel.process(baseInput());
  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.responsePlan.mode, 'answer');
  assert.equal(result.decisionEnvelope.traceId, result.canonicalInput.traceContext.traceId);
  assert.deepEqual(executeSafeNoop(result.decisionEnvelope), {
    capability: 'safe-noop', status: 'completed', executed: false,
    decisionType: 'answer', traceId: result.decisionEnvelope.traceId
  });
});

test('equivalent wording can produce compatible decision structures', async () => {
  const kernel = createSemanticKernel({ meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation()) });
  const first = await kernel.process(baseInput('Analyze SG 2.1'));
  const second = await kernel.process(baseInput('Review the SG 2.1 project'));
  assert.equal(first.decisionEnvelope.intent, second.decisionEnvelope.intent);
  assert.equal(first.decisionEnvelope.decisionType, second.decisionEnvelope.decisionType);
  assert.equal(first.decisionEnvelope.selectedAction.name, second.decisionEnvelope.selectedAction.name);
});

test('asks at most one clarification when essential information is missing', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      meaning: 'A target is required.', goal: 'modify a file', intent: 'edit',
      missingInformation: ['target file', 'required change'],
      clarificationQuestion: 'Which file should be changed, and what change is required?',
      candidateActions: []
    }))
  });
  const result = await kernel.process(baseInput('Change it'));
  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
  assert.equal(result.responsePlan.message, 'Which file should be changed, and what change is required?');
  assert.equal(Array.isArray(result.responsePlan.message), false);
});

test('keeps missing contextual information answerable when clarification text is absent', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      missingInformation: ['remembered personal fact'], clarificationQuestion: null
    }))
  });
  const result = await kernel.process(baseInput('What do you remember about me?'));
  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.clarificationQuestion, null);
  assert.equal(result.decisionEnvelope.diagnostics.missingInformationWithoutClarification, true);
});

test('preserves external or state-changing actions for Action Gate authorization', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      goal: 'send message', intent: 'send',
      candidateActions: [{ type: 'execute', name: 'send-message', actionClass: 'external' }]
    }))
  });
  const result = await kernel.process(baseInput('Send the message'));
  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.responsePlan.requiresConfirmation, false);
  assert.equal(result.responsePlan.preparedAction, null);
  assert.equal(result.decisionEnvelope.diagnostics.permissionChecked, false);
  assert.equal(result.decisionEnvelope.diagnostics.capabilityExecuted, false);
});

test('rejects invalid uncertainty and malformed contracts', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({ uncertainty: 2 }))
  });
  await assert.rejects(() => kernel.process(baseInput()), /uncertainty must be between 0 and 1/);
});

test('requires an injected meaning interpreter', () => {
  assert.throws(() => createSemanticKernel({}), /meaningInterpreter\.interpret/);
});
