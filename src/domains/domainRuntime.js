import { createDomainRequest, createDomainResult } from './contracts.js';

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function includesAll(actual, required) {
  const set = new Set(actual ?? []);
  return required.every((value) => set.has(value));
}

export function createDomainRuntime({ registry, actionGate, sourceResolver, memoryResolver, onEvent = () => {} } = {}) {
  if (!registry || typeof registry.resolve !== 'function') throw new TypeError('registry with resolve() is required');
  requiredFunction(actionGate, 'actionGate');
  requiredFunction(sourceResolver, 'sourceResolver');
  requiredFunction(memoryResolver, 'memoryResolver');
  requiredFunction(onEvent, 'onEvent');

  async function execute(input) {
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

    const gate = await actionGate(Object.freeze({
      domainId: module.id,
      capability: capability.name,
      actionClass: capability.actionClass,
      stateChanging: capability.stateChanging,
      requiredPermissions: capability.requiredPermissions,
      identityContext: request.identityContext,
      scopeContext: request.scopeContext,
      traceContext: request.traceContext,
      domainRequest: true
    }));
    if (!gate || gate.allowed !== true) throw new Error(gate?.reason ?? 'domain action gate denied');

    onEvent(Object.freeze({ type: 'domain.execution.started', domainId: module.id, capability: capability.name, traceContext: request.traceContext }));
    const data = await capability.handler(Object.freeze({
      input: request.input,
      identityContext: request.identityContext,
      scopeContext: request.scopeContext,
      traceContext: request.traceContext,
      sources: sources.data ?? null,
      memory: memory?.data ?? null
    }));
    const result = createDomainResult({ status: 'success', domainId: module.id, capability: capability.name, actionClass: capability.actionClass, data, traceContext: request.traceContext });
    onEvent(Object.freeze({ type: 'domain.execution.completed', domainId: module.id, capability: capability.name, traceContext: request.traceContext }));
    return result;
  }

  return Object.freeze({ execute });
}
