import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRegistry, createRegistryFromEnvironment } from '../src/ai/modelRegistry.js';
import { AIConfigurationError } from '../src/ai/errors.js';

test('AR2.2 registry exposes tier capabilities reasoning-effort and priority metadata', () => {
  const registry = createModelRegistry([{
    id: 'bounded', provider: 'fixture', model: 'configured-by-provider',
    specialties: ['reasoning'], tier: 'L3', capabilities: ['code', 'tools', 'code'],
    supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high', priority: 20
  }]);

  assert.deepEqual(registry.get('bounded'), {
    id: 'bounded', provider: 'fixture', model: 'configured-by-provider', specialties: ['reasoning'],
    tier: 'L3', capabilities: ['code', 'tools'], supportedReasoningEfforts: ['low', 'high'],
    defaultReasoningEffort: 'high', priority: 20, fallbackId: null,
    inputCostPerMillion: 0, outputCostPerMillion: 0, enabled: true
  });
});

test('AR2.2 keeps legacy entries compatible and uses priority only inside existing specialty selection', () => {
  const registry = createModelRegistry([
    { id: 'generic', provider: 'fixture', model: 'generic', specialties: ['reasoning'], priority: 100 },
    { id: 'semantic-low', provider: 'fixture', model: 'semantic-low', specialties: ['semantic'], priority: 1 },
    { id: 'semantic-high', provider: 'fixture', model: 'semantic-high', specialties: ['semantic'], priority: 2 }
  ]);

  assert.equal(registry.get('generic').tier, 'L2');
  assert.deepEqual(registry.get('generic').capabilities, []);
  assert.equal(registry.select({ specialty: 'semantic' }).id, 'semantic-high');
  assert.equal(registry.select({ specialty: 'unknown' }).id, 'generic');
});

test('AR2.2 rejects L0 model entries and inconsistent reasoning-effort configuration', () => {
  assert.throws(
    () => createModelRegistry([{ id: 'bad', provider: 'fixture', model: 'bad', tier: 'L0' }]),
    AIConfigurationError
  );
  assert.throws(
    () => createModelRegistry([{
      id: 'bad-effort', provider: 'fixture', model: 'bad',
      supportedReasoningEfforts: ['low'], defaultReasoningEffort: 'high'
    }]),
    /must be included/
  );
});

test('AR2.2 production registry reads model-independent metadata from configuration', () => {
  const registry = createRegistryFromEnvironment({
    OPENAI_REASONING_MODEL: 'provider-model', OPENAI_REASONING_TIER: 'L1',
    OPENAI_REASONING_CAPABILITIES: 'classification, extraction',
    OPENAI_REASONING_EFFORTS: 'none, low', OPENAI_DEFAULT_REASONING_EFFORT: 'low',
    OPENAI_REASONING_PRIORITY: '7'
  });
  const model = registry.get('reasoning-primary');
  assert.equal(model.tier, 'L1');
  assert.deepEqual(model.capabilities, ['classification', 'extraction']);
  assert.deepEqual(model.supportedReasoningEfforts, ['none', 'low']);
  assert.equal(model.defaultReasoningEffort, 'low');
  assert.equal(model.priority, 7);
});
