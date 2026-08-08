import { createDomainRequest, createDomainResult } from './contracts.js';

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function includesAll(actual, required) {
  const set = new Set(actual ?? []);
  return required.every((value) => set.has(value));
}

function canonicalDomainActionClass(capability) {
  return capability.canonicalActionClass ?? (capability.actionClass === 'analysis' ? 'analysis-only' : capability.actionClass === 'protected' ? 'state-changing' : capability.actionClass);
}

function authorizedByCanonicalGate(gateDecision, capability, request) {
  if (gateDecision?.outcome !== 'allow' || gateDecision.authorized !== true) return false;
  const gatedRequest = gateDecision.actionRequest;
  if (!gatedRequest?.actor || !gatedRequest?.scope) return false;
  if (gatedRequest.actor.globalUserId !== request.identityContext.globalUserId) return false;
  if (gatedRequest.scope.projectScope !== request.scopeContext.projectScope) return false;
  if ((gatedRequest.scope.groupScope ?? null) !== (request.scopeContext.groupScope ?? null)) return false;
  if ((gatedRequest.scope.threadScope ?? null) !== (request.scopeContext.threadScope ?? null)) return false;
  if (!capability.stateChanging) return true;
  return ['state-changing', 'external-action', 'private-data', 'expensive-costly'].includes(gatedRequest.actionClass);
}

export function createDomainRuntime({ registry, actionGate = null, sourceResolver, memoryResolver, onEvent = () => {} } = {}) {
  if (!registry || typeof registry.resolve !== 'function') throw new TypeError('registry with resolve() is required');
  if (actionGate != null) requiredFunction(actionGate, 'actionGate');
  requiredFunction(sourceResolver, 'sourceResolver');
  requiredFunction(memoryResolver, 'memoryResolver');
  requiredFunction(onEvent, 'onEvent');

  async function execute(input) {
    const externalGateDecision = input?.gateDecision ?? null;
    const request = createDomainRequest(input);
    const { module, capability } = registry.resolve(request.domainId, request.capability);
    const permissions = request.identityContext.permissions ?? request.identityContext.grants ?? [];
    if (!includesAll(permissions, capability.requiredPermissions)) throw new Error('domain permission denied');

    const sources = await sourceResolver(Object.freeze({
      domainId: module.id,
      capability: capability.name,
      requirements: capability.sourceRequirements,
      identityContext: request.identityContext,
      scopeContext: request.scopeContext,
      traceContext: request.traceContext
    }));
    if (!sources || includesAll(sources.available ?? [], capability.sourceRequirements) === false) throw new Error('domain source unavailable');

    const memory = await memoryResolver(Object.freeze({
      domainId: module.id,
      capability: capability.name,
      layers: capability.memoryLayers,
      identityContext: request.identityContext,
      scopeContext: request.scopeContext,
      traceContext: request.traceContext
    }));

    let gate = externalGateDecision;
    if (gate) {
      if (!authorizedByCanonicalGate(gate, capability, request)) throw new Error('domain action gate denied');
    } else {
      if (!actionGate) throw new Error('domain action gate is required');
      gate = await actionGate(Object.freeze({
        domainId: module.id,
        capability: capability.name,
        actionClass: canonicalDomainActionClass(capability),
        stateChanging: capability.stateChanging,
        requiredPermissions: capability.requiredPermissions,
        identityContext: request.identityContext,
        scopeContext: request.scopeContext,
        traceContext: request.traceContext,
        domainRequest: true
      }));
      if (!gate || (gate.allowed !== true && gate.authorized !== true && gate.outcome !== 'allow')) throw new Error(gate?.reason ?? 'domain action gate denied');
    }

    onEvent(Object.freeze({ type: 'domain.execution.started', domainId: module.id, capability: capability.name, traceContext: request.traceContext }));
    const data = await capability.handler(Object.freeze({
      input: request.input,
      identityContext: request.identityContext,
      scopeContext: request.scopeContext,
      traceContext: request.traceContext,
      sources: sources.data ?? null,
      memory: memory?.data ?? null
    }));
    const result = createDomainResult({ status: 'success', domainId: module.id, capability: capability.name, actionClass: canonicalDomainActionClass(capability), data, traceContext: request.traceContext });
    onEvent(Object.freeze({ type: 'domain.execution.completed', domainId: module.id, capability: capability.name, traceContext: request.traceContext }));
    return result;
  }

  return Object.freeze({ execute });
}
