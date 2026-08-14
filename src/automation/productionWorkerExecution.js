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

function validateSelfNotification(request) {
  const payload = request?.payload;
  const delivery = payload?.delivery;
  const target = delivery?.originTarget;
  const actorGlobalUserId = String(request?.actorGlobalUserId ?? '').trim();
  const projectScope = String(request?.projectScope ?? '').trim();
  if (payload?.automation?.source !== 'canonical-user-request' || payload?.automation?.capability !== 'task-create') return 'automation-provenance-invalid';
  if (!actorGlobalUserId || delivery?.recipientGlobalUserId !== actorGlobalUserId) return 'self-notification-recipient-mismatch';
  if (!projectScope || delivery?.projectScope !== projectScope) return 'self-notification-project-mismatch';
  if (delivery?.originBoundSelfNotification !== true) return 'self-notification-origin-binding-missing';
  if (!target || typeof target.transport !== 'string' || typeof target.address !== 'string' || !target.transport.trim() || !target.address.trim()) return 'self-notification-target-invalid';
  if (typeof payload?.message !== 'string' || payload.message.trim() === '') return 'self-notification-message-invalid';
  return null;
}

export function createProductionWorkerActionGate({ verifyMode = false, ownerSecurityGateway = null } = {}) {
  return async function productionWorkerActionGate(request) {
    if (verifyMode) return Object.freeze({ outcome: 'allow', allowed: true, reason: 'worker-verification' });

    const normalizedKind = taskKind(request?.kind);
    if (normalizedKind === 'self-notification') {
      const reason = validateSelfNotification(request);
      return reason
        ? Object.freeze({ outcome: 'deny', allowed: false, reason })
        : Object.freeze({ outcome: 'allow', allowed: true, reason: 'registered-origin-bound-self-notification' });
    }

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
      reason: `Protected automated execution is not registered for task kind: ${normalizedKind}`
    });
  };
}

export function createProductionWorkerExecutor({ verifyMode = false, deliveryRouter = null } = {}) {
  if (deliveryRouter !== null && typeof deliveryRouter?.route !== 'function') throw new TypeError('deliveryRouter.route is required');
  return async function productionWorkerExecutor({ taskId, kind, payload, attempt, idempotencyKey, traceContext, scope } = {}) {
    const normalizedKind = taskKind(kind);
    if (verifyMode) return Object.freeze({ verified: true, taskId, kind: normalizedKind, attempt, payload });

    if (normalizedKind === 'self-notification') {
      if (!deliveryRouter?.route) {
        const error = new Error('Delivery Router is unavailable for self notification');
        error.code = 'automation-delivery-router-unavailable';
        error.retryable = true;
        throw error;
      }
      const reason = validateSelfNotification({
        kind: normalizedKind,
        payload,
        actorGlobalUserId: scope?.globalUserId,
        projectScope: scope?.projectScope
      });
      if (reason) {
        const error = new Error(reason);
        error.code = reason;
        error.retryable = false;
        throw error;
      }
      const result = await deliveryRouter.route({
        kind: 'notification',
        actorGlobalUserId: scope.globalUserId,
        recipientGlobalUserId: payload.delivery.recipientGlobalUserId,
        projectScope: scope.projectScope,
        message: payload.message,
        originTarget: payload.delivery.originTarget,
        explicitTarget: false,
        idempotencyKey: `automation-delivery:${taskId}`,
        locale: payload.delivery.locale ?? null,
        traceContext,
        metadata: {
          originBoundSelfNotification: true,
          automationTaskId: taskId,
          automationAttempt: attempt,
          taskIdempotencyKey: idempotencyKey ?? null,
          recurrence: payload.recurrence ?? null
        }
      });
      if (result.status !== 'delivered') {
        const error = new Error(`Automated notification delivery did not complete: ${result.failureCode ?? result.status}`);
        error.code = result.failureCode ?? `automation-delivery-${result.status}`;
        error.retryable = result.retryable === true;
        throw error;
      }
      return Object.freeze({ status: 'completed', taskId, kind: normalizedKind, attempt, delivery: result });
    }

    if (normalizedKind === 'user-task') {
      return Object.freeze({ status: 'completed', taskId, kind: normalizedKind, attempt, acknowledged: true });
    }

    const error = new Error(`No production executor registered for task kind: ${normalizedKind}`);
    error.code = 'unsupported-production-task-kind';
    throw error;
  };
}
