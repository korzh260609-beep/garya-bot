function requireMethod(value, method, name) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${name}.${method} is required`);
  return value;
}

export function createFeatureFlaggedCapabilityExecutor({ executor, featureFlags } = {}) {
  requireMethod(executor, 'execute', 'executor');
  requireMethod(featureFlags, 'resolve', 'featureFlags');
  if (!featureFlags.store?.get) throw new TypeError('featureFlags.store.get is required');

  return Object.freeze({
    async execute(input) {
      const actionRequest = input?.actionRequest;
      const gateDecision = input?.gateDecision;
      const traceContext = input?.traceContext ?? null;
      const capability = actionRequest?.capability;
      if (!capability) return executor.execute(input);

      const featureId = `capability:${capability}`;
      const configured = await featureFlags.store.get(featureId);
      if (!configured) return executor.execute(input);

      const scope = actionRequest.scopeContext ?? actionRequest.scope ?? {};
      const identity = actionRequest.identityContext ?? actionRequest.actor ?? {};
      const authorityRequired = Boolean(actionRequest.resourceRequirement);
      const authoritySatisfied = !authorityRequired || gateDecision?.checks?.resourceAuthority === true;
      const decision = await featureFlags.resolve(featureId, {
        environment: traceContext?.environment ?? null,
        projectScope: scope.projectScope ?? null,
        globalUserId: identity.globalUserId ?? null,
        roles: identity.roles ?? [],
        resourceId: actionRequest.resourceRequirement?.resourceId ?? null,
        cohorts: actionRequest.payload?.featureCohorts ?? [],
        subjectKey: identity.globalUserId ?? actionRequest.resourceRequirement?.resourceId ?? scope.projectScope ?? 'anonymous',
        permissionSatisfied: gateDecision?.checks?.permission === true,
        authoritySatisfied,
        actionGateSatisfied: gateDecision?.outcome === 'allow',
        traceContext
      });

      if (!decision.enabled) {
        return Object.freeze({
          capability,
          status: 'unavailable',
          data: Object.freeze({ message: 'Feature is not available for this rollout context.', featureId, featureDecision: decision }),
          warnings: Object.freeze(['feature-disabled']),
          sources: Object.freeze([]), tools: Object.freeze([]), costUsd: 0, durationMs: 0, attempts: 0,
          error: Object.freeze({ code: 'feature-disabled', retryable: false })
        });
      }
      return executor.execute(input);
    }
  });
}
