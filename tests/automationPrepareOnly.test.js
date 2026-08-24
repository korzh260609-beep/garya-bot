import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrepareOnlyCapability } from '../src/automation/index.js';

test('code and PR preparation capabilities cannot mutate state', async () => {
  for (const kind of ['code.prepare', 'pr.prepare']) {
    const capability = createPrepareOnlyCapability({ kind, prepare: async (input) => ({ draft: input.title }) });
    assert.equal(capability.actionClass, 'prepare-only');
    assert.equal(capability.stateChanging, false);
    const result = await capability.execute({ title: 'Block 9 draft' });
    assert.deepEqual(result, { kind, actionClass: 'prepare-only', prepared: true, output: { draft: 'Block 9 draft' } });
  }
});

test('prepare-only capability rejects state-changing kinds', () => {
  assert.throws(() => createPrepareOnlyCapability({ kind: 'repository.write', prepare: async () => ({}) }), /code\.prepare or pr\.prepare/);
});
