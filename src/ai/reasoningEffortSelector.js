import { AI_REASONING_EFFORTS } from './contracts.js';
import { AIConfigurationError } from './errors.js';

const EFFORT_INDEX = new Map(AI_REASONING_EFFORTS.map((effort, index) => [effort, index]));
const PRIVILEGED_EFFORTS = new Set(['xhigh', 'max']);

function effort(value, field) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (!EFFORT_INDEX.has(normalized)) throw new TypeError(`${field} must be one of: ${AI_REASONING_EFFORTS.join(', ')}`);
  return normalized;
}

function trustedConstraints(policy) {
  if (policy == null) return Object.freeze({ minimum: null, maximum: 'high', source: null });
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('trustedRoutingPolicy must be an object');
  if (policy.source !== 'trusted-sg-policy') throw new TypeError('reasoning effort constraints require trusted-sg-policy source');
  const minimum = effort(policy.minimumReasoningEffort, 'trustedRoutingPolicy.minimumReasoningEffort');
  const maximum = effort(policy.maximumReasoningEffort, 'trustedRoutingPolicy.maximumReasoningEffort') ?? 'high';
  if (minimum && EFFORT_INDEX.get(minimum) > EFFORT_INDEX.get(maximum)) {
    throw new TypeError('trusted minimum reasoning effort cannot exceed maximum reasoning effort');
  }
  return Object.freeze({ minimum, maximum, source: policy.source });
}

function baselineRequirement(tier, assessment) {
  const signals = assessment?.signals;
  if (!signals) throw new TypeError('task assessment is required for reasoning effort selection');
  if (tier === 'L1') return Object.freeze({ effort: 'low', reason: 'bounded-low-cost-reasoning' });
  if (tier === 'L3') {
    if (signals.codingDebugging >= 0.8 || signals.evidenceConflict >= 0.8 || signals.reasoningDepth >= 0.85) {
      return Object.freeze({ effort: 'high', reason: 'advanced-intensive-reasoning' });
    }
    return Object.freeze({ effort: 'medium', reason: 'advanced-reasoning' });
  }
  if (signals.reasoningDepth >= 0.65 || signals.complexity >= 0.75 || signals.evidenceConflict >= 0.6) {
    return Object.freeze({ effort: 'medium', reason: 'difficult-general-reasoning' });
  }
  return Object.freeze({ effort: 'low', reason: 'general-efficient-reasoning' });
}

export function createReasoningEffortSelector() {
  return Object.freeze({
    select({ tier, assessment, model, requestedEffort = null, trustedRoutingPolicy = null }) {
      if (!model) throw new TypeError('model is required for reasoning effort selection');
      const baseline = baselineRequirement(tier, assessment);
      const constraints = trustedConstraints(trustedRoutingPolicy);
      const requested = effort(requestedEffort, 'routing.reasoningEffort');
      if (requested && PRIVILEGED_EFFORTS.has(requested) && constraints.source !== 'trusted-sg-policy') {
        throw new TypeError('xhigh/max reasoning effort requires trusted-sg-policy source');
      }
      const required = [baseline.effort, requested, constraints.minimum].filter(Boolean)
        .sort((left, right) => EFFORT_INDEX.get(right) - EFFORT_INDEX.get(left))[0];
      if (EFFORT_INDEX.get(required) > EFFORT_INDEX.get(constraints.maximum)) {
        throw new AIConfigurationError('Maximum reasoning effort is below the minimum reliable effort');
      }

      const supported = model.supportedReasoningEfforts ?? [];
      if (supported.length === 0) {
        return Object.freeze({
          version: 'AR2.7', requiredEffort: required, effort: null, reason: 'legacy-model-effort-unconfigured',
          modelId: model.id, policySource: constraints.source, maximumEffort: constraints.maximum,
        });
      }
      const selected = [...supported]
        .filter((candidate) => EFFORT_INDEX.get(candidate) >= EFFORT_INDEX.get(required)
          && EFFORT_INDEX.get(candidate) <= EFFORT_INDEX.get(constraints.maximum))
        .sort((left, right) => EFFORT_INDEX.get(left) - EFFORT_INDEX.get(right))[0];
      if (!selected) throw new AIConfigurationError(`AI model ${model.id} does not support the required reasoning effort: ${required}`);
      return Object.freeze({
        version: 'AR2.7', requiredEffort: required, effort: selected,
        reason: selected === required ? baseline.reason : 'lowest-supported-sufficient-effort',
        modelId: model.id, policySource: constraints.source, maximumEffort: constraints.maximum,
      });
    },
  });
}
