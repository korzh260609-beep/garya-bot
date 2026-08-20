import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskAssessment } from '../src/ai/taskAssessment.js';
import { createTierSelector } from '../src/ai/tierSelector.js';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';

const selector = createTierSelector();
const assessment = (signals = {}) => createTaskAssessment(signals);

test('AR2.5 selects L1 only for bounded low-cost task classes', () => {
  assert.equal(selector.select({ taskClass: 'classification', assessment: assessment({ complexity: 0.1 }) }).tier, 'L1');
  assert.equal(selector.select({ taskClass: 'ordinary-conversation', assessment: assessment({ complexity: 0.1 }) }).tier, 'L2');
});

test('AR2.5 selects L3 when advanced reasoning reliability signals require it', () => {
  assert.equal(selector.select({ taskClass: 'analysis', assessment: assessment({ codingDebugging: 0.8 }) }).tier, 'L3');
  assert.equal(selector.select({ taskClass: 'history', assessment: assessment({ evidenceConflict: 0.9 }) }).tier, 'L3');
  assert.equal(selector.select({
    taskClass: 'analysis', assessment: assessment({ complexity: 1, reasoningDepth: 1, risk: 1, ambiguity: 1, toolDepth: 1, contextPressure: 1, evidenceSources: 1 })
  }).tier, 'L3');
});

test('AR2.5 trusted minimum may upgrade but maximum cannot undercut reliable tier', () => {
  const upgraded = selector.select({
    taskClass: 'classification', assessment: assessment(),
    trustedRoutingPolicy: { source: 'trusted-sg-policy', minimumTier: 'L2', maximumTier: 'L3' }
  });
  assert.equal(upgraded.tier, 'L2');
  assert.equal(upgraded.reason, 'trusted-minimum-tier');
  assert.throws(() => selector.select({
    taskClass: 'analysis', assessment: assessment({ codingDebugging: 1 }),
    trustedRoutingPolicy: { source: 'trusted-sg-policy', maximumTier: 'L2' }
  }), /below the minimum reliable tier/);
});

test('AR2.5 rejects untrusted tier constraints', () => {
  assert.throws(() => selector.select({
    taskClass: 'classification', assessment: assessment(),
    trustedRoutingPolicy: { source: 'user-request', minimumTier: 'L3' }
  }), /trusted-sg-policy/);
});

test('AR2.5 tier decision becomes the enforced registry requirement in AR2.6', async () => {
  let providerRequest;
  const router = createAIRouter({
    registry: createModelRegistry([{ id: 'advanced', provider: 'fixture', model: 'advanced-model', specialties: ['reasoning'], tier: 'L3' }]),
    providers: { fixture: { async generate({ request }) { providerRequest = request; return { text: 'ok' }; } } }
  });
  const result = await router.route({
    task: 'analysis', reason: 'AR2.5 integration', messages: [{ role: 'user', content: 'debug' }],
    traceContext: { traceId: 'trace-ar25', requestId: 'request-ar25' },
    taskAssessmentSignals: { codingDebugging: 1 }
  });
  assert.equal(providerRequest.routing.tierSelection.tier, 'L3');
  assert.equal(result.model, 'advanced-model');
  assert.equal(result.tier, 'L3');
});
