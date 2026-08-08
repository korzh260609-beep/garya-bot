import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationPolicyLayer, DEFAULT_POLICY } from '../src/config/configurationPolicyLayer.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

test('resolves default policy deterministically', () => {
  const layer = createConfigurationPolicyLayer();
  const result = layer.resolve();
  assert.deepEqual(result.policy, DEFAULT_POLICY);
  assert.equal(result.provenance['ai.routerOnly'], 'defaults');
  assert.equal(result.provenance['repository.mutationMode'], 'defaults');
});

test('applies precedence defaults < environment < project < role', () => {
  const layer = createConfigurationPolicyLayer({
    environment: { automation: { maxRetryAttempts: 4 } },
    project: { automation: { maxRetryAttempts: 5 } },
    rolePolicies: { monarch: { automation: { maxRetryAttempts: 7 } } }
  });
  const result = layer.resolve({ roles: ['monarch'] });
  assert.equal(result.policy.automation.maxRetryAttempts, 7);
  assert.equal(result.provenance['automation.maxRetryAttempts'], 'role:monarch');
});

test('rejects unknown policy keys', () => {
  assert.throws(() => createConfigurationPolicyLayer({ project: { unknown: { flag: true } } }), /unknown policy key/);
});

test('rejects invalid policy value types', () => {
  assert.throws(() => createConfigurationPolicyLayer({ project: { action: { failClosed: 'yes' } } }), /must be boolean/);
  assert.throws(() => createConfigurationPolicyLayer({ project: { automation: { maxRetryAttempts: 0 } } }), /positive integer/);
});

test('resolved policy and provenance are immutable snapshots', () => {
  const layer = createConfigurationPolicyLayer({ project: { repository: { mutationMode: 'disabled' } } });
  const result = layer.resolve();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.policy), true);
  assert.equal(Object.isFrozen(result.policy.repository), true);
  assert.equal(Object.isFrozen(result.provenance), true);
});

test('production runtime resolves policy context before semantic processing', async () => {
  let seenPolicy = null;
  const harness = createLocalProductionHarness({
    interpretationResolver: (input) => {
      seenPolicy = input.metadata.policyContext;
      return {
        meaning: `Echo: ${input.text}`,
        goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0,
        missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [],
        candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'fixture'
      };
    }
  });
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'policy check', userId: 'gary', projectId: 'sg2.1' });
    assert.equal(seenPolicy.policy.ai.routerOnly, true);
    assert.equal(seenPolicy.policy.ai.directProviderCallsAllowed, false);
    assert.equal(seenPolicy.policy.repository.mutationMode, 'prepare-only');
    assert.equal(result.response.data.policyContext.policy.memory.strictScopeIsolation, true);
  } finally {
    await harness.runtime.stop();
  }
});
