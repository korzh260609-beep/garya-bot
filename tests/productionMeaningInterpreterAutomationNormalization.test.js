import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';

function canonicalInput() {
  return {
    text: 'schedule a self notification',
    locale: 'ru',
    traceContext: { traceId: 'trace-1', requestId: 'request-1' },
    identityContext: { globalUserId: 'usr_owner', roles: ['monarch'] },
    scopeContext: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    metadata: {}
  };
}

function interpretation(candidateAction) {
  return {
    meaning: 'Create a future self notification',
    goal: 'notify-later',
    intent: 'schedule-notification',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    memoryQuery: null,
    conversationHistoryQuery: null,
    subsystemRequest: null,
    memoryCandidates: [],
    candidateActions: [candidateAction],
    rationale: 'The user requested a future notification.'
  };
}

function aiRouterReturning(value) {
  return {
    async route() {
      return { text: JSON.stringify(value) };
    }
  };
}

test('task-create scheduled message is normalized to canonical self-notification before Action Gate', async () => {
  const interpreter = createProductionMeaningInterpreter({
    aiRouter: aiRouterReturning(interpretation({
      type: 'task-create',
      name: 'task-create',
      actionClass: 'state-change',
      payload: { message: 'привет', temporalExpression: 'через 2 минуты' }
    }))
  });

  const result = await interpreter.interpret(canonicalInput());
  const action = result.candidateActions[0];

  assert.equal(action.name, 'task-create');
  assert.equal(action.payload.kind, 'self-notification');
  assert.equal(action.payload.notificationMessage, 'привет');
  assert.equal(action.payload.temporalExpression, 'через 2 минуты');
  assert.equal(action.payload.message, 'привет');
});

test('task-create with explicit non-self kind is never coerced into self-notification', async () => {
  const interpreter = createProductionMeaningInterpreter({
    aiRouter: aiRouterReturning(interpretation({
      type: 'task-create',
      name: 'task-create',
      actionClass: 'state-change',
      payload: { kind: 'external-job', message: 'run something', temporalExpression: 'in 2 minutes' }
    }))
  });

  const result = await interpreter.interpret(canonicalInput());
  const action = result.candidateActions[0];

  assert.equal(action.payload.kind, 'external-job');
  assert.equal(action.payload.notificationMessage, undefined);
});
