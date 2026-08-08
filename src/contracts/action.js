const ACTION_CLASSES = Object.freeze([
  'read-only',
  'analysis-only',
  'prepare-only',
  'state-changing',
  'external-action',
  'private-data',
  'expensive-costly'
]);

const GATE_OUTCOMES = Object.freeze([
  'allow',
  'deny',
  'require-confirmation',
  'downgrade-to-prepare',
  'downgrade-to-analysis'
]);

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value;
}
function finiteNonNegative(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return number;
}
function resourceRequirement(value) {
  if (value == null) return null;
  const input = requireObject(value, 'resourceRequirement');
  return Object.freeze({ resourceId: requireNonEmptyString(input.resourceId, 'resourceRequirement.resourceId'), relation: requireNonEmptyString(input.relation, 'resourceRequirement.relation') });
}
function resourceAuthority(value) {
  if (value == null) return null;
  const input = requireObject(value, 'resourceAuthority');
  return Object.freeze({
    allowed: input.allowed === true,
    reason: input.reason ?? null,
    actorGlobalUserId: input.actorGlobalUserId ?? null,
    projectScope: input.projectScope ?? null,
    resourceId: input.resourceId ?? null,
    requiredRelation: input.requiredRelation ?? null,
    evidence: input.evidence ? Object.freeze({ ...input.evidence }) : null
  });
}

export { ACTION_CLASSES, GATE_OUTCOMES };

export function createActionRequest(input) {
  requireObject(input, 'action request');
  const actionClass = requireNonEmptyString(input.actionClass, 'actionClass');
  if (!ACTION_CLASSES.includes(actionClass)) throw new TypeError(`Unsupported actionClass: ${actionClass}`);
  const actor = requireObject(input.actor, 'actor');
  const scope = requireObject(input.scope, 'scope');
  const traceContext = requireObject(input.traceContext, 'traceContext');

  return Object.freeze({
    capability: requireNonEmptyString(input.capability, 'capability'),
    actionType: requireNonEmptyString(input.actionType, 'actionType'),
    actionClass,
    actor: Object.freeze({
      globalUserId: requireNonEmptyString(actor.globalUserId, 'actor.globalUserId'),
      roles: Object.freeze([...(actor.roles ?? [])]),
      grants: Object.freeze([...(actor.grants ?? [])]),
      authenticationLevel: actor.authenticationLevel ?? 'unknown'
    }),
    scope: Object.freeze({
      userScope: requireNonEmptyString(scope.userScope, 'scope.userScope'),
      projectScope: requireNonEmptyString(scope.projectScope, 'scope.projectScope'),
      groupScope: scope.groupScope ?? null,
      threadScope: scope.threadScope ?? null,
      requestedUserScope: input.requestedScope?.userScope ?? scope.userScope,
      requestedProjectScope: input.requestedScope?.projectScope ?? scope.projectScope,
      requestedGroupScope: input.requestedScope?.groupScope ?? scope.groupScope,
      requestedThreadScope: input.requestedScope?.threadScope ?? scope.threadScope,
      allowedCapabilities: Object.freeze([...(scope.allowedCapabilities ?? [])])
    }),
    payload: Object.freeze({ ...(input.payload ?? {}) }),
    requiredPermission: input.requiredPermission ?? `capability:${input.capability}`,
    requiredSources: Object.freeze([...(input.requiredSources ?? [])]),
    requiredTools: Object.freeze([...(input.requiredTools ?? [])]),
    resourceRequirement: resourceRequirement(input.resourceRequirement),
    resourceAuthority: resourceAuthority(input.resourceAuthority),
    risk: input.risk ?? 'low',
    estimatedCostUsd: finiteNonNegative(input.estimatedCostUsd, 'estimatedCostUsd'),
    confirmationRequired: Boolean(input.confirmationRequired),
    confirmation: input.confirmation ? Object.freeze({ ...input.confirmation }) : null,
    idempotencyKey: input.idempotencyKey ?? null,
    traceContext: Object.freeze({ traceId: requireNonEmptyString(traceContext.traceId, 'traceContext.traceId'), requestId: requireNonEmptyString(traceContext.requestId, 'traceContext.requestId') })
  });
}

export function createGateDecision(input) {
  requireObject(input, 'gate decision');
  const outcome = requireNonEmptyString(input.outcome, 'outcome');
  if (!GATE_OUTCOMES.includes(outcome)) throw new TypeError(`Unsupported gate outcome: ${outcome}`);
  return Object.freeze({
    outcome,
    authorized: outcome === 'allow',
    executionPerformed: false,
    actionRequest: input.actionRequest,
    effectiveActionClass: requireNonEmptyString(input.effectiveActionClass, 'effectiveActionClass'),
    reasons: Object.freeze([...(input.reasons ?? [])]),
    checks: Object.freeze({ ...(input.checks ?? {}) }),
    requiresConfirmation: outcome === 'require-confirmation',
    audit: Object.freeze({ traceId: input.actionRequest.traceContext.traceId, requestId: input.actionRequest.traceContext.requestId, gate: 'sg-action-gate-v1', evaluatedAt: input.evaluatedAt ?? null })
  });
}

export function createActionRequestFromDecision({ decisionEnvelope, identityContext, scopeContext, overrides = {} }) {
  if (!decisionEnvelope?.selectedAction) throw new TypeError('decisionEnvelope.selectedAction is required');
  if (!identityContext) throw new TypeError('identityContext is required');
  if (!scopeContext) throw new TypeError('scopeContext is required');
  const selected = decisionEnvelope.selectedAction;
  const actionClassMap = { analysis: 'analysis-only', 'read-only': 'read-only', prepare: 'prepare-only', 'state-change': 'state-changing', external: 'external-action', 'private-data': 'private-data', costly: 'expensive-costly' };
  return createActionRequest({
    capability: overrides.capability ?? selected.name ?? selected.type,
    actionType: overrides.actionType ?? selected.type,
    actionClass: overrides.actionClass ?? actionClassMap[selected.actionClass] ?? 'prepare-only',
    actor: identityContext,
    scope: scopeContext,
    payload: overrides.payload ?? selected.payload ?? {},
    requiredPermission: overrides.requiredPermission,
    requiredSources: overrides.requiredSources,
    requiredTools: overrides.requiredTools,
    resourceRequirement: overrides.resourceRequirement ?? selected.resourceRequirement ?? selected.payload?.resourceRequirement ?? null,
    resourceAuthority: overrides.resourceAuthority ?? null,
    risk: overrides.risk ?? selected.risk,
    estimatedCostUsd: overrides.estimatedCostUsd ?? selected.estimatedCostUsd,
    confirmationRequired: overrides.confirmationRequired ?? selected.confirmationRequired,
    confirmation: overrides.confirmation,
    idempotencyKey: overrides.idempotencyKey,
    requestedScope: overrides.requestedScope,
    traceContext: { traceId: decisionEnvelope.traceId, requestId: decisionEnvelope.requestId }
  });
}
