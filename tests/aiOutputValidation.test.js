import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createDeterministicOutputValidator } from '../src/ai/outputValidator.js';

const traceContext = { traceId: 'trace-ar28', requestId: 'request-ar28' };
const registry = createModelRegistry([{
  id: 'validator-model', provider: 'fixture', model: 'fixture-model', specialties: ['reasoning'],
  tier: 'L2', supportedReasoningEfforts: ['low'], defaultReasoningEffort: 'low',
}]);

function route(text, overrides = {}) {
  const events = [];
  const router = createAIRouter({
    registry,
    providers: { fixture: { async generate() { return { text }; } } },
    telemetry: { record(event) { events.push(event); } },
    ...overrides,
  });
  return { events, result: router.route({
    task: 'extraction', reason: 'AR2.8 validation', messages: [{ role: 'user', content: 'extract' }], traceContext,
    responseFormat: { name: 'extraction', jsonSchema: {
      type: 'object', additionalProperties: false, required: ['id', 'evidence', 'confidence'],
      properties: { id: { type: 'string' }, evidence: { type: 'array', minItems: 1, items: { type: 'string' } }, confidence: { type: 'number' } },
    } },
    validation: { requiredIdentifiers: ['item-7'], evidencePath: 'evidence', confidencePath: 'confidence', minimumConfidence: 0.8 },
  }) };
}

test('AR2.8 validates schema, required evidence, identifiers and confidence deterministically', async () => {
  const execution = route(JSON.stringify({ id: 'item-7', evidence: ['source-1'], confidence: 0.9 }));
  const result = await execution.result;
  assert.equal(result.validation.passed, true);
  assert.equal(result.validation.confidence.score, 0.9);
  assert.equal(execution.events.find((event) => event.type === 'ai.output.validated').passed, true);
});

test('AR2.8 returns an explicit failed contract for insufficient valid output', async () => {
  const { result } = route(JSON.stringify({ id: 'wrong', evidence: [], confidence: 0.4 }));
  const validated = await result;
  assert.equal(validated.validation.passed, false);
  assert.equal(validated.validation.escalationRecommended, true);
  assert.ok(validated.validation.failures.includes('confidence-below-threshold'));
  assert.ok(validated.validation.failures.some((failure) => failure.includes('evidence')));
});

test('AR2.8 task-specific validators enforce deterministic invariants', () => {
  const validator = createDeterministicOutputValidator({
    taskValidators: { extraction: ({ output }) => ({ passed: output.count === output.items.length, failures: ['count-mismatch'] }) },
  });
  const validation = validator.validate({
    request: { validation: { requiredFields: ['items'] }, routing: { taskClass: 'extraction' } },
    result: { text: JSON.stringify({ count: 2, items: ['one'] }) },
  });
  assert.equal(validation.passed, false);
  assert.ok(validation.failures.includes('count-mismatch'));
});

test('AR2.8 does not treat failed semantic validation as provider fallback', async () => {
  let fallbackCalls = 0;
  const fallbackRegistry = createModelRegistry([{
    id: 'primary', provider: 'fixture', model: 'primary', specialties: ['reasoning'], tier: 'L2', fallbackId: 'fallback',
    supportedReasoningEfforts: ['low'], defaultReasoningEffort: 'low',
  }, {
    id: 'fallback', provider: 'fallback', model: 'fallback', specialties: ['reasoning-fallback'], tier: 'L2',
    supportedReasoningEfforts: ['low'], defaultReasoningEffort: 'low',
  }]);
  const router = createAIRouter({
    registry: fallbackRegistry,
    providers: {
      fixture: { async generate() { return { text: '{"ok":false}' }; } },
      fallback: { async generate() { fallbackCalls += 1; return { text: '{"ok":true}' }; } },
    },
  });
  const result = await router.route({
    task: 'check', reason: 'validation is not fallback', messages: [], traceContext,
    responseFormat: { name: 'check', jsonSchema: { type: 'object', required: ['required'], properties: { required: { type: 'boolean' } } } },
  });
  assert.equal(result.validation.passed, false);
  assert.equal(fallbackCalls, 0);
});
