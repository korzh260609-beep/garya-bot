import { createCapabilityManifest } from './capabilityManifest.js';

export const PLATFORM_CAPABILITY_MANIFEST = createCapabilityManifest({
  sourceId: 'subsystem:sg-platform',
  domain: 'platform',
  sourceOfTruth: 'src/runtime and canonical platform modules',
  capabilities: [
    { id: 'identity.global-resolution', domain: 'identity', description: 'Resolve transport-independent global identity.' },
    { id: 'access.action-gate', domain: 'security', description: 'Gate protected actions through authorization and confirmation policy.' },
    { id: 'access.resource-authority', domain: 'security', description: 'Enforce resource-scoped authority without granting rights from self knowledge.' },
    { id: 'observability.runtime', domain: 'observability', description: 'Record runtime/task/source/error health evidence.' },
    { id: 'ai.router', domain: 'ai', description: 'Route production AI calls through the controlled AI Router.', requiresAuthorization: false },
    { id: 'transport.cross-transport-context', domain: 'transport', description: 'Preserve system identity and scoped context across supported transports.' }
  ]
});
