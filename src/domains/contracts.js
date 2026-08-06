function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function stringList(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze(value.map((item) => requiredString(item, `${field} item`)));
}

export const DOMAIN_ACTION_CLASSES = Object.freeze(['analysis', 'prepare-only', 'protected']);

export function createDomainCapability(input) {
  object(input, 'domain capability');
  const name = requiredString(input.name, 'capability.name');
  const actionClass = input.actionClass ?? 'analysis';
  if (!DOMAIN_ACTION_CLASSES.includes(actionClass)) throw new TypeError(`unsupported domain action class: ${actionClass}`);
  if (typeof input.handler !== 'function') throw new TypeError('capability.handler must be a function');
  return Object.freeze({
    name,
    actionClass,
    stateChanging: actionClass === 'protected',
    requiredPermissions: stringList(input.requiredPermissions ?? [], 'capability.requiredPermissions'),
    sourceRequirements: stringList(input.sourceRequirements ?? [], 'capability.sourceRequirements'),
    memoryLayers: stringList(input.memoryLayers ?? [], 'capability.memoryLayers'),
    handler: input.handler
  });
}

export function createDomainModule(input) {
  object(input, 'domain module');
  const id = requiredString(input.id, 'domain.id');
  const capabilities = Object.freeze((input.capabilities ?? []).map(createDomainCapability));
  if (capabilities.length === 0) throw new TypeError('domain.capabilities must not be empty');
  for (const capability of capabilities) {
    if (!capability.name.startsWith(`${id}.`)) throw new TypeError(`capability must be namespaced by domain ${id}`);
  }
  return Object.freeze({
    id,
    version: requiredString(input.version ?? '1.0.0', 'domain.version'),
    description: requiredString(input.description, 'domain.description'),
    capabilities,
    replaceable: true,
    ownsSemanticKernel: false,
    ownsIdentity: false,
    ownsActionGate: false,
    ownsTrustOrder: false
  });
}

export function createDomainRequest(input) {
  object(input, 'domain request');
  return Object.freeze({
    domainId: requiredString(input.domainId, 'request.domainId'),
    capability: requiredString(input.capability, 'request.capability'),
    input: Object.freeze({ ...object(input.input ?? {}, 'request.input') }),
    identityContext: Object.freeze({ ...object(input.identityContext, 'request.identityContext') }),
    scopeContext: Object.freeze({ ...object(input.scopeContext, 'request.scopeContext') }),
    traceContext: Object.freeze({ ...object(input.traceContext, 'request.traceContext') })
  });
}

export function createDomainResult(input) {
  object(input, 'domain result');
  return Object.freeze({
    status: requiredString(input.status ?? 'success', 'result.status'),
    domainId: requiredString(input.domainId, 'result.domainId'),
    capability: requiredString(input.capability, 'result.capability'),
    actionClass: requiredString(input.actionClass, 'result.actionClass'),
    data: input.data ?? null,
    traceContext: Object.freeze({ ...object(input.traceContext, 'result.traceContext') })
  });
}
