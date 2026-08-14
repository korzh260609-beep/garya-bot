import { createGateDecision } from '../contracts/action.js';
import { compareRisk, createActionPolicy } from './actionPolicy.js';
import { createInMemoryIdempotencyStore } from './inMemoryIdempotencyStore.js';

function includesWildcard(values, expected) { return values.includes('*') || values.includes(expected); }
function hasPermission(request, policy) {
  if (policy.allowMonarchWildcard && request.actor.roles.includes('monarch')) return true;
  return includesWildcard(request.actor.grants, request.requiredPermission);
}
function scopeMatches(request) {
  const { scope } = request;
  return scope.userScope === scope.requestedUserScope && scope.projectScope === scope.requestedProjectScope && scope.groupScope === scope.requestedGroupScope && scope.threadScope === scope.requestedThreadScope;
}
function availabilityCheck(required, available) { return required.every((name) => includesWildcard(available, name)); }
function hasValidConfirmation(request) { return request.confirmation?.confirmed === true && request.confirmation?.requestId === request.traceContext.requestId; }
function downgradedClass(outcome) { if (outcome === 'downgrade-to-analysis') return 'analysis-only'; if (outcome === 'downgrade-to-prepare') return 'prepare-only'; return null; }
function resourceAuthorityMatches(request) {
  const requirement = request.resourceRequirement;
  if (!requirement) return true;
  const authority = request.resourceAuthority;
  return authority?.allowed === true
    && authority.actorGlobalUserId === request.actor.globalUserId
    && authority.projectScope === request.scope.projectScope
    && authority.resourceId === requirement.resourceId
    && authority.requiredRelation === requirement.relation;
}
function ownerSecurityMatches(request, decision) {
  if (!decision) return true;
  if (decision.ownerOnly !== true) return decision.allowed !== false;
  return decision.allowed === true
    && decision.ownerVerified === true
    && decision.actorGlobalUserId === request.actor.globalUserId
    && decision.projectScope === request.scope.projectScope;
}
function resolvedActionPolicy(basePolicy, policyContext) {
  const configured = policyContext?.policy?.action;
  if (!configured) return basePolicy;
  return createActionPolicy({
    maxAutoRisk: configured.maxAutoRisk,
    maxAutoCostUsd: configured.maxAutoCostUsd,
    requireAuthenticatedActor: configured.requireAuthenticatedActor,
    allowMonarchWildcard: configured.allowMonarchWildcard,
    protectedClasses: basePolicy.protectedClasses,
    confirmationClasses: configured.requireConfirmationForProtected ? basePolicy.confirmationClasses : []
  });
}

export function createActionGate({ policy = createActionPolicy(), availableSources = [], availableTools = [], idempotencyStore = createInMemoryIdempotencyStore(), clock = () => new Date().toISOString() } = {}) {
  if (!idempotencyStore?.has || !idempotencyStore?.reserve) throw new TypeError('idempotencyStore must implement has and reserve');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  return Object.freeze({
    name: 'sg-action-gate-v1',
    evaluate(actionRequest, { policyContext = null, ownerSecurityDecision = null } = {}) {
      if (!actionRequest?.traceContext) throw new TypeError('A validated actionRequest is required');
      const effectivePolicy = resolvedActionPolicy(policy, policyContext);
      const sourcePolicy = policyContext?.policy?.source ?? null;
      const isProtected = effectivePolicy.protectedClasses.includes(actionRequest.actionClass);
      const checks = {
        identity: !effectivePolicy.requireAuthenticatedActor || actionRequest.actor.authenticationLevel !== 'unknown',
        permission: !isProtected || hasPermission(actionRequest, effectivePolicy),
        scope: scopeMatches(actionRequest),
        resourceAuthority: resourceAuthorityMatches(actionRequest),
        ownerSecurity: ownerSecurityMatches(actionRequest, ownerSecurityDecision),
        capability: includesWildcard(actionRequest.scope.allowedCapabilities, actionRequest.capability),
        sources: availabilityCheck(actionRequest.requiredSources, availableSources),
        sourceLimit: !sourcePolicy?.maxSourcesPerRequest || actionRequest.requiredSources.length <= sourcePolicy.maxSourcesPerRequest,
        tools: availabilityCheck(actionRequest.requiredTools, availableTools),
        risk: compareRisk(actionRequest.risk, effectivePolicy.maxAutoRisk) <= 0,
        cost: actionRequest.estimatedCostUsd <= effectivePolicy.maxAutoCostUsd,
        confirmation: hasValidConfirmation(actionRequest),
        idempotency: !actionRequest.idempotencyKey || !idempotencyStore.has(actionRequest.idempotencyKey),
        audit: Boolean(actionRequest.traceContext.traceId && actionRequest.traceContext.requestId)
      };

      const reasons = [];
      let outcome = 'allow';
      if (!checks.identity || !checks.scope || !checks.audit || !checks.resourceAuthority || !checks.ownerSecurity) {
        outcome = 'deny';
        if (!checks.identity) reasons.push('identity-not-authenticated');
        if (!checks.scope) reasons.push('scope-mismatch');
        if (!checks.audit) reasons.push('audit-context-missing');
        if (!checks.resourceAuthority) reasons.push(actionRequest.resourceAuthority?.reason ?? 'resource-authority-denied');
        if (!checks.ownerSecurity) reasons.push(ownerSecurityDecision?.reason ?? 'owner-security-denied');
      } else if (!checks.idempotency) {
        outcome = 'deny'; reasons.push('duplicate-idempotency-key');
      } else if (!checks.capability || !checks.sources || !checks.sourceLimit || !checks.tools) {
        outcome = 'downgrade-to-prepare';
        if (!checks.capability) reasons.push('capability-unavailable');
        if (!checks.sources) reasons.push('source-unavailable');
        if (!checks.sourceLimit) reasons.push('source-policy-limit-exceeded');
        if (!checks.tools) reasons.push('tool-unavailable');
      } else if (!checks.permission) {
        outcome = 'downgrade-to-prepare'; reasons.push('permission-denied');
      } else if (!checks.risk && actionRequest.risk === 'critical') {
        outcome = 'deny'; reasons.push('critical-risk');
      } else if (!checks.risk || !checks.cost || actionRequest.confirmationRequired || effectivePolicy.confirmationClasses.includes(actionRequest.actionClass)) {
        if (!checks.confirmation) {
          outcome = 'require-confirmation';
          if (!checks.risk) reasons.push('risk-confirmation-required');
          if (!checks.cost) reasons.push('cost-confirmation-required');
          if (actionRequest.confirmationRequired || effectivePolicy.confirmationClasses.includes(actionRequest.actionClass)) reasons.push('action-confirmation-required');
        }
      }

      if (outcome === 'allow' && actionRequest.idempotencyKey) {
        const reserved = idempotencyStore.reserve(actionRequest.idempotencyKey, { traceId: actionRequest.traceContext.traceId, requestId: actionRequest.traceContext.requestId, capability: actionRequest.capability });
        if (!reserved) { outcome = 'deny'; reasons.push('duplicate-idempotency-key'); checks.idempotency = false; }
      }
      return createGateDecision({ outcome, effectiveActionClass: downgradedClass(outcome) ?? actionRequest.actionClass, actionRequest, reasons, checks, evaluatedAt: clock() });
    }
  });
}
