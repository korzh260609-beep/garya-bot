import { createLocalProductionHarness } from './localProductionHarness.js';
import { createProductionDevelopmentKnowledgeDeployment } from '../projectDevelopmentKnowledge/productionDevelopmentKnowledgeDeployment.js';
import { createProductionGitHubDevelopmentRuntime, GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY } from '../githubDevelopment/githubDevelopmentProductionRuntime.js';
import { createGitHubCapabilityRegistry, GITHUB_CAPABILITY_DEFINITIONS } from '../githubDevelopment/githubCapabilityRegistry.js';
import { createGitHubSecurityControlPlane } from '../githubDevelopment/githubSecurityControlPlane.js';
import { createGitHubCapabilityBindingService, createGitHubProviderCapabilityProbe } from '../githubDevelopment/githubCapabilityBindingService.js';
import { createGitHubTokenConnectionProvider } from '../githubDevelopment/githubTokenConnectionProvider.js';
import { createGitHubAppConnectionProvider } from '../githubDevelopment/githubAppConnectionProvider.js';
import { createPostgresGitHubDevelopmentTaskStore } from '../githubDevelopment/postgresGitHubDevelopmentTaskStore.js';

function mergeHealth(base, pdk4, githubDevelopment = null) {
  return Object.freeze({ ...base, pdk4: Object.freeze({ ...pdk4 }), ...(githubDevelopment ? { githubDevelopment: Object.freeze({ ...githubDevelopment }) } : {}) });
}

function wireRepositoryReadCapability(base, pdk4Deployment) {
  const repositoryReadService = pdk4Deployment.repositoryReadService;
  if (!repositoryReadService) return null;
  const registered = base.capabilityRegistry.get('repository-analyze');
  if (!registered) throw new Error('repository-analyze capability is not registered');
  return base.capabilityRegistry.replace({
    ...registered,
    execute: async (request) => {
      const snapshot = await repositoryReadService.snapshot({
        query: request.input?.text ?? request.input?.message ?? null,
        files: request.input?.files ?? []
      });
      if (snapshot?.mutated === true || snapshot?.pushed === true || snapshot?.published === true) {
        throw new Error('read-only repository service attempted mutation');
      }
      return {
        status: 'success',
        data: {
          ...snapshot,
          mode: request.input?.mode === 'prepare-only' ? 'prepare-only' : 'read-only',
          mutated: false,
          message: 'Verified repository snapshot retrieved for response composition'
        },
        sources: snapshot.sources,
        tools: ['repository-analyzer']
      };
    }
  });
}

function withOwnerGitHubDevelopmentCapability(input, ownerGlobalUserId) {
  if (!ownerGlobalUserId || input?.identityContext?.globalUserId !== ownerGlobalUserId) return input;
  const githubCapabilities = GITHUB_CAPABILITY_DEFINITIONS.map((item) => item.name);
  const grants = new Set([...(input.identityContext.grants ?? []), `capability:${GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY}`, ...githubCapabilities.map((item) => `capability:${item}`)]);
  const allowedCapabilities = new Set([...(input.scopeContext?.allowedCapabilities ?? []), GITHUB_DEVELOPMENT_RUNTIME_CAPABILITY, ...githubCapabilities]);
  return Object.freeze({
    ...input,
    identityContext: Object.freeze({ ...input.identityContext, grants: Object.freeze([...grants]) }),
    scopeContext: Object.freeze({ ...input.scopeContext, allowedCapabilities: Object.freeze([...allowedCapabilities]) }),
    metadata: Object.freeze({ ...(input.metadata ?? {}), githubDevelopmentRuntimeBound: true })
  });
}

export function createProductionHarnessWithPDK4({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const base = createLocalProductionHarness({ env, interpretationResolver, fetchImpl, clock });
  const pdk4Deployment = createProductionDevelopmentKnowledgeDeployment({ harness: base, env, fetchImpl, clock });
  const repositoryReadCapability = wireRepositoryReadCapability(base, pdk4Deployment);
  const githubCapabilityRegistry = createGitHubCapabilityRegistry();
  const githubPrivateKeyConfigured = [env.GITHUB_APP_PRIVATE_KEY, env.GITHUB_APP_PRIVATE_KEY_BASE64].some((item) => typeof item === 'string' && item.trim() !== '');
  const githubAppConfigured = [env.GITHUB_APP_ID, env.GITHUB_APP_INSTALLATION_ID].every((item) => typeof item === 'string' && item.trim() !== '') && githubPrivateKeyConfigured;
  const githubConnectionProvider = githubAppConfigured
    ? createGitHubAppConnectionProvider({ connectionRegistry: base.connectionRegistry, credentialManager: base.credentialManager, connectionAccessContext: base.connectionAccessContext, credentialAccessContext: base.credentialAccessContext, fetchImpl, clock })
    : createGitHubTokenConnectionProvider({ credentialManager: base.credentialManager, credentialAccessContext: base.credentialAccessContext });
  const githubSecurityControlPlane = createGitHubSecurityControlPlane({
    capabilityRegistry: githubCapabilityRegistry,
    accessControl: { async assertAllowed({ actor, capability }) { return { allowed: actor?.grants?.includes(`capability:${capability}`) === true, reason: 'identity-capability-grant' }; } },
    resourceAuthority: base.resourceAuthorityRegistry,
    actionGate: base.actionGate,
    credentialManager: base.credentialManager,
    ownerSecurity: base.ownerSecurityGateway,
    emergencyMode: () => env.SG_GITHUB_EMERGENCY_MODE ?? 'normal',
    audit: (event) => base.observability.record({ eventClass: 'audit_event', channel: 'audit', stage: 'github-security-control-plane', outcome: event.outcome ?? 'evaluated', reason: event.capability ?? 'github-capability-assessment', traceContext: { traceId: `gde2:${event.actorGlobalUserId ?? 'unknown'}`, requestId: `gde2:${event.capability ?? 'unknown'}`, environment: env.NODE_ENV ?? 'production', revision: env.RENDER_GIT_COMMIT ?? 'unknown' }, data: event }),
    clock
  });
  const githubCapabilityBindingService = createGitHubCapabilityBindingService({ capabilityRegistry: githubCapabilityRegistry, securityControlPlane: githubSecurityControlPlane, providerCapabilityProbe: createGitHubProviderCapabilityProbe({ connectionProvider: githubConnectionProvider }), clock });
  const githubDevelopmentTaskStore = base.persistence?.database ? createPostgresGitHubDevelopmentTaskStore({ database: base.persistence.database }) : null;
  const githubDevelopment = createProductionGitHubDevelopmentRuntime({
    env,
    credentialManager: base.credentialManager,
    credentialAccessContext: base.credentialAccessContext,
    resourceAuthorityRegistry: base.resourceAuthorityRegistry,
    resourceAuthorityAccessContext: base.resourceAuthorityAccessContext,
    ownerGlobalUserId: base.ownerSecurityConfig.monarchGlobalUserId,
    aiRouter: base.productionAI?.aiRouter ?? null,
    capabilityBindingService: githubCapabilityBindingService,
    githubSecurityControlPlane,
    githubConnectionProvider,
    developmentTaskStore: githubDevelopmentTaskStore,
    auditSink: { async record(event) { return base.observability.record({ eventClass: 'audit_event', channel: 'audit', stage: 'github-platform-operations', outcome: event.postCondition ?? 'evaluated', reason: event.canonicalAction, traceContext: { traceId: event.traceId ?? `gde6:${event.idempotencyKey}`, requestId: event.idempotencyKey, environment: env.NODE_ENV ?? 'production', revision: env.RENDER_GIT_COMMIT ?? 'unknown' }, data: event }); } },
    fetchImpl,
    clock
  });
  base.capabilityRegistry.register(githubDevelopment.capability);
  const baseRuntime = base.runtime;
  const runtime = Object.freeze({
    async start() {
      const started = await baseRuntime.start();
      await pdk4Deployment.start();
      await githubDevelopment.start();
      return mergeHealth(started, pdk4Deployment.health(), githubDevelopment.availability);
    },
    async stop() {
      try { await pdk4Deployment.stop(); } finally { await baseRuntime.stop(); }
    },
    handle: (input) => baseRuntime.handle(withOwnerGitHubDevelopmentCapability(input, base.ownerSecurityConfig.monarchGlobalUserId)),
    health: () => mergeHealth(baseRuntime.health(), pdk4Deployment.health(), githubDevelopment.availability),
    readiness: () => {
      const readiness = baseRuntime.readiness();
      return Object.freeze({ ...readiness, pdk4: pdk4Deployment.health(), githubDevelopment: githubDevelopment.availability });
    }
  });
  return Object.freeze({ ...base, runtime, pdk4Deployment, repositoryReadCapability, githubDevelopment, githubDevelopmentTaskStore, githubCapabilityBindingService, githubSecurityControlPlane });
}
