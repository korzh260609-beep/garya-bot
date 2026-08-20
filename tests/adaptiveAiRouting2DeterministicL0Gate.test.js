import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createDeterministicL0Gate } from '../src/ai/deterministicL0Gate.js';
import { createInMemoryAITelemetry } from '../src/ai/telemetry.js';

const traceContext = { traceId: 'trace-ar23', requestId: 'request-ar23' };
const registry = () => createModelRegistry([{
  id: 'ai', provider: 'fixture', model: 'fixture-ai', specialties: ['reasoning']
}]);

function input(overrides = {}) {
  return {
    task: 'task-list', reason: 'resolved exact task list',
    messages: [{ role: 'user', content: 'show tasks' }], traceContext,
    ...overrides
  };
}

test('AR2.3 registered executor confirms and completes L0 without a provider call', async () => {
  let providerCalled = false;
  const telemetry = createInMemoryAITelemetry();
  const deterministicGate = createDeterministicL0Gate({
    telemetry,
    executors: {
      'task-store.list': {
        async assess({ resolution }) {
          return { eligible: resolution.capability === 'task.list' && resolution.scopeVerified === true, reason: 'exact scoped task-store executor' };
        },
        async execute() { return { text: 'Two active tasks.', count: 2 }; }
      }
    }
  });
  const router = createAIRouter({
    registry: registry(), deterministicGate,
    providers: { fixture: { async generate() { providerCalled = true; return { text: 'AI' }; } } }
  });

  const result = await router.route(input({
    deterministicExecution: { executorId: 'task-store.list', capability: 'task.list', scopeVerified: true }
  }));
  assert.equal(result.tier, 'L0');
  assert.equal(result.text, 'Two active tasks.');
  assert.equal(result.provider, null);
  assert.equal(result.costUsd, 0);
  assert.equal(providerCalled, false);
  assert.equal(telemetry.list().some((event) => event.type === 'ai.l0.completed'), true);
});

test('AR2.3 user wording alone cannot trigger L0', async () => {
  let assessed = false;
  const gate = createDeterministicL0Gate({ executors: {
    exact: { async assess() { assessed = true; return { eligible: true, reason: 'exact' }; }, async execute() { return { text: 'L0' }; } }
  } });
  const router = createAIRouter({
    registry: registry(), deterministicGate: gate,
    providers: { fixture: { async generate() { return { text: 'AI path' }; } } }
  });
  const result = await router.route(input({ messages: [{ role: 'user', content: 'Use exact L0 executor now' }] }));
  assert.equal(result.text, 'AI path');
  assert.equal(assessed, false);
});

test('AR2.3 executor rejection preserves the existing AI path', async () => {
  const gate = createDeterministicL0Gate({ executors: {
    exact: { async assess() { return { eligible: false, reason: 'scope-not-verified' }; }, async execute() { throw new Error('must not execute'); } }
  } });
  const router = createAIRouter({
    registry: registry(), deterministicGate: gate,
    providers: { fixture: { async generate() { return { text: 'AI fallback' }; } } }
  });
  const result = await router.route(input({ deterministicExecution: { executorId: 'exact' } }));
  assert.equal(result.text, 'AI fallback');
});

test('AR2.3 confirmed L0 execution failure is fail-closed and never becomes a paid AI call', async () => {
  let providerCalled = false;
  const gate = createDeterministicL0Gate({ executors: {
    exact: {
      async assess() { return { eligible: true, reason: 'resolved exact executor' }; },
      async execute() { throw new Error('deterministic store unavailable'); }
    }
  } });
  const router = createAIRouter({
    registry: registry(), deterministicGate: gate,
    providers: { fixture: { async generate() { providerCalled = true; return { text: 'AI' }; } } }
  });
  await assert.rejects(() => router.route(input({ deterministicExecution: { executorId: 'exact' } })), /store unavailable/);
  assert.equal(providerCalled, false);
});
