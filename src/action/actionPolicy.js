const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });

export function createActionPolicy(input = {}) {
  const maxAutoRisk = input.maxAutoRisk ?? 'medium';
  if (!(maxAutoRisk in RISK_ORDER)) throw new TypeError('maxAutoRisk must be low, medium, high or critical');
  const maxAutoCostUsd = Number(input.maxAutoCostUsd ?? 0.05);
  if (!Number.isFinite(maxAutoCostUsd) || maxAutoCostUsd < 0) throw new TypeError('maxAutoCostUsd must be non-negative');

  return Object.freeze({
    maxAutoRisk,
    maxAutoCostUsd,
    requireAuthenticatedActor: input.requireAuthenticatedActor ?? true,
    protectedClasses: Object.freeze(input.protectedClasses ?? [
      'state-changing',
      'external-action',
      'private-data',
      'expensive-costly'
    ]),
    confirmationClasses: Object.freeze(input.confirmationClasses ?? [
      'state-changing',
      'external-action',
      'private-data',
      'expensive-costly'
    ]),
    allowMonarchWildcard: input.allowMonarchWildcard ?? true
  });
}

export function compareRisk(left, right) {
  if (!(left in RISK_ORDER)) throw new TypeError(`Unsupported risk: ${left}`);
  if (!(right in RISK_ORDER)) throw new TypeError(`Unsupported risk: ${right}`);
  return RISK_ORDER[left] - RISK_ORDER[right];
}
