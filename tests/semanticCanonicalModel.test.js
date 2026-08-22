import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { createFixtureMeaningInterpreter } from '../src/semantic/meaningInterpreter.js';
import { CANONICAL_TEMPORAL_TYPES } from '../src/contracts/semantic.js';

function input(text = 'cancel task 2') {
  return {
    text,
    locale: 'en',
    identityContext: { globalUserId: 'u-1' },
    scopeContext: { type: 'direct' },
    traceContext: { traceId: 'trace-1', requestId: 'request-1' },
    metadata: {}
  };
}

function interpretation(overrides = {}) {
  return {
    meaning: 'Cancel task 2',
    goal: 'cancel-task',
    intent: 'task-cancel',
    target: { type: 'task', id: '2' },
    timeExpression: null,
    scope: { type: 'current-user' },
    parameters: { reason: 'user-request' },
    delivery: { target: 'requester' },
    uncertainty: 0.1,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    entities: [],
    constraints: [],
    candidateActions: [
      { type: 'execute', name: 'task-read', actionClass: 'read-only', priority: 1 },
      { type: 'execute', name: 'task-cancel', actionClass: 'state-change', priority: 10, payload: { id: '2' } }
    ],
    ...overrides
  };
}

test('Semantic Kernel emits one canonical semantic execution contract', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation())
  });
  const result = await kernel.process(input());

  assert.equal(result.canonicalSemanticModel.version, '1.0');
  assert.equal(result.canonicalSemanticModel.resolutionStatus, 'resolved');
  assert.equal(result.canonicalSemanticModel.intent, 'task-cancel');
  assert.equal(result.canonicalSemanticModel.action.name, 'task-cancel');
  assert.deepEqual(result.canonicalSemanticModel.target, { type: 'task', id: '2' });
  assert.equal(result.canonicalSemanticModel.confidence, 0.9);
  assert.equal(result.decisionEnvelope.selectedAction.name, result.canonicalSemanticModel.action.name);
  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.decisionEnvelope.diagnostics.canonicalSemanticModelVersion, '1.0');
});

test('explicit semantic action is authoritative over candidate ordering', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      action: { type: 'execute', name: 'task-cancel', actionClass: 'state-change', payload: { id: '2' } },
      candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis', priority: 999 }]
    }))
  });
  const result = await kernel.process(input());
  assert.equal(result.canonicalSemanticModel.action.name, 'task-cancel');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'task-cancel');
  assert.equal(result.canonicalSemanticModel.diagnostics.selectedActionSource, 'explicit-action');
});

test('low semantic confidence fails closed with deterministic clarification', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({ uncertainty: 0.9 }))
  });
  const result = await kernel.process({ ...input('do it'), locale: 'ru' });
  assert.equal(result.canonicalSemanticModel.resolutionStatus, 'clarification-required');
  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
  assert.equal(result.responsePlan.mode, 'clarification');
  assert.match(result.responsePlan.message, /Уточните/);
});

test('existing Temporal Context resolution is carried into canonical timeExpression without reparsing source text', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation())
  });
  const result = await kernel.process({
    ...input('report activity'),
    metadata: {
      temporalResolution: {
        status: 'resolved',
        precision: 'day',
        timeZone: 'Europe/Kyiv',
        localStart: '2026-08-21T00:00:00',
        localEndExclusive: '2026-08-22T00:00:00',
        utcStart: '2026-08-20T21:00:00.000Z',
        utcEndExclusive: '2026-08-21T21:00:00.000Z',
        source: 'deterministic-temporal-parser'
      }
    }
  });
  assert.equal(result.canonicalSemanticModel.timeExpression.type, 'resolved-temporal-expression');
  assert.equal(result.canonicalSemanticModel.timeExpression.timeZone, 'Europe/Kyiv');
  assert.equal(result.canonicalSemanticModel.timeExpression.localStart, '2026-08-21T00:00:00');
});

test('equivalent previous-calendar-day meanings share one bounded canonical temporal value', async () => {
  for (const text of ['за вчера', 'за прошедший день', 'за предыдущий день']) {
    const kernel = createSemanticKernel({
      meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
        timeExpression: { type: 'previous-calendar-day' }
      }))
    });
    const result = await kernel.process(input(text));
    assert.equal(result.canonicalSemanticModel.timeExpression.type, 'previous-calendar-day');
  }
});

test('rolling 24 hours remains semantically distinct from previous calendar day', async () => {
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      timeExpression: { type: 'rolling-24-hours' }
    }))
  });
  const result = await kernel.process(input('за последние сутки'));
  assert.equal(result.canonicalSemanticModel.timeExpression.type, 'rolling-24-hours');
  assert.notEqual(result.canonicalSemanticModel.timeExpression.type, 'previous-calendar-day');
});

test('canonical semantic model rejects temporal and action values outside bounded contracts', async () => {
  assert.deepEqual(CANONICAL_TEMPORAL_TYPES, [
    'previous-calendar-day', 'current-calendar-day', 'rolling-24-hours',
    'previous-week', 'current-week', 'custom-range'
  ]);
  const invalidTemporal = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({ timeExpression: { type: 'some-day' } }))
  });
  await assert.rejects(() => invalidTemporal.process(input()), /unsupported timeExpression\.type/);

  const invalidAction = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation({
      action: { type: 'execute', name: 'task-cancel', actionClass: 'magic' }
    }))
  });
  await assert.rejects(() => invalidAction.process(input()), /unsupported action\.actionClass/);
});
