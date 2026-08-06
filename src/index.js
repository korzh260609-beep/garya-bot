import { randomUUID } from 'node:crypto';
import { createIdentityContext, createScopeContext, createTraceContext } from './contracts/context.js';
import { createFixtureMeaningInterpreter } from './semantic/meaningInterpreter.js';
import { createSemanticKernel } from './semantic/semanticKernel.js';
import { executeSafeNoop } from './semantic/noopCapability.js';
import { createInMemoryMemoryProvider } from './memory/inMemoryMemoryProvider.js';
import { createContextResolver } from './memory/contextResolver.js';
import { createContextAwareSemanticPipeline } from './memory/contextAwareSemanticPipeline.js';

function createLocalContexts() {
  const identityContext = createIdentityContext({
    globalUserId: 'local:developer',
    platform: 'local',
    platformUserId: 'developer'
  });
  const scopeContext = createScopeContext({
    userScope: identityContext.globalUserId,
    projectScope: 'sg2.1',
    allowedCapabilities: []
  });
  const traceContext = createTraceContext({
    traceId: randomUUID(),
    requestId: randomUUID(),
    environment: process.env.SG_ENVIRONMENT ?? 'local',
    revision: process.env.SG_REVISION ?? 'dev'
  });
  return { identityContext, scopeContext, traceContext };
}

export function createFoundationResponse({ input = 'foundation-check' } = {}) {
  const contexts = createLocalContexts();
  return Object.freeze({ status: 'foundation-ready', input, ...contexts });
}

export async function runSemanticFixture({ text = 'Analyze the SG 2.1 semantic kernel', interpretation } = {}) {
  if (!interpretation) throw new TypeError('A semantic interpretation fixture is required until an AI reasoning provider is connected');
  const contexts = createLocalContexts();
  const kernel = createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation)
  });
  const semanticResult = await kernel.process({ text, locale: 'en', ...contexts });
  return Object.freeze({
    status: 'semantic-kernel-ready',
    semanticResult,
    capabilityResult: executeSafeNoop(semanticResult.decisionEnvelope)
  });
}

export async function runContextMemoryFixture() {
  const contexts = createLocalContexts();
  const memoryProvider = createInMemoryMemoryProvider();
  const contextResolver = createContextResolver({ memoryProvider });
  await contextResolver.write({
    layer: 'project-memory',
    key: 'current-block',
    value: 'Context and Memory',
    scope: contexts.scopeContext,
    provenance: { sourceType: 'local-fixture', sourceId: 'block-2-runner', actorId: contexts.identityContext.globalUserId },
    trust: 'confirmed',
    confirmed: true
  });

  const meaningInterpreter = createFixtureMeaningInterpreter((input) => ({
    meaning: input.metadata.contextBundle ? 'Context restored successfully' : 'Project context is required',
    goal: 'restore-project-context',
    intent: 'answer',
    contextNeeds: ['project-memory'],
    candidateActions: [{ type: 'answer', name: 'compose-context-answer', actionClass: 'analysis' }],
    rationale: input.metadata.contextBundle ? 'Confirmed project context is available' : 'Request project context'
  }));
  const pipeline = createContextAwareSemanticPipeline({
    semanticKernel: createSemanticKernel({ meaningInterpreter }),
    contextResolver
  });
  const result = await pipeline.process({ text: 'Continue SG 2.1 development', locale: 'en', ...contexts });
  return Object.freeze({ status: 'context-memory-ready', result });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const response = await runContextMemoryFixture();
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}
