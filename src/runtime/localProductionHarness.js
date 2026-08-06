import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { createFixtureMeaningInterpreter } from '../semantic/meaningInterpreter.js';
import { createSemanticKernel } from '../semantic/semanticKernel.js';
import { createContextAwareSemanticPipeline } from '../memory/contextAwareSemanticPipeline.js';
import { createContextResolver } from '../memory/contextResolver.js';
import { createInMemoryMemoryProvider } from '../memory/inMemoryMemoryProvider.js';
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
  const config = loadRuntimeConfig({ SG_ENVIRONMENT: 'local-production-like', SG_REVISION: 'block-11', SG_PROJECT_SCOPE: 'sg2.1', ...env });
  const memoryProvider = createInMemoryMemoryProvider();
  const contextResolver = createContextResolver({ memoryProvider });
  const meaningInterpreter = createFixtureMeaningInterpreter(interpretationResolver ?? ((input) => ({
    meaning: `Runtime processed: ${input.text}`,
    goal: 'respond',
    intent: 'answer',
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'Deterministic Block 11 local harness interpretation.'
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
  const runtime = createProductionRuntime({ config, semanticPipeline, actionGate, capabilityExecutor, observability });

  const identityResolver = async ({ platformFacts, scopeFacts }) => {
    const globalUserId = `${platformFacts.platform}:${platformFacts.platformUserId}`;
    return {
      identityContext: createIdentityContext({ globalUserId, platform: platformFacts.platform, platformUserId: platformFacts.platformUserId, linkStatus: 'local-fixture', roles: ['monarch'], grants: ['capability:compose-answer'], authenticationLevel: 'verified' }),
      scopeContext: createScopeContext({ userScope: globalUserId, projectScope: scopeFacts.projectId ?? config.projectScope, allowedCapabilities: ['compose-answer'] })
    };
  };
  const transport = createLocalInterfaceHarness({ identityResolver, requestHandler: runtime.handle });
  return Object.freeze({ config, runtime, transport, observability, store, memoryProvider });
}
