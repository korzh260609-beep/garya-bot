import { AIConfigurationError } from './errors.js';

function nonNegativeNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new AIConfigurationError('AI model pricing must be a non-negative number');
  return number;
}

export function createModelRegistry(entries = []) {
  const models = new Map();
  for (const entry of entries) {
    if (!entry?.id || !entry?.provider || !entry?.model) throw new TypeError('model entry requires id, provider and model');
    if (models.has(entry.id)) throw new TypeError(`duplicate model id: ${entry.id}`);
    models.set(entry.id, Object.freeze({
      id: entry.id,
      provider: entry.provider,
      model: entry.model,
      specialties: Object.freeze([...(entry.specialties ?? [])]),
      fallbackId: entry.fallbackId ?? null,
      inputCostPerMillion: nonNegativeNumber(entry.inputCostPerMillion),
      outputCostPerMillion: nonNegativeNumber(entry.outputCostPerMillion),
      enabled: entry.enabled !== false
    }));
  }
  return Object.freeze({
    get(id) {
      const model = models.get(id);
      if (!model || !model.enabled) throw new AIConfigurationError(`AI model is not configured or enabled: ${id}`);
      return model;
    },
    select({ specialty, preferredModelId = null }) {
      if (preferredModelId) return this.get(preferredModelId);
      const specialized = [...models.values()].find((entry) => entry.enabled && specialty && entry.specialties.includes(specialty));
      const reasoning = [...models.values()].find((entry) => entry.enabled && entry.specialties.includes('reasoning'));
      if (!specialized && !reasoning) throw new AIConfigurationError('No enabled AI model is available');
      return specialized ?? reasoning;
    },
    list() { return Object.freeze([...models.values()]); }
  });
}

export function createRegistryFromEnvironment(env = process.env) {
  const primaryModel = env.OPENAI_REASONING_MODEL ?? 'gpt-5.1';
  const fallbackModel = env.OPENAI_FALLBACK_MODEL ?? null;
  const entries = [{
    id: 'reasoning-primary',
    provider: 'openai',
    model: primaryModel,
    specialties: ['reasoning', 'semantic-interpretation'],
    fallbackId: fallbackModel ? 'reasoning-fallback' : null,
    inputCostPerMillion: nonNegativeNumber(env.OPENAI_INPUT_COST_PER_MILLION),
    outputCostPerMillion: nonNegativeNumber(env.OPENAI_OUTPUT_COST_PER_MILLION)
  }];
  if (fallbackModel) entries.push({
    id: 'reasoning-fallback',
    provider: 'openai',
    model: fallbackModel,
    specialties: ['reasoning-fallback'],
    inputCostPerMillion: nonNegativeNumber(env.OPENAI_FALLBACK_INPUT_COST_PER_MILLION),
    outputCostPerMillion: nonNegativeNumber(env.OPENAI_FALLBACK_OUTPUT_COST_PER_MILLION)
  });
  return createModelRegistry(entries);
}
