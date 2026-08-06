import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { createFixtureMeaningInterpreter } from '../semantic/meaningInterpreter.js';
import { createSemanticKernel } from '../semantic/semanticKernel.js';
import { createContextAwareSemanticPipeline } from '../memory/contextAwareSemanticPipeline.js';
import { createContextResolver } from '../memory/contextResolver.js';
import { createInMemoryMemoryProvider } from '../memory/inMemoryMemoryProvider.js';
import { createPostgresMemoryProvider, createPostgresPersistence } from '../persistence/index.js';
import { createActionGate } from '../action/actionGate.js';
import { createCapability } from '../contracts/capability.js';
import { createCapabilityRegistry } from '../capability/capabilityRegistry.js';
import { createCapabilityExecutor } from '../capability/capabilityExecutor.js';
import { createInMemoryObservabilityStore } from '../observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../observability/observabilityService.js';
import { createLocalInterfaceHarness } from '../interfaces/localHarness.js';
import { createProductionRuntime } from './createProductionRuntime.js';
import { loadRuntimeConfig } from './config.js';

export function createLocalProductionHarness({ env = {}, interpretationResolver } = {}) {
  const config = loadRuntimeConfig({ SG_ENVIRONMENT: 'local-production-like', SG_REVISION: 'block-12', SG_PROJECT_SCOPE: 'sg2.1', ...env });
  const persistence = config.persistenceMode === 'postgres' ? createPostgresPersistence({ connectionString: config.databaseUrl, ssl: config.databaseSsl, applicationName: 'sg-2-1-runtime' }) : null;
  const memoryProvider = persistence ? createPostgresMemoryProvider({ memoryRepository: persistence.repositories.memory }) : createInMemoryMemoryProvider();
  const contextResolver = createContextResolver({ memoryProvider });
  const meaningInterpreter = createFixtureMeaningInterpreter(interpretationResolver ?? ((input) => ({
    meaning: `Runtime processed: ${input.text}`,
    goal: 'respond',
    intent: 'answer',
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'Deterministic Block 12 production-like interpretation.'
  })));
  const semanticPipeline = createContextAwareSemanticPipeline({ semanticKernel: createSemanticKernel({ meaningInterpreter }), contextResolver });
  const capabilityRegistry = createCapabilityRegistry({ capabilities: [createCapability({
    name: 'compose-answer',
    actionTypes: ['answer'],
    actionClasses: ['analysis-only'],
    requiredPermissions: ['capability:compose-answer'],
    execute: async (request) => ({ status: 'success', data: { message: `SG runtime ready: ${request.input.text ?? 'request completed'}` } })
  })] });
  const capabilityExecutor = createCapabilityExecutor({ registry: capabilityRegistry });
  const actionGate = createActionGate();
  const store = createInMemoryObservabilityStore();
  const observability = createObservabilityService({ store });
  const runtime = createProductionRuntime({ config, semanticPipeline, actionGate, capabilityExecutor, observability, resources: persistence ? [persistence] : [] });

  const identityResolver = async ({ platformFacts, scopeFacts }) => {
    const globalUserId = `${platformFacts.platform}:${platformFacts.platformUserId}`;
    if (persistence) {
      await persistence.repositories.identities.link({ platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, globalUserId, metadata: { fixture: true } });
      await persistence.repositories.access.grantRole({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, role: 'monarch' });
      await persistence.repositories.access.grantPermission({ globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, grantName: 'capability:compose-answer' });
    }
    return {
      identityContext: createIdentityContext({ globalUserId, platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, linkStatus: persistence ? 'persistent-link' : 'local-fixture', roles: ['monarch'], grants: ['capability:compose-answer'], authenticationLevel: 'verified' }),
      scopeContext: createScopeContext({ userScope: globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, allowedCapabilities: ['compose-answer'] })
    };
  };
  const transport = createLocalInterfaceHarness({ identityResolver, requestHandler: runtime.handle });
  return Object.freeze({ config, runtime, transport, observability, store, memoryProvider, persistence });
}
