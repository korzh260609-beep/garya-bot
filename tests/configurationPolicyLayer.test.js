import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationPolicyLayer, DEFAULT_POLICY } from '../src/config/configurationPolicyLayer.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createActionGate } from '../src/action/actionGate.js';
import { createIdentityContext, createScopeContext } from '../src/contracts/context.js';
import { createActionRequest } from '../src/contracts/action.js';

function protectedRequest({ grants = ['project:update'], risk = 'high', cost = 0 } = {}) {
  return createActionRequest({
    capability: 'update-project', actionType: 'update', actionClass: 'state-changing',
    actor: createIdentityContext({ globalUserId: 'u1', platform: 'local', platformUserId: 'u1', roles: [], grants, authenticationLevel: 'verified' }),
    scope: createScopeContext({ userScope: 'u1', projectScope: 'sg2.1', allowedCapabilities: ['update-project'] }),
    requiredPermission: 'project:update', risk, estimatedCostUsd: cost,
    traceContext: { traceId: 't1', requestId: 'r1' }
  });
}

test('resolves default policy deterministically', () => {
  const layer = createConfigurationPolicyLayer();
  const result = layer.resolve();
  assert.deepEqual(result.policy, DEFAULT_POLICY);
  assert.equal(result.provenance['ai.routerOnly'], 'defaults');
  assert.equal(result.provenance['repository.mutationMode'], 'defaults');
});

test('applies precedence defaults < environment < project < role deterministically', () => {
  const layer = createConfigurationPolicyLayer({
    environment: { automation: { maxRetryAttempts: 4 } },
    project: { automation: { maxRetryAttempts: 5 } },
    rolePolicies: { monarch: { automation: { maxRetryAttempts: 7 } } }
  });
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

test('resolved policy and provenance are immutable snapshots', () => {
  const result = createConfigurationPolicyLayer({ project: { repository: { mutationMode: 'disabled' } } }).resolve();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.policy), true);
  assert.equal(Object.isFrozen(result.policy.repository), true);
  assert.equal(Object.isFrozen(result.provenance), true);
});

test('Action Gate consumes resolved risk and cost policy', () => {
  const layer = createConfigurationPolicyLayer({ project: { action: { maxAutoRisk: 'high', maxAutoCostUsd: 0.2, requireConfirmationForProtected: false } } });
  const policyContext = layer.resolve();
  const request = protectedRequest({ risk: 'high', cost: 0.1 });
  assert.equal(createActionGate().evaluate(request, { policyContext }).outcome, 'allow');
});

test('policy cannot bypass missing protected permission', () => {
  const layer = createConfigurationPolicyLayer({ project: { action: { failClosed: false, requireConfirmationForProtected: false, maxAutoRisk: 'critical', maxAutoCostUsd: 100 } } });
  const decision = createActionGate().evaluate(protectedRequest({ grants: [], risk: 'low' }), { policyContext: layer.resolve() });
  assert.equal(decision.outcome, 'downgrade-to-prepare');
  assert.ok(decision.reasons.includes('permission-denied'));
});

test('production runtime resolves policy before semantic processing and returns policy evidence', async () => {
  let seenPolicy = null;
  const harness = createLocalProductionHarness({
    interpretationResolver: (input) => {
      seenPolicy = input.metadata.policyContext;
      return { meaning: `Echo: ${input.text}`, goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0, missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'fixture' };
    }
  });
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'policy check', userId: 'gary', projectId: 'sg2.1' });
    assert.equal(seenPolicy.policy.ai.routerOnly, true);
    assert.equal(seenPolicy.policy.ai.directProviderCallsAllowed, false);
    assert.equal(seenPolicy.policy.repository.mutationMode, 'prepare-only');
    assert.equal(result.response.data.policyContext.policy.memory.strictScopeIsolation, true);
  } finally { await harness.runtime.stop(); }
});
