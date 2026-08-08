import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

test('Block 16.16 configured capability flag controls production runtime without bypassing Action Gate', async () => {
  const harness = createLocalProductionHarness();
  await harness.runtime.start();
  try {
    await harness.featureFlags.setFlag({ featureId: 'capability:compose-answer', enabled: false });
    const blocked = await harness.transport.send({ text: 'hello', userId: 'developer', projectId: 'sg2.1' });
    assert.equal(blocked.response.status, 'unavailable');
    assert.equal(blocked.response.data.execution.error.code, 'feature-disabled');

    await harness.featureFlags.setFlag({ featureId: 'capability:compose-answer', enabled: true, roles: ['monarch'] });
    const allowed = await harness.transport.send({ text: 'hello again', userId: 'developer', projectId: 'sg2.1' });
    assert.equal(allowed.response.status, 'success');
  } finally {
    await harness.runtime.stop();
  }
});

test('Block 16.16 unconfigured capabilities preserve existing production behavior', async () => {
  const harness = createLocalProductionHarness();
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'normal request', userId: 'developer', projectId: 'sg2.1' });
    assert.equal(result.response.status, 'success');
  } finally {
    await harness.runtime.stop();
  }
});
