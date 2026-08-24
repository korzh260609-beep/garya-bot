import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraceContext } from '../src/contracts/context.js';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';

function trace() {
  return createTraceContext({ traceId: 'trace-1', requestId: 'request-1', environment: 'test', revision: 'block-7' });
}

function fixture(options = {}) {
  const store = createInMemoryObservabilityStore(options);
  const service = createObservabilityService({ store, clock: () => '2026-08-06T10:00:00.000Z', idFactory: () => 'event-1' });
  return { store, service };
}

test('events preserve correlation, environment and revision', () => {
  const { service } = fixture();
  const event = service.record({ eventClass: 'request_received', channel: 'telemetry', traceContext: trace(), stage: 'transport', transport: 'telegram' });
  assert.equal(event.traceContext.traceId, 'trace-1');
  assert.equal(event.traceContext.environment, 'test');
  assert.equal(event.traceContext.revision, 'block-7');
});

test('audit telemetry and debug data remain separated', () => {
  const { service } = fixture();
  service.record({ eventClass: 'audit_event', channel: 'audit', traceContext: trace(), stage: 'link' });
  service.record({ eventClass: 'request_received', channel: 'telemetry', traceContext: trace(), stage: 'transport' });
  service.record({ eventClass: 'context_loaded', channel: 'debug', traceContext: trace(), stage: 'memory' });
  assert.equal(service.list({ channel: 'audit' }).length, 1);
  assert.equal(service.list({ channel: 'telemetry' }).length, 1);
  assert.equal(service.list({ channel: 'debug' }).length, 1);
});

test('secrets and credentials are redacted recursively', () => {
  const { service } = fixture();
  const event = service.record({
    eventClass: 'request_received', channel: 'debug', traceContext: trace(), stage: 'transport',
    data: { authorization: 'Bearer top-secret', nested: { apiKey: 'secret-value', message: 'token sk-1234567890123456' } }
  });
  assert.equal(event.data.authorization, '[REDACTED]');
  assert.equal(event.data.nested.apiKey, '[REDACTED]');
  assert.equal(event.data.nested.message, 'token [REDACTED]');
});

test('model calls record reason latency usage cost and outcome', () => {
  const { service } = fixture();
  const event = service.recordModelCall({
    traceContext: trace(), model: 'gpt-test', provider: 'openai', reason: 'interpret meaning',
    outcome: 'success', durationMs: 120, costUsd: 0.01, usage: { inputTokens: 10, outputTokens: 5 }
  });
  assert.equal(event.eventClass, 'model_call');
  assert.equal(event.reason, 'interpret meaning');
  assert.equal(event.durationMs, 120);
  assert.equal(event.costUsd, 0.01);
  assert.deepEqual(event.data.usage, { inputTokens: 10, outputTokens: 5 });
});

test('protected actions record actor scope gate and idempotency evidence', () => {
  const { service } = fixture();
  const event = service.recordProtectedAction({
    traceContext: trace(), actorRef: 'user:gary', scopeRef: 'project:sg2.1',
    gateDecision: { outcome: 'allow', authorized: true, reason: 'permitted' },
    idempotencyKey: 'idem-1', capability: 'repository.write', outcome: 'success'
  });
  assert.equal(event.channel, 'audit');
  assert.equal(event.data.gateOutcome, 'allow');
  assert.equal(event.data.idempotencyKey, 'idem-1');
});

test('failures are queryable by trace and stage', () => {
  const { service } = fixture();
  service.recordFailure({ traceContext: trace(), stage: 'capability', reason: 'timeout', code: 'capability-timeout' });
  const failures = service.list({ traceId: 'trace-1', eventClass: 'capability_failed' });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].data.code, 'capability-timeout');
});

test('retention hook can reject events by class or sensitivity policy', () => {
  const { service } = fixture({ retentionPolicy: (event) => event.channel !== 'debug' });
  service.record({ eventClass: 'context_loaded', channel: 'debug', traceContext: trace(), stage: 'memory' });
  service.record({ eventClass: 'request_received', channel: 'telemetry', traceContext: trace(), stage: 'transport' });
  assert.equal(service.list({ channel: 'debug' }).length, 0);
  assert.equal(service.list({ channel: 'telemetry' }).length, 1);
});
