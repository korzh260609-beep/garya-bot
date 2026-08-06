import { randomUUID } from 'node:crypto';
import { createIdentityContext, createScopeContext, createTraceContext } from './contracts/context.js';

export function createFoundationResponse({ input = 'foundation-check' } = {}) {
  const traceId = randomUUID();
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
    traceId,
    requestId: randomUUID(),
    environment: process.env.SG_ENVIRONMENT ?? 'local',
    revision: process.env.SG_REVISION ?? 'dev'
  });

  return Object.freeze({
    status: 'foundation-ready',
    input,
    identityContext,
    scopeContext,
    traceContext
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(createFoundationResponse(), null, 2)}\n`);
}
