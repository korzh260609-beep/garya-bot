import { randomUUID } from 'node:crypto';
import { createIdentityContext, createScopeContext, createTraceContext } from './contracts/context.js';
import { createFixtureMeaningInterpreter } from './semantic/meaningInterpreter.js';
import { createSemanticKernel } from './semantic/semanticKernel.js';
import { executeSafeNoop } from './semantic/noopCapability.js';

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

export async function runSemanticFixture({
  text = 'Analyze the SG 2.1 semantic kernel',
  interpretation
} = {}) {
  if (!interpretation) {
    throw new TypeError('A semantic interpretation fixture is required until an AI reasoning provider is connected');
  }

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const response = createFoundationResponse({ input: process.argv.slice(2).join(' ') || 'foundation-check' });
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}
