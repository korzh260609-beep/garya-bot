function taskKind(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('task kind is required');
  return value.trim();
}

function ownerSecurityActionRequest(request) {
  const actorGlobalUserId = String(request?.actorGlobalUserId ?? '').trim();
  const projectScope = String(request?.projectScope ?? '').trim();
  if (!actorGlobalUserId || !projectScope) return null;
  return Object.freeze({
    capability: String(request?.payload?.capability ?? request?.kind ?? 'system-automation-admin'),
    actionType: String(request?.payload?.actionType ?? 'automated-execution'),
    actionClass: 'state-changing',
    actor: Object.freeze({
      globalUserId: actorGlobalUserId,
      roles: Object.freeze([...(request?.identityContext?.roles ?? [])]),
      grants: Object.freeze([...(request?.identityContext?.grants ?? [])]),
      authenticationLevel: request?.identityContext?.authenticationLevel ?? 'deferred-verified-link'
    }),
    scope: Object.freeze({
      userScope: actorGlobalUserId,
      projectScope,
      groupScope: request?.groupScope ?? null,
      threadScope: request?.threadScope ?? null,
      requestedUserScope: actorGlobalUserId,
      requestedProjectScope: projectScope,
      requestedGroupScope: request?.groupScope ?? null,
      requestedThreadScope: request?.threadScope ?? null,
      allowedCapabilities: Object.freeze([String(request?.payload?.capability ?? request?.kind ?? 'system-automation-admin')])
    }),
    payload: Object.freeze({
      ...(request?.payload ?? {}),
      ownerOnly: request?.payload?.ownerOnly === true || request?.payload?.securityClass === 'owner-only'
    }),
    requiredPermission: `capability:${String(request?.payload?.capability ?? request?.kind ?? 'system-automation-admin')}`,
    requiredSources: Object.freeze([]),
    requiredTools: Object.freeze([]),
    resourceRequirement: null,
    resourceAuthority: null,
    risk: 'high',
    estimatedCostUsd: 0,
    confirmationRequired: false,
    confirmation: null,
    idempotencyKey: request?.idempotencyKey ?? null,
    traceContext: Object.freeze({ ...(request?.traceContext ?? {}) })
  });
}

export function createProductionWorkerActionGate({ verifyMode = false, ownerSecurityGateway = null } = {}) {
  return async function productionWorkerActionGate(request) {
    if (verifyMode) return Object.freeze({ outcome: 'allow', allowed: true, reason: 'worker-verification' });

    const isOwnerSensitive = request?.payload?.ownerOnly === true
      || request?.payload?.securityClass === 'owner-only'
      || request?.payload?.capability === 'system-automation-admin';

    if (isOwnerSensitive) {
      if (!ownerSecurityGateway?.evaluate) {
        return Object.freeze({ outcome: 'deny', allowed: false, reason: 'owner-security-unavailable' });
      }
      const actionRequest = ownerSecurityActionRequest(request);
      if (!actionRequest) return Object.freeze({ outcome: 'deny', allowed: false, reason: 'deferred-actor-scope-missing' });
      const securityDecision = ownerSecurityGateway.evaluate(actionRequest);
      if (!securityDecision.allowed) {
        return Object.freeze({ outcome: 'deny', allowed: false, reason: securityDecision.reason, ownerSecurityDecision: securityDecision });
      }
    }

    return Object.freeze({
      outcome: 'deny',
      allowed: false,
      reason: `Protected automated execution is not registered for task kind: ${taskKind(request?.kind)}`
    });
  };
}

export function createProductionWorkerExecutor({ verifyMode = false } = {}) {
  return async function productionWorkerExecutor({ taskId, kind, payload, attempt } = {}) {
    const normalizedKind = taskKind(kind);
    if (verifyMode) return Object.freeze({ verified: true, taskId, kind: normalizedKind, attempt, payload });

    if (normalizedKind === 'user-task') {
      return Object.freeze({
        status: 'completed',
        taskId,
        kind: normalizedKind,
        attempt,
        acknowledged: true
      });
    }

    const error = new Error(`No production executor registered for task kind: ${normalizedKind}`);
    error.code = 'unsupported-production-task-kind';
    throw error;
  };
}
