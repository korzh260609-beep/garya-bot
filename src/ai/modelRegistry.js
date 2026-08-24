import { AIConfigurationError } from './errors.js';
import { AI_REASONING_EFFORTS, AI_ROUTING_TIERS } from './contracts.js';

const MODEL_TIERS = Object.freeze(AI_ROUTING_TIERS.filter((tier) => tier !== 'L0'));
const tierIndex = (tier) => MODEL_TIERS.indexOf(tier);

function nonNegativeNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new AIConfigurationError('AI model pricing must be a non-negative number');
  return number;
}

function nonNegativeInteger(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new AIConfigurationError('AI model priority must be a non-negative integer');
  return number;
}

function stringList(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new AIConfigurationError(`${field} must be an array`);
  const normalized = value.map((entry) => String(entry ?? '').trim());
  if (normalized.some((entry) => !entry)) throw new AIConfigurationError(`${field} must contain non-empty strings`);
  return Object.freeze([...new Set(normalized)]);
}

function modelTier(value) {
  const tier = String(value ?? 'L2').trim().toUpperCase();
  if (!MODEL_TIERS.includes(tier)) throw new AIConfigurationError(`AI model tier must be one of: ${MODEL_TIERS.join(', ')}`);
  return tier;
}

function supportedReasoningEfforts(value) {
  const efforts = stringList(value, 'AI model supported reasoning efforts');
  if (efforts.some((effort) => !AI_REASONING_EFFORTS.includes(effort))) {
    throw new AIConfigurationError(`AI model reasoning effort must be one of: ${AI_REASONING_EFFORTS.join(', ')}`);
  }
  return efforts;
}

function commaSeparated(value) {
  if (value == null || String(value).trim() === '') return [];
  return String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function createModelRegistry(entries = []) {
  const models = new Map();
  for (const entry of entries) {
    if (!entry?.id || !entry?.provider || !entry?.model) throw new TypeError('model entry requires id, provider and model');
    if (models.has(entry.id)) throw new TypeError(`duplicate model id: ${entry.id}`);
    const efforts = supportedReasoningEfforts(entry.supportedReasoningEfforts);
    const defaultReasoningEffort = entry.defaultReasoningEffort == null || entry.defaultReasoningEffort === ''
      ? null
      : String(entry.defaultReasoningEffort).trim();
    if (defaultReasoningEffort && !efforts.includes(defaultReasoningEffort)) {
      throw new AIConfigurationError('AI model default reasoning effort must be included in supported reasoning efforts');
    }
    models.set(entry.id, Object.freeze({
      id: entry.id,
      provider: entry.provider,
      model: entry.model,
      specialties: Object.freeze([...(entry.specialties ?? [])]),
      tier: modelTier(entry.tier),
      capabilities: stringList(entry.capabilities, 'AI model capabilities'),
      supportedReasoningEfforts: efforts,
      defaultReasoningEffort,
      priority: nonNegativeInteger(entry.priority),
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
    select({ specialty, preferredModelId = null, requiredTier = null, requiredCapabilities = [] }) {
      const normalizedTier = requiredTier == null ? null : modelTier(requiredTier);
      const capabilities = stringList(requiredCapabilities, 'required AI capabilities');
      const isEligible = (entry) => entry.enabled
        && (!normalizedTier || tierIndex(entry.tier) >= tierIndex(normalizedTier))
        && capabilities.every((capability) => entry.capabilities.includes(capability));
      if (preferredModelId) {
        const preferred = this.get(preferredModelId);
        if (!isEligible(preferred)) throw new AIConfigurationError(`Preferred AI model does not satisfy required tier/capabilities: ${preferredModelId}`);
        return preferred;
      }
      const eligible = [...models.values()].filter(isEligible)
        .sort((left, right) => {
          if (normalizedTier && tierIndex(left.tier) !== tierIndex(right.tier)) return tierIndex(left.tier) - tierIndex(right.tier);
          if (left.priority !== right.priority) return right.priority - left.priority;
          return (left.inputCostPerMillion + left.outputCostPerMillion) - (right.inputCostPerMillion + right.outputCostPerMillion);
        });
      const specialized = eligible.find((entry) => specialty && entry.specialties.includes(specialty));
      const reasoning = eligible.find((entry) => entry.specialties.includes('reasoning'));
      if (!specialized && !reasoning) throw new AIConfigurationError('No enabled AI model satisfies required tier, specialty and capabilities');
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
    tier: env.OPENAI_REASONING_TIER ?? 'L2',
    capabilities: commaSeparated(env.OPENAI_REASONING_CAPABILITIES),
    supportedReasoningEfforts: commaSeparated(env.OPENAI_REASONING_EFFORTS ?? 'low,medium,high'),
    defaultReasoningEffort: env.OPENAI_DEFAULT_REASONING_EFFORT ?? 'low',
    priority: nonNegativeInteger(env.OPENAI_REASONING_PRIORITY),
    fallbackId: fallbackModel ? 'reasoning-fallback' : null,
    inputCostPerMillion: nonNegativeNumber(env.OPENAI_INPUT_COST_PER_MILLION),
    outputCostPerMillion: nonNegativeNumber(env.OPENAI_OUTPUT_COST_PER_MILLION)
  }];
  if (fallbackModel) entries.push({
    id: 'reasoning-fallback',
    provider: 'openai',
    model: fallbackModel,
    specialties: ['reasoning-fallback'],
    tier: env.OPENAI_FALLBACK_TIER ?? env.OPENAI_REASONING_TIER ?? 'L2',
    capabilities: commaSeparated(env.OPENAI_FALLBACK_CAPABILITIES),
    supportedReasoningEfforts: commaSeparated(env.OPENAI_FALLBACK_REASONING_EFFORTS ?? env.OPENAI_REASONING_EFFORTS ?? 'low,medium,high'),
    defaultReasoningEffort: env.OPENAI_FALLBACK_DEFAULT_REASONING_EFFORT ?? env.OPENAI_DEFAULT_REASONING_EFFORT ?? 'low',
    priority: nonNegativeInteger(env.OPENAI_FALLBACK_PRIORITY),
    inputCostPerMillion: nonNegativeNumber(env.OPENAI_FALLBACK_INPUT_COST_PER_MILLION),
    outputCostPerMillion: nonNegativeNumber(env.OPENAI_FALLBACK_OUTPUT_COST_PER_MILLION)
  });
  return createModelRegistry(entries);
}
