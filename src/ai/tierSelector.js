const MODEL_TIERS = Object.freeze(['L1', 'L2', 'L3']);
const LOW_COST_TASK_CLASSES = new Set([
  'language-detection', 'semantic-interpretation', 'classification', 'extraction', 'normalization', 'lightweight-ranking'
]);

const DEFAULT_WEIGHTS = Object.freeze({
  complexity: 0.2,
  reasoningDepth: 0.25,
  risk: 0.15,
  ambiguity: 0.1,
  toolDepth: 0.1,
  contextPressure: 0.05,
  evidenceSources: 0.05,
  evidenceConflict: 0.05,
  codingDebugging: 0.05,
});

function tier(value, field) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toUpperCase();
  if (!MODEL_TIERS.includes(normalized)) throw new TypeError(`${field} must be one of: ${MODEL_TIERS.join(', ')}`);
  return normalized;
}

function tierIndex(value) { return MODEL_TIERS.indexOf(value); }

function normalizedWeights(value) {
  const weights = { ...DEFAULT_WEIGHTS, ...(value ?? {}) };
  const unknown = Object.keys(weights).filter((key) => !(key in DEFAULT_WEIGHTS));
  if (unknown.length > 0) throw new TypeError(`unknown tier weight: ${unknown[0]}`);
  for (const [key, weight] of Object.entries(weights)) {
    if (!Number.isFinite(Number(weight)) || Number(weight) < 0) throw new TypeError(`tier weight ${key} must be non-negative`);
    weights[key] = Number(weight);
  }
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) throw new TypeError('tier weights must have a positive total');
  return Object.freeze(Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, weight / total])));
}

function trustedConstraints(policy) {
  if (policy == null) return Object.freeze({ minimumTier: null, maximumTier: null, source: null });
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('trustedRoutingPolicy must be an object');
  if (policy.source !== 'trusted-sg-policy') throw new TypeError('tier constraints require trusted-sg-policy source');
  const minimumTier = tier(policy.minimumTier, 'trustedRoutingPolicy.minimumTier');
  const maximumTier = tier(policy.maximumTier, 'trustedRoutingPolicy.maximumTier');
  if (minimumTier && maximumTier && tierIndex(minimumTier) > tierIndex(maximumTier)) {
    throw new TypeError('trusted minimum tier cannot exceed maximum tier');
  }
  return Object.freeze({ minimumTier, maximumTier, source: policy.source });
}

export function createTierSelector({ weights = null, advancedThreshold = 0.7, lowCostCeiling = 0.45 } = {}) {
  const normalized = normalizedWeights(weights);
  if (!(advancedThreshold > 0 && advancedThreshold <= 1)) throw new TypeError('advancedThreshold must be in (0,1]');
  if (!(lowCostCeiling >= 0 && lowCostCeiling < advancedThreshold)) throw new TypeError('lowCostCeiling must be below advancedThreshold');

  return Object.freeze({
    select({ taskClass, assessment, trustedRoutingPolicy = null }) {
      if (!assessment?.signals) throw new TypeError('task assessment is required for tier selection');
      const score = Object.entries(normalized).reduce((sum, [key, weight]) => sum + assessment.signals[key] * weight, 0);
      const constraints = trustedConstraints(trustedRoutingPolicy);
      let selectedTier = 'L2';
      let reason = 'general-reliable-default';
      if (score >= advancedThreshold || assessment.signals.codingDebugging >= 0.8 || assessment.signals.evidenceConflict >= 0.8) {
        selectedTier = 'L3';
        reason = 'advanced-reasoning-required';
      } else if (LOW_COST_TASK_CLASSES.has(String(taskClass)) && score <= lowCostCeiling) {
        selectedTier = 'L1';
        reason = 'bounded-low-cost-task';
      }
      if (constraints.minimumTier && tierIndex(selectedTier) < tierIndex(constraints.minimumTier)) {
        selectedTier = constraints.minimumTier;
        reason = 'trusted-minimum-tier';
      }
      if (constraints.maximumTier && tierIndex(selectedTier) > tierIndex(constraints.maximumTier)) {
        throw new TypeError('trusted maximum tier is below the minimum reliable tier');
      }
      return Object.freeze({
        version: 'AR2.5', tier: selectedTier, score: Number(score.toFixed(6)), reason,
        minimumTier: constraints.minimumTier, maximumTier: constraints.maximumTier,
        policySource: constraints.source,
      });
    }
  });
}
