function handler(handlers, name, fallback) {
  const value = handlers[name];
  if (value != null && typeof value !== 'function') throw new TypeError(`handler must be a function: ${name}`);
  return value ?? fallback;
}

const passthrough = (domain, operation) => async ({ input, sources, memory }) => Object.freeze({ domain, operation, input, sources, memory });

export const BUILT_IN_DOMAIN_PERMISSIONS = Object.freeze([
  'documents.read',
  'documents.write.prepare',
  'repository.read',
  'repository.write.prepare',
  'market.read',
  'billing.prepare',
  'billing.execute',
  'psychology.use',
  'kingdom.use'
]);

export function createBuiltInDomainModules(handlers = {}) {
  return Object.freeze([
    {
      id: 'documents',
      version: '1.0.0',
      description: 'Document analysis and prepare-only document work.',
      capabilities: [
        { name: 'documents.analyze', actionClass: 'analysis', requiredPermissions: ['documents.read'], sourceRequirements: ['documents'], memoryLayers: ['project'], handler: handler(handlers, 'documents.analyze', passthrough('documents', 'analyze')) },
        { name: 'documents.prepare', actionClass: 'prepare-only', requiredPermissions: ['documents.write.prepare'], sourceRequirements: ['documents'], memoryLayers: ['project'], handler: handler(handlers, 'documents.prepare', passthrough('documents', 'prepare')) }
      ]
    },
    {
      id: 'repository',
      version: '1.0.0',
      description: 'Repository inspection and prepare-only change proposals.',
      capabilities: [
        { name: 'repository.analyze', actionClass: 'analysis', requiredPermissions: ['repository.read'], sourceRequirements: ['repository'], memoryLayers: ['project'], handler: handler(handlers, 'repository.analyze', passthrough('repository', 'analyze')) },
        { name: 'repository.change.prepare', actionClass: 'prepare-only', requiredPermissions: ['repository.write.prepare'], sourceRequirements: ['repository'], memoryLayers: ['project'], handler: handler(handlers, 'repository.change.prepare', passthrough('repository', 'change.prepare')) }
      ]
    },
    {
      id: 'market',
      version: '1.0.0',
      description: 'Evidence-bounded market analysis.',
      capabilities: [
        { name: 'market.analyze', actionClass: 'analysis', requiredPermissions: ['market.read'], sourceRequirements: ['market'], memoryLayers: ['user', 'project'], handler: handler(handlers, 'market.analyze', passthrough('market', 'analyze')) }
      ]
    },
    {
      id: 'billing',
      version: '1.0.0',
      description: 'Billing preparation and protected payment execution.',
      capabilities: [
        { name: 'billing.invoice.prepare', actionClass: 'prepare-only', requiredPermissions: ['billing.prepare'], sourceRequirements: ['billing'], memoryLayers: ['project'], handler: handler(handlers, 'billing.invoice.prepare', passthrough('billing', 'invoice.prepare')) },
        { name: 'billing.payment.execute', actionClass: 'protected', requiredPermissions: ['billing.execute'], sourceRequirements: ['billing'], memoryLayers: ['project'], handler: handler(handlers, 'billing.payment.execute', passthrough('billing', 'payment.execute')) }
      ]
    },
    {
      id: 'psychology',
      version: '1.0.0',
      description: 'Scoped non-clinical psychology support.',
      capabilities: [
        { name: 'psychology.support', actionClass: 'analysis', requiredPermissions: ['psychology.use'], sourceRequirements: [], memoryLayers: ['user'], handler: handler(handlers, 'psychology.support', passthrough('psychology', 'support')) }
      ]
    },
    {
      id: 'kingdom',
      version: '1.0.0',
      description: 'Replaceable Kingdom GARYA service boundary.',
      capabilities: [
        { name: 'kingdom.service.prepare', actionClass: 'prepare-only', requiredPermissions: ['kingdom.use'], sourceRequirements: [], memoryLayers: ['user', 'project'], handler: handler(handlers, 'kingdom.service.prepare', passthrough('kingdom', 'service.prepare')) }
      ]
    }
  ]);
}
