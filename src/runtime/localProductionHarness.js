import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { createFixtureMeaningInterpreter } from '../semantic/meaningInterpreter.js';
import { createSemanticKernel } from '../semantic/semanticKernel.js';
import { createContextAwareSemanticPipeline } from '../memory/contextAwareSemanticPipeline.js';
import { createContextResolver } from '../memory/contextResolver.js';
import { createInMemoryMemoryProvider } from '../memory/inMemoryMemoryProvider.js';
import { createPostgresMemoryProvider, createPostgresObservabilityStore, createPostgresPersistence } from '../persistence/index.js';
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
import { createProductionRuntime } from './createProductionRuntime.js';
import { loadRuntimeConfig } from './config.js';

function aiRequested(env) { return ['1', 'true', 'yes', 'on'].includes(String(env.SG_AI_ENABLED ?? '').trim().toLowerCase()); }
function createCredentialAuditAdapter(observability, config) { let sequence = 0; return Object.freeze({ record(event) { sequence += 1; const correlation = `credential-${sequence}`; return observability.record({ ...event, eventClass: 'audit_event', traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision }, reason: event.data?.reason ?? null, data: { ...(event.data ?? {}), credentialEventClass: event.eventClass } }); } }); }

export function createLocalProductionHarness({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const config = loadRuntimeConfig({ SG_ENVIRONMENT: 'local-production-like', SG_REVISION: 'block-16.12', SG_PROJECT_SCOPE: 'sg2.1', ...env });
  const policyLayer = createDefaultConfigurationPolicyLayer({ environment: createEnvironmentPolicyOverrides(env) });
  const basePolicy = policyLayer.resolve().policy;
  const persistence = config.persistenceMode === 'postgres' ? createPostgresPersistence({ connectionString: config.databaseUrl, ssl: config.databaseSsl, applicationName: 'sg-2-1-runtime' }) : null;
  const store = persistence ? createPostgresObservabilityStore({ observabilityRepository: persistence.repositories.observability }) : createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store });
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
  const baseMemoryProvider = persistence ? createPostgresMemoryProvider({ memoryRepository: persistence.repositories.memory, clock }) : createInMemoryMemoryProvider({ clock });
  const memoryProvider = createTemporalMemoryProvider({ memoryProvider: baseMemoryProvider });
  const durableTaskQueue = persistence ? createPostgresTaskQueue({ database: persistence.database }) : null;
  const baseTaskStore = persistence ? createPostgresProductionTaskStore({ database: persistence.database, taskQueue: durableTaskQueue }) : createInMemoryProductionTaskStore();
  const temporalService = createTemporalContextService({ clock, timezoneStore });
  const productionAI = !interpretationResolver && aiRequested(env) ? createProductionAI({ env, fetchImpl, configurationPolicy: basePolicy, credentialManager, credentialAccessContext, connectionRegistry, connectionAccessContext }) : null;
  const languageDetector = productionAI?.aiRouter ? createAILanguageDetector({ aiRouter: productionAI.aiRouter }) : null;
  const languageContextService = createLanguageContextService({ store: languageStore, detector: languageDetector, fallbackLanguage: env.SG_FALLBACK_LANGUAGE ?? 'en' });
  const recurrenceEngine = createRecurrenceEngine({ temporalService });
  const recurringScheduler = persistence ? createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine, clock }) : null;
  const taskStore = createTemporalTaskStore({ taskStore: baseTaskStore, temporalService, recurringScheduler });
  const contextResolver = createContextResolver({ memoryProvider });
  const conversationResponder = createLanguageAwareConversationResponder({ aiRouter: productionAI?.aiRouter ?? null });
  const baseMeaningInterpreter = productionAI?.meaningInterpreter ?? createFixtureMeaningInterpreter(interpretationResolver ?? ((input) => ({ meaning: `Runtime processed: ${input.text}`, goal: 'respond', intent: 'answer', contextNeeds: [], evidenceNeeds: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'Deterministic production-like interpretation with AI disabled.' })));
  const meaningInterpreter = createTemporalAwareMeaningInterpreter({ baseInterpreter: baseMeaningInterpreter, temporalService });
  const semanticPipeline = createContextAwareSemanticPipeline({ semanticKernel: createSemanticKernel({ meaningInterpreter }), contextResolver });
  const temporalCapabilities = createTemporalCapabilities({ temporalService, memoryProvider, recurringScheduler });
  const languageCapabilities = createLanguageCapabilities({ languageContextService });
  const userSettingsCapabilities = createUserSettingsCapabilities({ userSettingsService });
  const capabilityNames = Object.freeze([...PRODUCTION_CAPABILITY_NAMES, ...temporalCapabilities.map((item) => item.name), ...languageCapabilities.map((item) => item.name), ...userSettingsCapabilities.map((item) => item.name)]);
  const capabilities = Object.freeze([
    ...createProductionCapabilities({ memoryProvider, taskStore, conversationResponder, sourceRetriever: async ({ sourceId, query }) => sourceId === 'local-fixture' ? { ok: true, message: 'Approved local source retrieved', query, data: { sourceId, query }, sources: [sourceId] } : { ok: false, code: 'source-not-approved', message: 'Source is not approved', retryable: false, sources: [] }, repositoryAnalyzer: async ({ mode, files = [] }) => ({ mode, files: [...files], findings: [], mutated: false, message: 'Repository analysis completed in read/prepare-only mode', sources: ['repository-read-source'] }), diagnosticsProvider: async () => ({ status: 'ready', revision: config.revision, environment: config.environment, capabilityCount: capabilityNames.length, languageContext: 'ready', conversationContext: 'ready', userSettings: 'ready', policyLayer: 'ready', credentialBoundary: 'ready', credentialProviders: credentialDeployment.providers, connectionRegistry: 'ready', connectionIds: connectionDeployment.connectionIds, resourceAuthority: 'ready' }) }),
    ...temporalCapabilities, ...languageCapabilities, ...userSettingsCapabilities
  ]);
  const capabilityRegistry = createCapabilityRegistry({ capabilities });
  const capabilityExecutor = createCapabilityExecutor({ registry: capabilityRegistry });
  const actionGate = createActionGate({ availableSources: ['approved-source-registry', 'repository-read-source'], availableTools: ['source-retriever', 'document-analyzer', 'repository-analyzer'] });
  const resources = persistence ? [persistence, connectionDeployment.resource, store] : [connectionDeployment.resource];
  const runtime = createProductionRuntime({ config, semanticPipeline, actionGate, capabilityRegistry, capabilityExecutor, observability, languageContextService, conversationContextService, userSettingsService, policyLayer, resourceAuthorityRegistry, resources });
  const identityResolver = async ({ platformFacts, scopeFacts }) => { const globalUserId = `${platformFacts.platform}:${platformFacts.platformUserId}`; const roles = ['monarch']; if (persistence) { await persistence.repositories.identities.link({ platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, globalUserId, metadata: { fixture: true } }); await persistence.repositories.access.grantRole({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, role: 'monarch' }); for (const name of capabilityNames) await persistence.repositories.access.grantPermission({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, grantName: `capability:${name}` }); } return { identityContext: createIdentityContext({ globalUserId, platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, linkStatus: persistence ? 'linked' : 'local-fixture', roles, grants: capabilityNames.map((name) => `capability:${name}`), authenticationLevel: 'verified' }), scopeContext: createScopeContext({ userScope: globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, groupScope: scopeFacts.groupId ?? null, threadScope: scopeFacts.threadId ?? null, allowedCapabilities: capabilityNames }) }; };
  const transport = createLocalInterfaceHarness({ identityResolver, requestHandler: runtime.handle });
  return Object.freeze({ config, runtime, transport, observability, store, memoryProvider, persistence, productionAI, capabilities, capabilityRegistry, durableTaskQueue, taskStore, temporalService, recurrenceEngine, recurringScheduler, languageStore, languageDetector, languageContextService, languageCapabilities, userSettingsService, settingsStore, userSettingsCapabilities, capabilityNames, policyLayer, credentialManager, credentialAccessContext, credentialProviders: credentialDeployment.providers, connectionRegistry, connectionAccessContext, connectionStore: connectionDeployment.store, connectionIds: connectionDeployment.connectionIds, resourceAuthorityRegistry, resourceAuthorityAccessContext, resourceAuthorityStore: authorityDeployment.store, conversationContextService, conversationContextStore: conversationDeployment.store });
}
