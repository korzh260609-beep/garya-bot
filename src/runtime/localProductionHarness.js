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
import { createInMemoryTimezoneStore } from '../temporal/temporalService.js';
import { createTemporalContextService } from '../temporal/temporalContextService.js';
import { createRecurrenceEngine } from '../temporal/recurrenceEngine.js';
import { createPostgresTimezoneStore } from '../temporal/postgresTimezoneStore.js';
import { createTemporalAwareMeaningInterpreter } from '../temporal/temporalMeaningInterpreter.js';
import { createTemporalCapabilities, TEMPORAL_CAPABILITY_NAMES } from '../temporal/temporalCapabilities.js';
import { createTemporalTaskStore } from '../temporal/temporalTaskStore.js';
import { createTemporalMemoryProvider } from '../temporal/temporalMemoryProvider.js';
import { createProductionRuntime } from './createProductionRuntime.js';
import { loadRuntimeConfig } from './config.js';

function aiRequested(env) {
  return ['1', 'true', 'yes', 'on'].includes(String(env.SG_AI_ENABLED ?? '').trim().toLowerCase());
}

export function createLocalProductionHarness({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const config = loadRuntimeConfig({ SG_ENVIRONMENT: 'local-production-like', SG_REVISION: 'block-16.5', SG_PROJECT_SCOPE: 'sg2.1', ...env });
  const persistence = config.persistenceMode === 'postgres' ? createPostgresPersistence({ connectionString: config.databaseUrl, ssl: config.databaseSsl, applicationName: 'sg-2-1-runtime' }) : null;
  const baseMemoryProvider = persistence ? createPostgresMemoryProvider({ memoryRepository: persistence.repositories.memory, clock }) : createInMemoryMemoryProvider({ clock });
  const memoryProvider = createTemporalMemoryProvider({ memoryProvider: baseMemoryProvider });
  const durableTaskQueue = persistence ? createPostgresTaskQueue({ database: persistence.database }) : null;
  const baseTaskStore = persistence ? createPostgresProductionTaskStore({ database: persistence.database, taskQueue: durableTaskQueue }) : createInMemoryProductionTaskStore();
  const timezoneStore = persistence ? createPostgresTimezoneStore({ database: persistence.database }) : createInMemoryTimezoneStore();
  const temporalService = createTemporalContextService({ clock, timezoneStore });
  const recurrenceEngine = createRecurrenceEngine({ temporalService });
  const recurringScheduler = persistence ? createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine, clock }) : null;
  const taskStore = createTemporalTaskStore({ taskStore: baseTaskStore, temporalService, recurringScheduler });
  const contextResolver = createContextResolver({ memoryProvider });
  const productionAI = !interpretationResolver && aiRequested(env) ? createProductionAI({ env, fetchImpl }) : null;
  const baseMeaningInterpreter = productionAI?.meaningInterpreter ?? createFixtureMeaningInterpreter(interpretationResolver ?? ((input) => ({
    meaning: `Runtime processed: ${input.text}`,
    goal: 'respond',
    intent: 'answer',
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'Deterministic production-like interpretation with AI disabled.',
  })));
  const meaningInterpreter = createTemporalAwareMeaningInterpreter({ baseInterpreter: baseMeaningInterpreter, temporalService });
  const semanticPipeline = createContextAwareSemanticPipeline({ semanticKernel: createSemanticKernel({ meaningInterpreter }), contextResolver });
  const temporalCapabilities = createTemporalCapabilities({ temporalService, memoryProvider });
  const capabilityNames = Object.freeze([...PRODUCTION_CAPABILITY_NAMES, ...TEMPORAL_CAPABILITY_NAMES]);
  const capabilities = Object.freeze([
    ...createProductionCapabilities({
      memoryProvider,
      taskStore,
      sourceRetriever: async ({ sourceId, query }) => sourceId === 'local-fixture'
        ? { ok: true, message: 'Approved local source retrieved', query, data: { sourceId, query }, sources: [sourceId] }
        : { ok: false, code: 'source-not-approved', message: 'Source is not approved', retryable: false, sources: [] },
      repositoryAnalyzer: async ({ mode, files = [] }) => ({ mode, files: [...files], findings: [], mutated: false, message: 'Repository analysis completed in read/prepare-only mode', sources: ['repository-read-source'] }),
      diagnosticsProvider: async () => ({ status: 'ready', revision: config.revision, environment: config.environment, capabilityCount: capabilityNames.length })
    }),
    ...temporalCapabilities
  ]);
  const capabilityRegistry = createCapabilityRegistry({ capabilities });
  const capabilityExecutor = createCapabilityExecutor({ registry: capabilityRegistry });
  const actionGate = createActionGate({ availableSources: ['approved-source-registry', 'repository-read-source'], availableTools: ['source-retriever', 'document-analyzer', 'repository-analyzer'] });
  const store = persistence ? createPostgresObservabilityStore({ observabilityRepository: persistence.repositories.observability }) : createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store });
  const resources = persistence ? [persistence, store] : [];
  const runtime = createProductionRuntime({ config, semanticPipeline, actionGate, capabilityRegistry, capabilityExecutor, observability, resources });

  const identityResolver = async ({ platformFacts, scopeFacts }) => {
    const globalUserId = `${platformFacts.platform}:${platformFacts.platformUserId}`;
    if (persistence) {
      await persistence.repositories.identities.link({ platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, globalUserId, metadata: { fixture: true } });
      await persistence.repositories.access.grantRole({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, role: 'monarch' });
      for (const name of capabilityNames) await persistence.repositories.access.grantPermission({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, grantName: `capability:${name}` });
    }
    return {
      identityContext: createIdentityContext({ globalUserId, platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, linkStatus: persistence ? 'linked' : 'local-fixture', roles: ['monarch'], grants: capabilityNames.map((name) => `capability:${name}`), authenticationLevel: 'verified' }),
      scopeContext: createScopeContext({ userScope: globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, allowedCapabilities: capabilityNames })
    };
  };
  const transport = createLocalInterfaceHarness({ identityResolver, requestHandler: runtime.handle });
  return Object.freeze({ config, runtime, transport, observability, store, memoryProvider, persistence, productionAI, capabilities, capabilityRegistry, durableTaskQueue, taskStore, temporalService, recurrenceEngine, recurringScheduler, capabilityNames });
}
