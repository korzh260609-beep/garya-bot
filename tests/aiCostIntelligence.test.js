import test from 'node:test';
import assert from 'node:assert/strict';
import { createAICostIntelligence, createVersionedPricingCatalog } from '../src/ai/costIntelligence.js';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';

const model = { provider: 'fixture', model: 'reasoner', tier: 'L2', inputCostPerMillion: 0, outputCostPerMillion: 0 };
const request = {
  traceContext: { traceId: 'trace-cost', requestId: 'request-cost' }, routing: { taskClass: 'analysis' }, metadata: {},
};
const result = { usage: { inputTokens: 1000, cachedInputTokens: 500, outputTokens: 200, reasoningTokens: 100, totalTokens: 1300 }, reasoningEffort: 'medium' };

test('AR2.10 pricing is effective-dated and each call retains an immutable rate snapshot', () => {
  const catalog = createVersionedPricingCatalog([{
    provider: 'fixture', model: 'reasoner', version: 'v1', source: 'provider-pricing-page', currency: 'USD',
    effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: '2026-07-01T00:00:00Z',
    ratesPerMillion: { input: 2, cachedInput: 1, output: 8, reasoning: 4 },
  }, {
    provider: 'fixture', model: 'reasoner', version: 'v2', source: 'provider-pricing-page', currency: 'USD',
    effectiveFrom: '2026-07-01T00:00:00Z', ratesPerMillion: { input: 3, cachedInput: 1.5, output: 9, reasoning: 5 },
  }]);
  const intelligence = createAICostIntelligence({ pricingCatalog: catalog, now: () => new Date('2026-02-01T00:00:00Z') });
  const record = intelligence.recordCall({ model, request, result });
  assert.equal(record.pricingSnapshot.version, 'v1');
  assert.equal(record.calculatedCostUsd, 0.0045);
  assert.equal(Object.isFrozen(record.pricingSnapshot), true);
  assert.equal(catalog.resolve({ provider: 'fixture', model: 'reasoner', occurredAt: '2026-08-01T00:00:00Z' }).version, 'v2');
  assert.equal(record.pricingSnapshot.version, 'v1');
});

test('AR2.10 preserves calculated and provider-reported costs plus reconciliation evidence', () => {
  const intelligence = createAICostIntelligence({ now: () => new Date('2026-08-20T00:00:00Z') });
  const record = intelligence.recordCall({ model: { ...model, inputCostPerMillion: 2, outputCostPerMillion: 8 }, request, result, providerReportedCostUsd: 0.01 });
  assert.equal(record.costSource, 'provider-reported');
  assert.equal(record.providerReportedCostUsd, 0.01);
  assert.equal(record.calculatedCostUsd, 0.0036);
  const reconciliation = intelligence.reconcile({ callId: record.callId, providerCostUsd: 0.012, source: 'provider-invoice' });
  assert.equal(reconciliation.originalEffectiveCostUsd, 0.01);
  assert.equal(reconciliation.providerCostUsd, 0.012);
  assert.equal(intelligence.listCalls()[0].effectiveCostUsd, 0.01);
});

test('AR2.10 router aggregates every escalation call into one request summary and telemetry', async () => {
  const intelligence = createAICostIntelligence();
  const events = [];
  const registry = createModelRegistry(['L1', 'L2'].map((tier) => ({
    id: tier, provider: tier, model: tier, specialties: ['reasoning', 'extraction'], tier,
    supportedReasoningEfforts: ['low', 'medium'], defaultReasoningEffort: 'low', inputCostPerMillion: 1, outputCostPerMillion: 2,
  })));
  const router = createAIRouter({ registry, costIntelligence: intelligence, telemetry: { record(event) { events.push(event); } }, providers: {
    L1: { async generate() { return { text: '{"id":"wrong"}', usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } }; } },
    L2: { async generate() { return { text: '{"id":"item-7"}', usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 } }; } },
  } });
  const routed = await router.route({
    task: 'extraction', reason: 'AR2.10', messages: [{ role: 'user', content: 'item-7' }],
    traceContext: { traceId: 'trace-router-cost', requestId: 'request-router-cost' },
    responseFormat: { jsonSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    validation: { requiredIdentifiers: ['item-7'] },
  });
  assert.equal(routed.accounting.callCount, 2);
  assert.equal(routed.accounting.usage.totalTokens, 35);
  assert.equal(routed.accounting.escalationCallCount, 1);
  assert.equal(events.filter((event) => event.type === 'ai.usage.accounted').length, 2);
  assert.equal(JSON.stringify(events).includes('item-7'), false);
});

test('AR2.10 aggregate views expose tier distribution and escalation efficiency', () => {
  const intelligence = createAICostIntelligence();
  intelligence.recordCall({ model: { ...model, tier: 'L1' }, request, result });
  intelligence.recordCall({ model: { ...model, tier: 'L2' }, request: { ...request, traceContext: { ...request.traceContext, requestId: 'request-2' } }, result, escalationUsed: true });
  const aggregate = intelligence.aggregate();
  assert.equal(aggregate.callCount, 2);
  assert.deepEqual(aggregate.byTier, { L1: 1, L2: 1, L3: 0 });
  assert.equal(aggregate.escalationRate, 0.5);
});
