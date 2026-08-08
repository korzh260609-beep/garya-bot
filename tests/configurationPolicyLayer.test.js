import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationPolicyLayer, createEnvironmentPolicyOverrides, DEFAULT_POLICY } from '../src/config/configurationPolicyLayer.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createActionGate } from '../src/action/actionGate.js';
import { createIdentityContext, createScopeContext } from '../src/contracts/context.js';
import { createActionRequest } from '../src/contracts/action.js';

function protectedRequest({ grants = ['project:update'], risk = 'high', cost = 0, requiredSources = [] } = {}) {
  return createActionRequest({
    capability: 'update-project', actionType: 'update', actionClass: 'state-changing',
    actor: createIdentityContext({ globalUserId: 'u1', platform: 'local', platformUserId: 'u1', roles: [], grants, authenticationLevel: 'verified' }),
    scope: createScopeContext({ userScope: 'u1', projectScope: 'sg2.1', allowedCapabilities: ['update-project'] }),
    requiredPermission: 'project:update', requiredSources, risk, estimatedCostUsd: cost,
    traceContext: { traceId: 't1', requestId: 'r1' }
  });
}

test('resolves default policy deterministically', () => {
  const result = createConfigurationPolicyLayer().resolve();
  assert.deepEqual(result.policy, DEFAULT_POLICY);
  assert.equal(result.provenance['ai.routerOnly'], 'defaults');
  assert.equal(result.provenance['capability.maxTimeoutMs'], 'defaults');
  assert.equal(result.provenance['source.maxSourcesPerRequest'], 'defaults');
  assert.equal(result.provenance['delivery.maxAttempts'], 'defaults');
});

test('applies precedence defaults < environment < project < role deterministically', () => {
  const layer = createConfigurationPolicyLayer({ environment: { automation: { maxRetryAttempts: 4 } }, project: { automation: { maxRetryAttempts: 5 } }, rolePolicies: { monarch: { automation: { maxRetryAttempts: 7 } } } });
  const result = layer.resolve({ roles: ['monarch'] });
  assert.equal(result.policy.automation.maxRetryAttempts, 7);
  assert.equal(result.provenance['automation.maxRetryAttempts'], 'role:monarch');
});

test('role ordering is stable and cannot make policy resolution nondeterministic', () => {
  const layer = createConfigurationPolicyLayer({ rolePolicies: { citizen: { action: { maxAutoCostUsd: 0.02 } }, monarch: { action: { maxAutoCostUsd: 1 } } } });
  assert.deepEqual(layer.resolve({ roles: ['monarch', 'citizen'] }), layer.resolve({ roles: ['citizen', 'monarch'] }));
});

test('rejects unknown policy keys and invalid values', () => {
  assert.throws(() => createConfigurationPolicyLayer({ project: { unknown: { flag: true } } }), /unknown policy key/);
  assert.throws(() => createConfigurationPolicyLayer({ project: { action: { failClosed: 'yes' } } }), /must be boolean/);
  assert.throws(() => createConfigurationPolicyLayer({ project: { automation: { maxRetryAttempts: 0 } } }), /positive integer/);
  assert.throws(() => createConfigurationPolicyLayer({ project: { action: { maxAutoCostUsd: -1 } } }), /non-negative number/);
  assert.throws(() => createConfigurationPolicyLayer({ project: { action: { maxAutoRisk: 'extreme' } } }), /must be one of/);
});

test('environment inputs are typed and become explicit environment provenance', () => {
  const environment = createEnvironmentPolicyOverrides({ AI_TIMEOUT_MS: '1234', AI_MAX_RETRIES: '2', SG_CAPABILITY_MAX_RETRIES: '3', SG_SOURCE_MAX_PER_REQUEST: '4', SG_DELIVERY_MAX_ATTEMPTS: '5' });
  const resolved = createConfigurationPolicyLayer({ environment }).resolve();
  assert.equal(resolved.policy.ai.timeoutMs, 1234);
  assert.equal(resolved.policy.capability.maxRetries, 3);
  assert.equal(resolved.policy.source.maxSourcesPerRequest, 4);
  assert.equal(resolved.policy.delivery.maxAttempts, 5);
  assert.equal(resolved.provenance['ai.timeoutMs'], 'environment');
  assert.throws(() => createEnvironmentPolicyOverrides({ SG_SOURCE_MAX_PER_REQUEST: 'zero' }), /positive integer/);
});

test('safe hot reload returns a new layer and rejects authorization-sensitive paths', () => {
  const base = createConfigurationPolicyLayer();
  const reloaded = base.withSafeHotReload({ capability: { maxRetries: 2 }, delivery: { maxAttempts: 2 } });
  assert.equal(base.resolve().policy.capability.maxRetries, 5);
  assert.equal(reloaded.resolve().policy.capability.maxRetries, 2);
  assert.equal(reloaded.resolve().policy.delivery.maxAttempts, 2);
  assert.throws(() => base.withSafeHotReload({ action: { maxAutoRisk: 'high' } }), /hot reload is not allowed/);
  assert.throws(() => base.withSafeHotReload({ ai: { routerOnly: false } }), /hot reload is not allowed/);
});

test('resolved policy and provenance are immutable snapshots', () => {
  const result = createConfigurationPolicyLayer({ project: { repository: { mutationMode: 'disabled' } } }).resolve();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.policy), true);
  assert.equal(Object.isFrozen(result.policy.repository), true);
  assert.equal(Object.isFrozen(result.provenance), true);
});

test('Action Gate consumes resolved risk cost and source policies', () => {
  const layer = createConfigurationPolicyLayer({ project: { action: { maxAutoRisk: 'high', maxAutoCostUsd: 0.2, requireConfirmationForProtected: false }, source: { maxSourcesPerRequest: 1 } } });
  const policyContext = layer.resolve();
  assert.equal(createActionGate({ availableSources: ['s1', 's2'] }).evaluate(protectedRequest({ risk: 'high', cost: 0.1, requiredSources: ['s1'] }), { policyContext }).outcome, 'allow');
  const blocked = createActionGate({ availableSources: ['s1', 's2'] }).evaluate(protectedRequest({ risk: 'low', requiredSources: ['s1', 's2'] }), { policyContext });
  assert.equal(blocked.outcome, 'downgrade-to-prepare');
  assert.ok(blocked.reasons.includes('source-policy-limit-exceeded'));
});

test('policy cannot bypass missing protected permission', () => {
  const layer = createConfigurationPolicyLayer({ project: { action: { failClosed: false, requireConfirmationForProtected: false, maxAutoRisk: 'critical', maxAutoCostUsd: 100 } } });
  const decision = createActionGate().evaluate(protectedRequest({ grants: [], risk: 'low' }), { policyContext: layer.resolve() });
  assert.equal(decision.outcome, 'downgrade-to-prepare');
  assert.ok(decision.reasons.includes('permission-denied'));
});

test('production runtime resolves environment policy before semantic processing and returns policy evidence', async () => {
  let seenPolicy = null;
  const harness = createLocalProductionHarness({
    env: { SG_CAPABILITY_MAX_RETRIES: '2', SG_SOURCE_MAX_PER_REQUEST: '7' },
    interpretationResolver: (input) => {
      seenPolicy = input.metadata.policyContext;
      return { meaning: `Echo: ${input.text}`, goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0, missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'fixture' };
    }
  });
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'policy check', userId: 'gary', projectId: 'sg2.1' });
    assert.equal(seenPolicy.policy.ai.routerOnly, true);
    assert.equal(seenPolicy.policy.capability.maxRetries, 2);
    assert.equal(seenPolicy.policy.source.maxSourcesPerRequest, 7);
    assert.equal(seenPolicy.provenance['capability.maxRetries'], 'environment');
    assert.equal(result.response.data.policyContext.policy.memory.strictScopeIsolation, true);
  } finally { await harness.runtime.stop(); }
});
