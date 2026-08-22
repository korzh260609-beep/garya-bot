import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionRuntime } from '../src/runtime/createProductionRuntime.js';

test('clarification-required canonical result never reaches Action Gate or GitHub capability execution', async () => {
  let gateCalls = 0;
  let executionCalls = 0;
  const runtime = createProductionRuntime({
    config: { environment: 'test', revision: 'canonical-clarification-guard', shutdownTimeoutMs: 1000 },
    semanticPipeline: {
      async process() {
        return {
          canonicalSemanticModel: {
            version: '1.0', resolutionStatus: 'clarification-required', confidence: 0.2,
            missingInformation: ['development-target']
          },
          decisionEnvelope: {
            traceId: 'trace-canonical-clarification', requestId: 'request-canonical-clarification',
            decisionType: 'clarification', intent: 'github-development',
            selectedAction: {
              type: 'github-development', name: 'github-development', actionClass: 'state-change',
              payload: { mode: 'execute', canonicalAction: 'github.development.execute', canonicalModel: { resolutionStatus: 'clarification-required' } }
            }
          },
          responsePlan: { mode: 'clarification', message: 'Уточните этап разработки.', requiresConfirmation: false, preparedAction: null }
        };
      }
    },
    actionGate: { evaluate() { gateCalls += 1; throw new Error('clarification must not reach Action Gate'); } },
    capabilityExecutor: { async execute() { executionCalls += 1; throw new Error('clarification must not execute'); } },
    observability: { record() {}, recordFailure() {} }
  });
  await runtime.start();
  const response = await runtime.handle({
    text: 'Реализуй этап', locale: 'ru',
    identityContext: { globalUserId: 'usr-monarch', roles: ['monarch'], grants: [], authenticationLevel: 'verified' },
    scopeContext: { userScope: 'usr-monarch', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-canonical-clarification', requestId: 'request-canonical-clarification' },
    metadata: { transport: 'telegram' }
  });
  await runtime.stop();
  assert.equal(response.status, 'clarification-required');
  assert.equal(response.message, 'Уточните этап разработки.');
  assert.equal(response.data.canonicalResolution.status, 'clarification-required');
  assert.equal(gateCalls, 0);
  assert.equal(executionCalls, 0);
});
