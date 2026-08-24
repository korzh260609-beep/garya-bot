import test from 'node:test';
import assert from 'node:assert/strict';
import { createReasoningEffortSelector } from '../src/ai/reasoningEffortSelector.js';
import { createTaskAssessment } from '../src/ai/taskAssessment.js';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { AIConfigurationError, AIProviderError } from '../src/ai/errors.js';

const selector = createReasoningEffortSelector();
const assessment = (signals = {}) => createTaskAssessment(signals);
const model = (supportedReasoningEfforts, overrides = {}) => ({
  id: 'model', supportedReasoningEfforts, defaultReasoningEffort: supportedReasoningEfforts[0] ?? null, ...overrides,
});

test('AR2.7 derives effort independently from L1, L2 and L3 model tiers', () => {
  const supported = model(['low', 'medium', 'high']);
  assert.equal(selector.select({ tier: 'L1', assessment: assessment(), model: supported }).effort, 'low');
  assert.equal(selector.select({ tier: 'L2', assessment: assessment(), model: supported }).effort, 'low');
  assert.equal(selector.select({ tier: 'L2', assessment: assessment({ reasoningDepth: 0.7 }), model: supported }).effort, 'medium');
  assert.equal(selector.select({ tier: 'L3', assessment: assessment(), model: supported }).effort, 'medium');
  assert.equal(selector.select({ tier: 'L3', assessment: assessment({ codingDebugging: 1 }), model: supported }).effort, 'high');
});

test('AR2.7 chooses the lowest supported effort that satisfies the requirement', () => {
  const selected = selector.select({ tier: 'L2', assessment: assessment(), model: model(['medium', 'high']) });
  assert.equal(selected.requiredEffort, 'low');
  assert.equal(selected.effort, 'medium');
  assert.equal(selected.reason, 'lowest-supported-sufficient-effort');
});

test('AR2.7 fails closed when a configured model cannot satisfy required effort', () => {
  assert.throws(
    () => selector.select({ tier: 'L3', assessment: assessment({ codingDebugging: 1 }), model: model(['low', 'medium']) }),
    AIConfigurationError,
  );
});

test('AR2.7 keeps xhigh and max behind explicit trusted policy', () => {
  assert.throws(
    () => selector.select({ tier: 'L3', assessment: assessment(), model: model(['high', 'xhigh']), requestedEffort: 'xhigh' }),
    /trusted-sg-policy/,
  );
  const selected = selector.select({
    tier: 'L3', assessment: assessment(), model: model(['high', 'xhigh', 'max']), requestedEffort: 'xhigh',
    trustedRoutingPolicy: { source: 'trusted-sg-policy', maximumReasoningEffort: 'xhigh' },
  });
  assert.equal(selected.effort, 'xhigh');
});

test('AR2.7 router passes selected effort through provider metadata and result telemetry', async () => {
  let providerRequest;
  const events = [];
  const router = createAIRouter({
    registry: createModelRegistry([{
      id: 'primary', provider: 'fixture', model: 'fixture-model', specialties: ['reasoning'], tier: 'L3',
      supportedReasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'low',
    }]),
    providers: { fixture: { async generate({ request }) { providerRequest = request; return { text: 'ok' }; } } },
    telemetry: { record(event) { events.push(event); } },
  });
  const result = await router.route({
    task: 'analysis', reason: 'AR2.7 integration', messages: [{ role: 'user', content: 'debug' }],
    traceContext: { traceId: 'trace-ar27', requestId: 'request-ar27' }, taskAssessmentSignals: { codingDebugging: 1 },
  });
  assert.equal(providerRequest.metadata.reasoningEffort, 'high');
  assert.equal(providerRequest.routing.reasoningEffortSelection.effort, 'high');
  assert.equal(result.reasoningEffort, 'high');
  assert.equal(events.find((event) => event.type === 'ai.reasoning-effort.selected').effort, 'high');
});

test('AR2.7 fallback cannot silently lower the primary effort requirement', async () => {
  const router = createAIRouter({
    registry: createModelRegistry([{
      id: 'primary', provider: 'primary', model: 'primary-model', specialties: ['reasoning'], tier: 'L3', fallbackId: 'fallback',
      supportedReasoningEfforts: ['high'], defaultReasoningEffort: 'high',
    }, {
      id: 'fallback', provider: 'fallback', model: 'fallback-model', specialties: ['reasoning-fallback'], tier: 'L3',
      supportedReasoningEfforts: ['low', 'medium'], defaultReasoningEffort: 'low',
    }]),
    providers: {
      primary: { async generate() { throw new AIProviderError('down'); } },
      fallback: { async generate() { return { text: 'must-not-run' }; } },
    },
    maxRetries: 0,
  });
  await assert.rejects(() => router.route({
    task: 'analysis', reason: 'AR2.7 fallback', messages: [{ role: 'user', content: 'debug' }],
    traceContext: { traceId: 'trace-ar27-fallback', requestId: 'request-ar27-fallback' },
    taskAssessmentSignals: { codingDebugging: 1 },
  }), /does not support the required reasoning effort: high/);
});
