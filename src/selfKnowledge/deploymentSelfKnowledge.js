import { createSelfKnowledgeFact } from './selfKnowledge.js';
import { createSystemCapabilityCatalog } from '../capability/systemCapabilityCatalog.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function fact({ category, key, value, status = 'implemented', kind = 'evidence', sourceId, sourceRevision, confidence = 1 }) {
  return createSelfKnowledgeFact({
    category,
    key,
    value,
    status,
    kind,
    confidence,
    provenance: { sourceType: kind, sourceId, sourceRevision }
  });
}

export function createDeploymentSelfKnowledgeSources({
  config,
  capabilityNames = [],
  capabilityManifests = [],
  githubAccess = null,
  persistence = null,
  productionAI = null,
  connectionRegistry = null,
  resourceAuthorityRegistry = null,
  conversationContextService = null,
  userSettingsService = null,
  languageContextService = null,
  temporalService = null,
  featureFlags = null,
  eventBus = null,
  contractVersioning = null,
  domainRuntime = null
} = {}) {
  const revision = required(config?.revision, 'config.revision');
  const capabilityCatalog = createSystemCapabilityCatalog({ runtimeCapabilityNames: capabilityNames, sourceRevision: revision, additionalManifests: capabilityManifests });
  const statusOverrides = Object.freeze(Object.fromEntries(capabilityCatalog.capabilities.filter((item) => item.status !== 'implemented').map((item) => [item.id, item.status])));
  const connectionDependent = Object.freeze(capabilityCatalog.capabilities.filter((item) => item.connectionDependent).map((item) => item.id));
  const permissionDependent = Object.freeze(capabilityCatalog.capabilities.filter((item) => item.permissionDependent).map((item) => item.id));

  const canonicalSource = Object.freeze({
    id: 'sg-canonical-entity',
    async collect() {
      return Object.freeze({ facts: Object.freeze([
        fact({ category: 'identity', key: 'system-name', value: { short: 'SG', full: 'Советник GARYA' }, kind: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: revision }),
        fact({ category: 'identity', key: 'entity-type', value: 'one global transport-independent project system', kind: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: revision }),
        fact({ category: 'purpose', key: 'core-purpose', value: 'Organize connected reasoning models through verified context, memory, sources, capabilities, permissions, safety gates, tools and interfaces.', kind: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: revision }),
        fact({ category: 'owner', key: 'owner-resolution-policy', value: 'Owner/Monarch authority is resolved through verified global identity and is never inferred from names, usernames, phrases, commands or model output.', kind: 'authority', sourceId: 'pillars/DECISIONS.md', sourceRevision: revision }),
        fact({ category: 'architecture', key: 'ai-authority-boundary', value: 'AI provides controlled reasoning/execution; SG owns context, decisions, permissions, risk and action control.', kind: 'authority', sourceId: 'pillars/DECISIONS.md', sourceRevision: revision }),
        fact({ category: 'architecture', key: 'ai-routing-boundary', value: 'Production AI calls pass through AI Router; direct provider calls from SG modules are prohibited.', kind: 'authority', sourceId: 'pillars/DECISIONS.md', sourceRevision: revision }),
        fact({ category: 'memory', key: 'self-knowledge-separation', value: 'System Self Knowledge is separate from user/project memory and cannot grant authority.', kind: 'authority', sourceId: 'pillars/architecture/SELF_KNOWLEDGE.md', sourceRevision: revision })
      ]) });
    }
  });

  const runtimeSource = Object.freeze({
    id: 'sg-runtime-composition',
    async collect() {
      const facts = [
        fact({ category: 'development-status', key: 'block-16.17', value: 'Self Knowledge / System Self-Awareness', status: 'implemented', sourceId: 'runtime:system-self-knowledge', sourceRevision: revision }),
        fact({ category: 'development-status', key: 'block-16.18', value: 'Monarch Control / Owner Security', status: 'planned', kind: 'declaration', sourceId: 'pillars/roadmap/16_18_MONARCH_CONTROL_OWNER_SECURITY.md', sourceRevision: revision }),
        fact({ category: 'development-status', key: 'block-17', value: 'Render Deployment', status: 'implemented', sourceId: 'runtime:render-deployment', sourceRevision: revision }),
        fact({ category: 'development-status', key: 'block-18', value: 'End-to-End Verification', status: 'planned', kind: 'declaration', sourceId: 'pillars/roadmap/PRODUCTION_ROADMAP.md', sourceRevision: revision }),
        fact({ category: 'development-status', key: 'block-19', value: 'Security and Operations', status: 'planned', kind: 'declaration', sourceId: 'pillars/roadmap/PRODUCTION_ROADMAP.md', sourceRevision: revision }),
        fact({ category: 'memory', key: 'base-memory', value: 'Scoped confirmed user/project memory foundation', status: 'implemented', sourceId: 'runtime:memory-provider', sourceRevision: revision }),
        fact({ category: 'memory', key: 'memory-2.0-program', value: 'Memory 2.0 M1-M9 program', status: 'implemented', kind: 'evidence', sourceId: 'pillars/roadmap/MEMORY_2_0_ROADMAP.md', sourceRevision: revision }),
        fact({ category: 'capabilities', key: 'registered-capabilities', value: [...capabilityNames].sort(), status: 'implemented', sourceId: 'runtime:capability-registry', sourceRevision: revision }),
        fact({
          category: 'capabilities',
          key: 'github-direct-access',
          value: githubAccess?.status ? githubAccess.status() : { configured: false, verified: false, error: 'github-service-unavailable' },
          status: githubAccess?.status?.().verified === true ? 'implemented' : 'disabled',
          sourceId: 'runtime:github-direct-access',
          sourceRevision: revision
        }),
        fact({
          category: 'capabilities',
          key: 'capability-catalog',
          value: {
            totalCapabilities: capabilityCatalog.totalCapabilities,
            domains: capabilityCatalog.domains,
            defaultStatus: 'implemented',
            statusOverrides,
            connectionDependent,
            permissionDependent,
            refreshMode: capabilityCatalog.refreshMode,
            perRequestExternalScan: capabilityCatalog.perRequestExternalScan,
            grantsAuthority: false
          },
          status: 'implemented',
          sourceId: 'runtime:capability-catalog',
          sourceRevision: revision
        }),
        fact({ category: 'deployment', key: 'environment', value: config.environment, status: 'implemented', sourceId: 'runtime:config', sourceRevision: revision }),
        fact({ category: 'deployment', key: 'revision', value: revision, status: 'implemented', sourceId: 'runtime:config', sourceRevision: revision }),
        fact({ category: 'ai', key: 'production-ai', value: productionAI ? 'initialized' : 'not-initialized', status: productionAI ? 'implemented' : 'disabled', sourceId: 'runtime:ai-composition', sourceRevision: revision }),
        fact({ category: 'modules', key: 'persistence', value: persistence ? 'postgresql' : 'memory', status: 'implemented', sourceId: 'runtime:persistence', sourceRevision: revision }),
        fact({ category: 'modules', key: 'conversation-context', value: Boolean(conversationContextService), status: conversationContextService ? 'implemented' : 'disabled', sourceId: 'runtime:conversation-context', sourceRevision: revision }),
        fact({ category: 'modules', key: 'user-settings', value: Boolean(userSettingsService), status: userSettingsService ? 'implemented' : 'disabled', sourceId: 'runtime:user-settings', sourceRevision: revision }),
        fact({ category: 'modules', key: 'language-context', value: Boolean(languageContextService), status: languageContextService ? 'implemented' : 'disabled', sourceId: 'runtime:language-context', sourceRevision: revision }),
        fact({ category: 'modules', key: 'temporal-context', value: Boolean(temporalService), status: temporalService ? 'implemented' : 'disabled', sourceId: 'runtime:temporal-context', sourceRevision: revision }),
        fact({ category: 'modules', key: 'feature-flags', value: Boolean(featureFlags), status: featureFlags ? 'implemented' : 'disabled', sourceId: 'runtime:feature-flags', sourceRevision: revision }),
        fact({ category: 'modules', key: 'internal-event-bus', value: Boolean(eventBus), status: eventBus ? 'implemented' : 'disabled', sourceId: 'runtime:event-bus', sourceRevision: revision }),
        fact({ category: 'modules', key: 'contract-versioning', value: Boolean(contractVersioning), status: contractVersioning ? 'implemented' : 'disabled', sourceId: 'runtime:contract-versioning', sourceRevision: revision }),
        fact({ category: 'modules', key: 'domain-runtime', value: Boolean(domainRuntime), status: domainRuntime ? 'implemented' : 'disabled', sourceId: 'runtime:domain-runtime', sourceRevision: revision }),
        fact({ category: 'integrations', key: 'external-connections-registry', value: Boolean(connectionRegistry), status: connectionRegistry ? 'implemented' : 'disabled', sourceId: 'runtime:connections', sourceRevision: revision }),
        fact({ category: 'security', key: 'resource-authority', value: Boolean(resourceAuthorityRegistry), status: resourceAuthorityRegistry ? 'implemented' : 'disabled', sourceId: 'runtime:resource-authority', sourceRevision: revision }),
        fact({ category: 'limitations', key: 'live-state-requires-runtime-evidence', value: true, status: 'implemented', kind: 'authority', sourceId: 'pillars/architecture/SELF_KNOWLEDGE.md', sourceRevision: revision })
      ];
      return Object.freeze({ facts: Object.freeze(facts) });
    }
  });

  return Object.freeze([canonicalSource, runtimeSource]);
}
