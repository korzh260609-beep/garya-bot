const TIERS = Object.freeze(['L1', 'L2', 'L3']);
const MAX_PRIOR_RESULT_CHARACTERS = 6_000;

export function createSemanticEscalationController({ maxPromotions = 2 } = {}) {
  if (!Number.isInteger(maxPromotions) || maxPromotions < 0 || maxPromotions > 2) {
    throw new TypeError('maxPromotions must be an integer between 0 and 2');
  }
  return Object.freeze({
    decide({ result, currentTier, maximumTier = null, promotionCount = 0 }) {
      if (result?.validation?.passed !== false || result.validation.escalationRecommended !== true) {
        return Object.freeze({ escalate: false, reason: 'validation-accepted' });
      }
      if (promotionCount >= maxPromotions) return Object.freeze({ escalate: false, reason: 'promotion-limit-reached' });
      const current = TIERS.indexOf(currentTier);
      const maximum = maximumTier == null ? TIERS.length - 1 : TIERS.indexOf(maximumTier);
      if (current < 0 || maximum < 0) throw new TypeError('semantic escalation requires a valid AI tier');
      if (current >= maximum) return Object.freeze({ escalate: false, reason: 'maximum-tier-reached' });
      const text = String(result.text ?? '');
      return Object.freeze({
        escalate: true, version: 'AR2.9', fromTier: currentTier, toTier: TIERS[current + 1],
        reason: 'deterministic-validation-failed', promotion: promotionCount + 1,
        priorResult: Object.freeze({
          text: text.slice(0, MAX_PRIOR_RESULT_CHARACTERS), truncated: text.length > MAX_PRIOR_RESULT_CHARACTERS,
          validation: result.validation, provider: result.provider, model: result.model, tier: result.tier,
        }),
      });
    },
  });
}
