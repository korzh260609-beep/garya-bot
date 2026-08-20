import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';

const registry = createModelRegistry(['L1', 'L2', 'L3'].map((tier) => ({
  id: tier, provider: tier, model: `model-${tier}`, specialties: ['reasoning', 'extraction'], tier,
  supportedReasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'low',
})));
const input = {
  task: 'extraction', reason: 'AR2.9', messages: [{ role: 'user', content: 'extract item-7' }],
  traceContext: { traceId: 'trace-ar29', requestId: 'request-ar29' },
  responseFormat: { name: 'result', jsonSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  validation: { requiredIdentifiers: ['item-7'] },
};

test('AR2.9 promotes L1 to L2 and preserves original request, prior result and validation reason', async () => {
  const calls = [];
  const router = createAIRouter({ registry, providers: {
    L1: { async generate({ request }) { calls.push(request); return { text: '{"id":"wrong"}' }; } },
    L2: { async generate({ request }) { calls.push(request); return { text: '{"id":"item-7"}' }; } },
    L3: { async generate() { throw new Error('unused'); } },
  } });
  const result = await router.route(input);
  assert.equal(result.tier, 'L2');
  assert.equal(result.validation.passed, true);
  assert.equal(result.escalation.promotions.length, 1);
  assert.equal(calls[1].messages[0].content, 'extract item-7');
  assert.match(calls[1].messages.at(-1).content, /missing-identifier/);
});

test('AR2.9 is bounded to two promotions and stops at L3', async () => {
  const counts = { L1: 0, L2: 0, L3: 0 };
  const providers = Object.fromEntries(['L1', 'L2', 'L3'].map((tier) => [tier, {
    async generate() { counts[tier] += 1; return { text: '{"id":"wrong"}' }; },
  }]));
  const result = await createAIRouter({ registry, providers }).route(input);
  assert.deepEqual(counts, { L1: 1, L2: 1, L3: 1 });
  assert.equal(result.validation.passed, false);
  assert.equal(result.escalation.promotions.length, 2);
  assert.equal(result.escalation.terminalReason, 'promotion-limit-reached');
});

test('AR2.9 does not escalate accepted output', async () => {
  let calls = 0;
  const providers = Object.fromEntries(['L1', 'L2', 'L3'].map((tier) => [tier, {
    async generate() { calls += 1; return { text: '{"id":"item-7"}' }; },
  }]));
  const result = await createAIRouter({ registry, providers }).route(input);
  assert.equal(calls, 1);
  assert.equal(result.escalation.used, false);
  assert.equal(result.escalation.terminalReason, 'validation-accepted');
});
