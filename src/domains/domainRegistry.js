import { createDomainModule } from './contracts.js';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

export function createDomainRegistry(initialModules = []) {
  const modules = new Map();
  const capabilities = new Map();

  function register(input) {
    const module = createDomainModule(input);
    if (modules.has(module.id)) throw new Error(`domain already registered: ${module.id}`);
    for (const capability of module.capabilities) {
      if (capabilities.has(capability.name)) throw new Error(`domain capability already registered: ${capability.name}`);
    }
    modules.set(module.id, module);
    for (const capability of module.capabilities) capabilities.set(capability.name, Object.freeze({ module, capability }));
    return module;
  }

  for (const module of initialModules) register(module);

  return Object.freeze({
    register,
    get(id) {
      const module = modules.get(requiredString(id, 'domain id'));
      if (!module) throw new Error(`domain not registered: ${id}`);
      return module;
    },
    resolve(domainId, capabilityName) {
      const domain = this.get(domainId);
      const entry = capabilities.get(requiredString(capabilityName, 'capability name'));
      if (!entry || entry.module.id !== domain.id) throw new Error(`capability not registered for domain ${domain.id}: ${capabilityName}`);
      return entry;
    },
    list: () => Object.freeze([...modules.values()]),
    listCapabilities: () => Object.freeze([...capabilities.keys()].sort())
  });
}
