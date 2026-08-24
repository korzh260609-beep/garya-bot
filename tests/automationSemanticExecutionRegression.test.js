import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';

function semanticOutput(candidateActions) {
  return {
    meaning: 'automation request',
    goal: 'automation',
    intent: candidateActions[0].name,
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
    candidateActions,
    rationale: 'test'
  };
}

function canonicalInput({ text = 'test', temporalResolution = null } = {}) {
  return {
    text,
    locale: 'ru',
    identityContext: { globalUserId: 'usr_test', roles: ['guest'] },
    scopeContext: { userScope: 'usr_test', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-automation-semantic', requestId: 'request-automation-semantic' },
    metadata: { temporalResolution }
  };
}

function interpreterFor(output) {
  return createProductionMeaningInterpreter({
    aiRouter: {
      async route() {
        return { text: JSON.stringify(output) };
      }
    }
  });
}

test('recurring schedule list preserves executable read-only action class', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'schedule-list', name: 'schedule-list', actionClass: 'read-only', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Покажи мои повторяющиеся задачи' }));

  assert.equal(result.candidateActions.length, 1);
  assert.equal(result.candidateActions[0].name, 'schedule-list');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
});

test('general request for SG actual tasks is deterministically routed to scoped task list', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Дай список твоих задач' }));

  assert.equal(result.intent, 'task-list');
  assert.equal(result.candidateActions.length, 1);
  assert.equal(result.candidateActions[0].name, 'task-list');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
});

test('natural scheduled inventory request routes to operational task list', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Что у тебя запланировано?' }));

  assert.equal(result.intent, 'task-list');
  assert.equal(result.candidateActions[0].name, 'task-list');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
});

test('natural automation inventory request routes to operational task list', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Какие у тебя автоматизации?' }));

  assert.equal(result.intent, 'task-list');
  assert.equal(result.candidateActions[0].name, 'task-list');
});

test('clarification excluding project tasks still routes to operational task list', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Нет не проекта сг а твоих автоматизаций' }));

  assert.equal(result.intent, 'task-list');
  assert.equal(result.candidateActions[0].name, 'task-list');
});

test('explicit project task request is not rewritten into runtime task storage lookup', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Покажи список задач проекта SG' }));

  assert.equal(result.candidateActions[0].name, 'compose-answer');
});

test('capability question is not rewritten into operational task list', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Что ты умеешь делать?' }));

  assert.equal(result.candidateActions[0].name, 'compose-answer');
});

test('task capability question remains conversational instead of querying stored tasks', async () => {
  const interpreter = interpreterFor(semanticOutput([
    { type: 'answer', name: 'compose-answer', actionClass: 'analysis', payload: {} }
  ]));

  const result = await interpreter.interpret(canonicalInput({ text: 'Какие задачи ты можешь выполнять?' }));

  assert.equal(result.candidateActions[0].name, 'compose-answer');
});

test('one-shot self notification inherits exact deterministic temporal resolution when AI omits temporalExpression', async () => {
  const interpreter = interpreterFor(semanticOutput([
    {
      type: 'task-create',
      name: 'task-create',
      actionClass: 'state-change',
      payload: { kind: 'self-notification', notificationMessage: 'привет' }
    }
  ]));

  const result = await interpreter.interpret(canonicalInput({
    text: 'Пришли мне привет через 2 минуты',
    temporalResolution: {
      status: 'resolved',
      originalExpression: 'Пришли мне привет через 2 минуты',
      precision: 'minute',
      ambiguous: false,
      utcStart: '2026-08-14T14:52:00.000Z',
      utcEndExclusive: null
    }
  }));

  const action = result.candidateActions[0];
  assert.equal(action.name, 'task-create');
  assert.equal(action.actionClass, 'state-change');
  assert.equal(action.payload.kind, 'self-notification');
  assert.equal(action.payload.notificationMessage, 'привет');
  assert.equal(action.payload.temporalExpression, 'Пришли мне привет через 2 минуты');
});

test('ambiguous temporal resolution is never promoted into an executable self notification', async () => {
  const interpreter = interpreterFor(semanticOutput([
    {
      type: 'task-create',
      name: 'task-create',
      actionClass: 'state-change',
      payload: { kind: 'self-notification', notificationMessage: 'привет' }
    }
  ]));

  const result = await interpreter.interpret(canonicalInput({
    text: 'Пришли мне привет вечером',
    temporalResolution: {
      status: 'resolved',
      originalExpression: 'Пришли мне привет вечером',
      precision: 'daypart',
      ambiguous: true,
      utcStart: '2026-08-14T14:00:00.000Z',
      utcEndExclusive: '2026-08-14T19:00:00.000Z'
    }
  }));

  assert.equal(result.candidateActions[0].payload.temporalExpression, undefined);
});

test('scheduled fresh report remains a structured automation and never becomes a self notification', async () => {
  const plan = {
    trigger: { type: 'recurring', recurrence: 'FREQ=DAILY', localTime: '07:00' },
    action: { type: 'workspace-activity-report' },
    scope: { type: 'authorized-current-workspaces' },
    period: { type: 'previous-calendar-day' },
    metrics: ['messages-count'],
    delivery: { target: 'requester' }
  };
  const text = 'Каждый день в 07:00 присылай отчёт активности за прошедший день';
  const interpreter = interpreterFor(semanticOutput([{ type: 'task-create', name: 'task-create', actionClass: 'state-change', payload: { kind: 'structured-automation', plan } }]));
  const result = await interpreter.interpret(canonicalInput({ text }));
  const action = result.candidateActions[0];
  assert.equal(action.payload.kind, 'structured-automation');
  assert.deepEqual(action.payload.plan, plan);
  assert.equal(action.payload.notificationMessage, undefined);
  assert.equal(action.payload.sourceText, text);
});
