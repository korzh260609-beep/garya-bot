import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { createVersionedCapabilityExecutor } from '../contracts/versionedCapabilityExecutor.js';
import { createFixtureMeaningInterpreter } from '../semantic/meaningInterpreter.js';
import { createSemanticKernel } from '../semantic/semanticKernel.js';
import { createContextAwareSemanticPipeline } from '../memory/contextAwareSemanticPipeline.js';
import { createContextResolver } from '../memory/contextResolver.js';
import { createPostgresObservabilityStore, createPostgresPersistence } from '../persistence/index.js';
import { createMemory2Service, createMemory2Provider } from '../memory2/memory2.js';
import { createInMemoryMemory2Store } from '../memory2/inMemoryMemory2Store.js';
import { createPostgresMemory2Store } from '../memory2/postgresMemory2Store.js';
import { createMemory2Capabilities, MEMORY2_CAPABILITY_NAMES } from '../memory2/memory2Capabilities.js';
import { createPostgresTaskQueue } from '../automation/postgresTaskQueue.js';
import { createPostgresRecurringScheduler } from '../automation/postgresRecurringScheduler.js';
import { createActionGate } from '../action/actionGate.js';
import { createCapabilityRegistry } from '../capability/capabilityRegistry.js';
import { createCapabilityExecutor } from '../capability/capabilityExecutor.js';
import { createProductionCapabilities, createInMemoryProductionTaskStore, PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { createPostgresProductionTaskStore } from '../capability/postgresProductionTaskStore.js';
import { createInMemoryObservabilityStore } from '../observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../observability/observabilityService.js';
import { createLocalInterfaceHarness } from '../interfaces/localHarness.js';
import { createProductionAI } from '../ai/createProductionAI.js';
import { createTemporalContextService } from '../temporal/temporalContextService.js';
import { createRecurrenceEngine } from '../temporal/recurrenceEngine.js';
import { createTemporalAwareMeaningInterpreter } from '../temporal/temporalMeaningInterpreter.js';
import { createTemporalCapabilities } from '../temporal/temporalCapabilities.js';
import { createTemporalTaskStore } from '../temporal/temporalTaskStore.js';
import { createTemporalMemoryProvider } from '../temporal/temporalMemoryProvider.js';
import { createLanguageContextService } from '../language/languageContextService.js';
import { createLanguageAwareConversationResponder } from '../language/languageAwareConversationResponder.js';
import { createLanguageCapabilities } from '../language/languageCapabilities.js';
import { createAILanguageDetector } from '../language/aiLanguageDetector.js';
import { createDefaultConfigurationPolicyLayer, createEnvironmentPolicyOverrides } from '../config/configurationPolicyLayer.js';
import { createDeploymentCredentialManager } from '../secrets/credentialManager.js';
import { createDeploymentExternalConnections } from '../connections/deploymentConnections.js';
import { createDeploymentResourceAuthority } from '../authority/deploymentResourceAuthority.js';
import { createDeploymentConversationContext } from '../conversation/deploymentConversationContext.js';
import { createInMemoryUserSettingsStore, createUserSettingsService } from '../settings/userSettingsService.js';
import { createPostgresUserSettingsStore } from '../settings/postgresUserSettingsStore.js';
import { createLanguageSettingsAdapter, createTimezoneSettingsAdapter } from '../settings/userSettingsAdapters.js';
import { createUserSettingsCapabilities } from '../settings/userSettingsCapabilities.js';
import { createFeatureFlagService, createInMemoryFeatureFlagStore } from '../features/featureFlags.js';
import { createPostgresFeatureFlagStore } from '../features/postgresFeatureFlagStore.js';
import { createFeatureFlaggedCapabilityExecutor } from '../features/featureFlaggedCapabilityExecutor.js';
import { createInMemorySelfKnowledgeStore, createSelfKnowledgeBuilder, createSelfKnowledgeService } from '../selfKnowledge/selfKnowledge.js';
import { createPostgresSelfKnowledgeStore } from '../selfKnowledge/postgresSelfKnowledgeStore.js';
import { createDeploymentSelfKnowledgeSources } from '../selfKnowledge/deploymentSelfKnowledge.js';
import { createBoundedResponseContextAssembler } from '../response/boundedResponseContext.js';
import { createOwnerSecurityConfig, createOwnerSecurityGateway, createSecurityPolicyRegistry } from '../security/ownerSecurity.js';
import { createOwnerSecurityActionGate } from '../security/ownerSecurityActionGate.js';
import {
  createPostgresProjectMemoryStore,
  createProjectMemoryHybridRetrieval,
  createProjectMemoryContextGuard,
  createProjectMemoryAIRouterIntegration
} from '../projectMemory/index.js';
import { BUILT_IN_DOMAIN_PERMISSIONS } from '../domains/builtInDomains.js';
import { createProductionControlPlane } from './productionControlPlane.js';
import { createProductionRuntime } from './createProductionRuntime.js';
import { loadRuntimeConfig } from './config.js';

function aiRequested(env) { return ['1', 'true', 'yes', 'on'].includes(String(env.SG_AI_ENABLED ?? '').trim().toLowerCase()); }
function createCredentialAuditAdapter(observability, config) { let sequence = 0; return Object.freeze({ record(event) { sequence += 1; const correlation = `credential-${sequence}`; return observability.record({ ...event, eventClass: 'audit_event', traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision }, reason: event.data?.reason ?? null, data: { ...(event.data ?? {}), credentialEventClass: event.eventClass } }); } }); }
function enrichTrace(traceContext, config) { return Object.freeze({ ...(traceContext ?? {}), environment: traceContext?.environment ?? config.environment, revision: traceContext?.revision ?? config.revision }); }
function createProjectMemoryRequestAuthorizer() {
  return ({ actor, projectKey, operation }) => actor?.projectMemoryAuthorization?.source === 'resolved-request-scope'
    && actor.projectMemoryAuthorization.projectScope === projectKey
    && actor.projectMemoryAuthorization.actorGlobalUserId === actor.globalUserId
    && (operation === 'read' || operation === 'context-read');
}

export function createLocalProductionHarness({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const config = loadRuntimeConfig({ SG_ENVIRONMENT: 'local-production-like', SG_REVISION: 'memory-2.0', SG_PROJECT_SCOPE: 'sg2.1', ...env });
  const policyLayer = createDefaultConfigurationPolicyLayer({ environment: createEnvironmentPolicyOverrides(env) });
  const basePolicy = policyLayer.resolve().policy;
  const persistence = config.persistenceMode === 'postgres' ? createPostgresPersistence({ connectionString: config.databaseUrl, ssl: config.databaseSsl, applicationName: 'sg-2-1-runtime' }) : null;
  const store = persistence ? createPostgresObservabilityStore({ observabilityRepository: persistence.repositories.observability }) : createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store });
  const ownerSecurityConfig = createOwnerSecurityConfig(env);
  const securityPolicyRegistry = createSecurityPolicyRegistry();
  const ownerSecurityGateway = createOwnerSecurityGateway({ config: ownerSecurityConfig, policyRegistry: securityPolicyRegistry, observability, environment: config.environment, revision: config.revision, clock });
  const controlPlane = createProductionControlPlane({ persistence, observability, config, clock });
  const featureFlagStore = persistence ? createPostgresFeatureFlagStore({ database: persistence.database }) : createInMemoryFeatureFlagStore();
  const featureFlags = createFeatureFlagService({ store: featureFlagStore, clock, observability, policyResolver: async () => ({ enabled: true }) });
  const credentialDeployment = createDeploymentCredentialManager({ env, observability: createCredentialAuditAdapter(observability, config), clock, projectScope: config.projectScope });
  const credentialManager = credentialDeployment.manager;
  const credentialAccessContext = credentialDeployment.accessContext;
  const connectionDeployment = createDeploymentExternalConnections({ persistence, credentialManager, observability, config, env, clock });
  const connectionRegistry = connectionDeployment.registry;
  const connectionAccessContext = connectionDeployment.accessContext;
  const authorityDeployment = createDeploymentResourceAuthority({ persistence, connectionRegistry, observability, config, clock });
  const resourceAuthorityRegistry = authorityDeployment.registry;
  const resourceAuthorityAccessContext = authorityDeployment.accessContext;
  const conversationDeployment = createDeploymentConversationContext({ persistence, observability, config, clock });
  const conversationContextService = conversationDeployment.service;
  const settingsStore = persistence ? createPostgresUserSettingsStore({ database: persistence.database }) : createInMemoryUserSettingsStore();
  const userSettingsService = createUserSettingsService({ store: settingsStore, clock });
  const timezoneStore = createTimezoneSettingsAdapter({ userSettingsService });
  const languageStore = createLanguageSettingsAdapter({ userSettingsService });
  const memory2Store = persistence ? createPostgresMemory2Store({ database: persistence.database }) : createInMemoryMemory2Store();
  const memory2Service = createMemory2Service({
    store: memory2Store,
    clock,
    audit: (event) => {
      const correlation = `memory2:${event.memoryId ?? event.newMemoryId ?? event.eventClass}:${config.environment}`;
      return observability.record({
        eventClass: 'audit_event', channel: 'telemetry', stage: 'memory2', outcome: event.reason ?? event.eventClass,
        traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision },
        actorRef: event.actorGlobalUserId ?? null,
        data: { memoryEventClass: event.eventClass, memoryId: event.memoryId ?? null, newMemoryId: event.newMemoryId ?? null, projectScope: event.projectScope ?? null, scopeKind: event.scopeKind ?? null, privacyClass: event.privacyClass ?? null, reason: event.reason ?? null, conflictCount: event.conflictCount ?? event.conflictGroupCount ?? null, selectedCount: event.selectedCount ?? null, candidateCount: event.candidateCount ?? null, expiredCount: event.expiredCount ?? null, automatic: event.automatic ?? null }
      });
    }
  });
  const baseMemoryProvider = createMemory2Provider({ service: memory2Service, clock });
  const memoryProvider = createTemporalMemoryProvider({ memoryProvider: baseMemoryProvider });
  const selfKnowledgeStore = persistence ? createPostgresSelfKnowledgeStore({ database: persistence.database }) : createInMemorySelfKnowledgeStore({ clock });
  const selfKnowledgeService = createSelfKnowledgeService({ store: selfKnowledgeStore });
  const durableTaskQueue = persistence ? createPostgresTaskQueue({ database: persistence.database }) : null;
  const baseTaskStore = persistence ? createPostgresProductionTaskStore({ database: persistence.database, taskQueue: durableTaskQueue }) : createInMemoryProductionTaskStore();
  const temporalService = createTemporalContextService({ clock, timezoneStore });
  const productionAI = !interpretationResolver && aiRequested(env) ? createProductionAI({ env, fetchImpl, configurationPolicy: basePolicy, credentialManager, credentialAccessContext, connectionRegistry, connectionAccessContext }) : null;
  const projectMemoryStore = persistence ? createPostgresProjectMemoryStore(persistence.database) : null;
  const projectMemoryAuthorize = createProjectMemoryRequestAuthorizer();
  const projectMemoryRetrieval = persistence ? createProjectMemoryHybridRetrieval({ database: persistence.database, store: projectMemoryStore, authorize: projectMemoryAuthorize, clock }) : null;
  const projectMemoryContextGuard = persistence ? createProjectMemoryContextGuard({ database: persistence.database, authorize: projectMemoryAuthorize, retrieval: projectMemoryRetrieval, clock }) : null;
  const projectMemoryIntegration = persistence ? createProjectMemoryAIRouterIntegration({ retrieval: projectMemoryRetrieval, contextGuard: projectMemoryContextGuard, aiRouter: productionAI?.aiRouter ?? null }) : null;
  const languageDetector = productionAI?.aiRouter ? createAILanguageDetector({ aiRouter: productionAI.aiRouter }) : null;
  const languageContextService = createLanguageContextService({ store: languageStore, detector: languageDetector, fallbackLanguage: env.SG_FALLBACK_LANGUAGE ?? 'en' });
  const recurrenceEngine = createRecurrenceEngine({ temporalService });
  const recurringScheduler = persistence ? createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine, clock }) : null;
  const taskStore = createTemporalTaskStore({ taskStore: baseTaskStore, temporalService, recurringScheduler });
  const contextResolver = createContextResolver({ memoryProvider });
  const baseMeaningInterpreter = productionAI?.meaningInterpreter ?? createFixtureMeaningInterpreter(interpretationResolver ?? ((input) => ({ meaning: `Runtime processed: ${input.text}`, goal: 'respond', intent: 'answer', contextNeeds: [], evidenceNeeds: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'Deterministic production-like interpretation with AI disabled.' })));
  const meaningInterpreter = createTemporalAwareMeaningInterpreter({ baseInterpreter: baseMeaningInterpreter, temporalService });
  const baseSemanticPipeline = createContextAwareSemanticPipeline({ semanticKernel: createSemanticKernel({ meaningInterpreter }), contextResolver });
  const semanticPipeline = Object.freeze({ async process(input) { const resolved = await controlPlane.contractVersioning.resolve('canonical-input', { version: '1.0', ...input }, { traceContext: enrichTrace(input.traceContext, config), source: 'production-runtime' }); const { version: _version, ...validatedInput } = resolved.record; return baseSemanticPipeline.process(Object.freeze(validatedInput)); } });
  const temporalCapabilities = createTemporalCapabilities({ temporalService, memoryProvider, recurringScheduler });
  const languageCapabilities = createLanguageCapabilities({ languageContextService });
  const userSettingsCapabilities = createUserSettingsCapabilities({ userSettingsService });
  const memory2Capabilities = createMemory2Capabilities({ memory2Service });
  const capabilityNames = Object.freeze([...PRODUCTION_CAPABILITY_NAMES, ...MEMORY2_CAPABILITY_NAMES, ...temporalCapabilities.map((item) => item.name), ...languageCapabilities.map((item) => item.name), ...userSettingsCapabilities.map((item) => item.name)]);

  const selfKnowledgeSources = createDeploymentSelfKnowledgeSources({ config, capabilityNames, persistence, productionAI, connectionRegistry, resourceAuthorityRegistry, conversationContextService, userSettingsService, languageContextService, temporalService, featureFlags, eventBus: controlPlane.eventBus, contractVersioning: controlPlane.contractVersioning, domainRuntime: controlPlane.domainRuntime });
  const selfKnowledgeBuilder = createSelfKnowledgeBuilder({
    store: selfKnowledgeStore,
    sources: selfKnowledgeSources,
    clock,
    audit: (event) => {
      const correlation = `self-knowledge:${config.environment}:${config.revision}`;
      return observability.record({ eventClass: 'audit_event', channel: 'telemetry', stage: 'self-knowledge', outcome: event.validationStatus, reason: event.reason, traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision }, data: { selfKnowledgeEventClass: event.eventClass, sourceRevision: event.sourceRevision, previousVersion: event.previousVersion, newVersion: event.newVersion, changed: event.changed, validationStatus: event.validationStatus, conflictCount: event.conflictCount, materialHash: event.materialHash } });
    }
  });
  let runtime = null;
  const responseContextAssembler = createBoundedResponseContextAssembler({
    memoryProvider,
    selfKnowledgeService,
    environment: config.environment,
    revision: config.revision,
    conversationContextStore: conversationDeployment.store,
    temporalService,
    observability,
    runtimeEvidenceProvider: async () => Object.freeze({
      runtime: runtime ? runtime.health() : { phase: 'starting', ok: true },
      persistence: persistence ? persistence.health() : { mode: 'memory', started: true },
      ai: { initialized: Boolean(productionAI), enabled: aiRequested(env) },
      memory2: { enabled: true },
      projectMemory3: { enabled: Boolean(projectMemoryIntegration), aiRouterIntegrated: Boolean(projectMemoryIntegration), trustedSourceKinds: ['github'], renderConnectorTrusted: false },
      ownerSecurity: ownerSecurityGateway.status(),
      revision: config.revision,
      environment: config.environment
    })
  });
  const conversationResponder = createLanguageAwareConversationResponder({ aiRouter: productionAI?.aiRouter ?? null, responseContextAssembler, projectMemoryIntegration });
  const selfKnowledgeResource = Object.freeze({
    async start() {
      await selfKnowledgeBuilder.rebuild({ sourceRevision: config.revision, commitSha: config.revision, environment: config.environment, reason: 'runtime-startup', metadata: { block: 'memory-2.0' } });
    },
    async stop() {}
  });
  const memory2Resource = Object.freeze({
    async start() {
      await memory2Service.reconcileLifecycle({ projectScope: config.projectScope });
      const integrity = await memory2Service.integrityCheck({ projectScope: config.projectScope });
      if (!integrity.ok) {
        const error = new Error(`Memory 2.0 integrity check failed: ${integrity.issueCount}`);
        error.code = 'memory2-integrity-failed';
        throw error;
      }
    },
    async stop() {}
  });

  const domainDispatcher = async ({ domainId, capability, input, request }) => controlPlane.domainRuntime.execute({ domainId, capability, input, identityContext: request.actor, scopeContext: request.scope, traceContext: enrichTrace(request.traceContext, config), gateDecision: request.gateDecision });
  const capabilities = Object.freeze([
    ...createProductionCapabilities({ memoryProvider, taskStore, conversationResponder, domainDispatcher, sourceRetriever: async ({ sourceId, query }) => sourceId === 'local-fixture' ? { ok: true, message: 'Approved local source retrieved', query, data: { sourceId, query }, sources: [sourceId] } : { ok: false, code: 'source-not-approved', message: 'Source is not approved', retryable: false, sources: [] }, repositoryAnalyzer: async ({ mode, files = [] }) => ({ mode, files: [...files], findings: [], mutated: false, message: 'Repository analysis completed in read/prepare-only mode', sources: ['repository-read-source'] }), diagnosticsProvider: async () => ({ status: 'ready', revision: config.revision, environment: config.environment, capabilityCount: capabilityNames.length, languageContext: 'ready', conversationContext: 'ready', userSettings: 'ready', memory2: await memory2Service.diagnostics({ scope: { userScope: ownerSecurityConfig.monarchGlobalUserId ?? 'diagnostic', projectScope: config.projectScope }, actor: { globalUserId: ownerSecurityConfig.monarchGlobalUserId ?? 'diagnostic', roles: ownerSecurityConfig.monarchGlobalUserId ? ['monarch'] : ['guest'], grants: [] } }), projectMemory3: { enabled: Boolean(projectMemoryIntegration), aiRouterIntegrated: Boolean(projectMemoryIntegration), guardedContextOnly: true, renderConnectorTrusted: false }, selfKnowledge: (await selfKnowledgeService.getSnapshot({ environment: config.environment }))?.validationStatus ?? 'unavailable', responseContext: 'ready', ownerSecurity: ownerSecurityGateway.status(), policyLayer: 'ready', featureFlags: 'ready', internalEventBus: 'ready', contractVersioning: 'ready', domainRuntime: 'ready', credentialBoundary: 'ready', credentialProviders: credentialDeployment.providers, connectionRegistry: 'ready', connectionIds: connectionDeployment.connectionIds, resourceAuthority: 'ready' }) }),
    ...memory2Capabilities,
    ...temporalCapabilities, ...languageCapabilities, ...userSettingsCapabilities
  ]);
  const capabilityRegistry = createCapabilityRegistry({ capabilities });
  const baseCapabilityExecutor = createCapabilityExecutor({ registry: capabilityRegistry });
  const versionedCapabilityExecutor = createVersionedCapabilityExecutor({ executor: baseCapabilityExecutor, contractVersioning: controlPlane.contractVersioning });
  const capabilityExecutor = createFeatureFlaggedCapabilityExecutor({ executor: versionedCapabilityExecutor, featureFlags });
  const baseActionGate = createActionGate({ availableSources: ['approved-source-registry', 'repository-read-source'], availableTools: ['source-retriever', 'document-analyzer', 'repository-analyzer'] });
  const actionGate = createOwnerSecurityActionGate({ actionGate: baseActionGate, ownerSecurityGateway });
  const resources = persistence ? [persistence, store, connectionDeployment.resource, controlPlane.eventBus, memory2Resource, selfKnowledgeResource] : [connectionDeployment.resource, controlPlane.eventBus, memory2Resource, selfKnowledgeResource];
  runtime = createProductionRuntime({ config, semanticPipeline, actionGate, capabilityRegistry, capabilityExecutor, domainRuntime: controlPlane.domainRuntime, observability, languageContextService, conversationContextService, userSettingsService, policyLayer, resourceAuthorityRegistry, memoryCaptureService: memory2Service, resources });
  const identityResolver = async ({ platformFacts, scopeFacts }) => { const globalUserId = `${platformFacts.platform}:${platformFacts.platformUserId}`; const roles = ['monarch']; const grants = [...capabilityNames.map((name) => `capability:${name}`), 'memory:group:write', 'memory:project:write', 'memory:confirm', 'memory:promote', ...BUILT_IN_DOMAIN_PERMISSIONS]; if (persistence) { await persistence.repositories.identities.link({ platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, globalUserId, metadata: { fixture: true } }); await persistence.repositories.access.grantRole({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, role: 'monarch' }); for (const grantName of grants) await persistence.repositories.access.grantPermission({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, grantName }); } return { identityContext: createIdentityContext({ globalUserId, platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, linkStatus: persistence ? 'linked' : 'local-fixture', roles, grants, authenticationLevel: 'verified' }), scopeContext: createScopeContext({ userScope: globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, groupScope: scopeFacts.groupId ?? null, threadScope: scopeFacts.threadId ?? null, allowedCapabilities: capabilityNames }) }; };
  const transport = createLocalInterfaceHarness({ identityResolver, requestHandler: runtime.handle });
  return Object.freeze({ config, runtime, transport, observability, store, memoryProvider, memory2Service, memory2Store, memory2Capabilities, persistence, productionAI, projectMemoryStore, projectMemoryRetrieval, projectMemoryContextGuard, projectMemoryIntegration, capabilities, capabilityRegistry, durableTaskQueue, taskStore, temporalService, recurrenceEngine, recurringScheduler, languageStore, languageDetector, languageContextService, languageCapabilities, userSettingsService, settingsStore, userSettingsCapabilities, capabilityNames, policyLayer, featureFlags, featureFlagStore, credentialManager, credentialAccessContext, credentialProviders: credentialDeployment.providers, connectionRegistry, connectionAccessContext, connectionStore: connectionDeployment.store, connectionIds: connectionDeployment.connectionIds, resourceAuthorityRegistry, resourceAuthorityAccessContext, resourceAuthorityStore: authorityDeployment.store, conversationContextService, conversationContextStore: conversationDeployment.store, selfKnowledgeStore, selfKnowledgeService, selfKnowledgeBuilder, selfKnowledgeSources, responseContextAssembler, ownerSecurityConfig, securityPolicyRegistry, ownerSecurityGateway, actionGate, eventBus: controlPlane.eventBus, eventStore: controlPlane.eventStore, contractVersioning: controlPlane.contractVersioning, contractQuarantineStore: controlPlane.contractQuarantineStore, domainRegistry: controlPlane.domainRegistry, domainRuntime: controlPlane.domainRuntime, domainPermissions: BUILT_IN_DOMAIN_PERMISSIONS });
}
