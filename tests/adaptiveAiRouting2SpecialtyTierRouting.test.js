import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createAIRouter } from '../src/ai/router.js';
import { AIConfigurationError, AIProviderError } from '../src/ai/errors.js';

function entry(id, tier, specialties, capabilities = [], priority = 0, cost = 0) {
  return { id, provider: id, model: `${id}-model`, tier, specialties, capabilities, priority, inputCostPerMillion: cost };
}

test('AR2.6 selects the lowest sufficient tier before priority and cost', () => {
  const registry = createModelRegistry([
    entry('l3-high', 'L3', ['reasoning'], ['code'], 100, 1),
    entry('l2-expensive', 'L2', ['reasoning'], ['code'], 5, 20),
    entry('l2-cheap', 'L2', ['reasoning'], ['code'], 5, 2),
    entry('l1', 'L1', ['reasoning'], ['code'], 1000, 0)
  ]);
  assert.equal(registry.select({ specialty: 'reasoning', requiredTier: 'L2', requiredCapabilities: ['code'] }).id, 'l2-cheap');
  assert.equal(registry.select({ specialty: 'reasoning', requiredTier: 'L3', requiredCapabilities: ['code'] }).id, 'l3-high');
});

test('AR2.6 specialty precedes generic reasoning inside eligible models', () => {
  const registry = createModelRegistry([
    entry('generic', 'L2', ['reasoning'], ['extract'], 100),
    entry('specialized', 'L2', ['semantic-interpretation'], ['extract'], 1)
  ]);
  assert.equal(registry.select({ specialty: 'semantic-interpretation', requiredTier: 'L1', requiredCapabilities: ['extract'] }).id, 'specialized');
});

test('AR2.6 fails closed when no model satisfies tier or capabilities', () => {
  const registry = createModelRegistry([entry('l2', 'L2', ['reasoning'], ['summary'])]);
  assert.throws(() => registry.select({ specialty: 'reasoning', requiredTier: 'L3' }), AIConfigurationError);
  assert.throws(() => registry.select({ specialty: 'reasoning', requiredTier: 'L2', requiredCapabilities: ['code'] }), AIConfigurationError);
});

test('AR2.6 preferred model cannot bypass tier or capability requirements', () => {
  const registry = createModelRegistry([
    entry('weak', 'L1', ['reasoning'], []), entry('strong', 'L3', ['reasoning'], ['code'])
  ]);
  assert.throws(() => registry.select({ preferredModelId: 'weak', requiredTier: 'L3', requiredCapabilities: ['code'] }), /does not satisfy/);
});

test('AR2.6 router uses selected tier and preserves requirements across provider fallback', async () => {
  const registry = createModelRegistry([
    { ...entry('primary', 'L3', ['reasoning'], ['code']), fallbackId: 'fallback' },
    entry('fallback', 'L3', ['reasoning-fallback'], ['code'])
  ]);
  const router = createAIRouter({
    registry, maxRetries: 0,
    providers: {
      primary: { async generate() { throw new AIProviderError('down'); } },
      fallback: { async generate() { return { text: 'fallback-ok' }; } }
    }
  });
  const result = await router.route({
    task: 'analysis', specialty: 'reasoning', reason: 'AR2.6 integration',
    routing: { requiredCapabilities: ['code'] }, taskAssessmentSignals: { codingDebugging: 1 },
    messages: [{ role: 'user', content: 'debug' }],
    traceContext: { traceId: 'trace-ar26', requestId: 'request-ar26' }
  });
  assert.equal(result.model, 'fallback-model');
  assert.equal(result.tier, 'L3');
  assert.equal(result.fallbackUsed, true);
});
