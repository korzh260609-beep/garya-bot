import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadRuntimeConfig } from '../src/runtime/config.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createProductionRuntime } from '../src/runtime/createProductionRuntime.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

const connectionString = process.env.DATABASE_URL;
const postgresIntegration = connectionString ? test : test.skip;

function protectedInterpretation() {
  return {
    meaning: 'Prepare an external action',
    goal: 'external-change',
    intent: 'execute',
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'execute', name: 'missing-external-capability', actionClass: 'external' }],
    rationale: 'Protected action test.'
  };
}

function assertOrderedSubsequence(actual, expected) {
  let cursor = 0;
  for (const value of actual) if (value === expected[cursor]) cursor += 1;
  assert.equal(cursor, expected.length, `missing ordered observability stages: ${expected.slice(cursor).join(', ')}`);
}

test('runtime config fails fast on invalid mandatory values', () => {
  assert.throws(() => loadRuntimeConfig({ SG_ENVIRONMENT: '', SG_REVISION: 'x', SG_PROJECT_SCOPE: 'sg' }), /SG_ENVIRONMENT is required/);
  assert.throws(() => loadRuntimeConfig({ SG_ENVIRONMENT: 'test', SG_REVISION: 'x', SG_PROJECT_SCOPE: 'sg', SG_SHUTDOWN_TIMEOUT_MS: '0' }), /positive integer/);
  assert.throws(() => loadRuntimeConfig({ SG_ENVIRONMENT: 'test', SG_REVISION: 'x', SG_PROJECT_SCOPE: 'sg', SG_PERSISTENCE_MODE: 'postgres' }), /DATABASE_URL is required/);
});

test('runtime rolls back already-started resources when a later resource fails to start', async () => {
  const lifecycle = [];
  const runtime = createProductionRuntime({
    config: { environment: 'test', revision: 'rollback-test', shutdownTimeoutMs: 1000 },
    semanticPipeline: { async process() { throw new Error('unused'); } },
    actionGate: { evaluate() { throw new Error('unused'); } },
    capabilityExecutor: { async execute() { throw new Error('unused'); } },
    observability: { record() {}, recordFailure() {} },
    resources: [
      { async start() { lifecycle.push('first:start'); }, async stop() { lifecycle.push('first:stop'); } },
      { async start() { lifecycle.push('second:start'); throw new Error('second failed'); }, async stop() { lifecycle.push('second:stop'); } }
    ]
  });
  await assert.rejects(() => runtime.start(), /second failed/);
  assert.deepEqual(lifecycle, ['first:start', 'second:start', 'first:stop']);
  assert.equal(runtime.health().phase, 'failed');
  await runtime.stop();
  assert.deepEqual(lifecycle, ['first:start', 'second:start', 'first:stop']);
  assert.equal(runtime.health().phase, 'stopped');
});

test('full local transport path reaches capability and delivery with observability', async () => {
  const harness = createLocalProductionHarness();
  assert.equal(harness.runtime.readiness().ready, false);
  await harness.runtime.start();
  assert.equal(harness.runtime.readiness().ready, true);
  const result = await harness.transport.send({ text: 'hello runtime', userId: 'gary', projectId: 'sg2.1' });
  assert.equal(result.response.status, 'success');
  assert.match(result.response.message, /SG AI is currently unavailable \(AI_NOT_INITIALIZED\)/);
  assert.equal(harness.transport.deliveries.length, 1);

  const traceId = result.canonicalInput.traceContext.traceId;
  const telemetry = harness.observability.list({ channel: 'telemetry', traceId });
  const telemetryClasses = telemetry.map((event) => event.eventClass);
  const auditClasses = harness.observability.list({ channel: 'audit', traceId }).map((event) => event.eventClass);
  assertOrderedSubsequence(telemetryClasses, ['audit_event', 'request_received', 'policy_context_resolved', 'audit_event', 'language_context_resolved', 'semantic_decision_created', 'capability_started', 'capability_completed']);
  const conversationEvent = telemetry.find((event) => event.data.contextEventClass === 'conversation_context_resolved');
  const settingsEvent = telemetry.find((event) => event.data.settingsEventClass === 'user_settings_resolved');
  const versionEvents = telemetry.filter((event) => String(event.data.operationalEventType ?? '').startsWith('contract_version_'));
  assert.ok(conversationEvent?.data.conversationId);
  assert.ok(settingsEvent);
  assert.ok(versionEvents.length >= 3);
  assert.deepEqual(auditClasses, ['action_gate_decision']);

  await harness.runtime.stop();
  assert.equal(harness.runtime.readiness().ready, false);
});

postgresIntegration('PostgreSQL runtime observability is durable and flushed before database shutdown', async () => {
  const userId = `runtime-observability-${randomUUID()}`;
  const harness = createLocalProductionHarness({ env: { SG_PERSISTENCE_MODE: 'postgres', DATABASE_URL: connectionString, DATABASE_SSL: 'false' } });
  await harness.runtime.start();
  const result = await harness.transport.send({ text: 'persist runtime observability', userId, projectId: 'sg2.1' });
  const traceId = result.canonicalInput.traceContext.traceId;
  await harness.runtime.stop();

  const verifier = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-runtime-observability-verifier' });
  await verifier.start();
  try {
    const persisted = await verifier.database.query('SELECT channel, event_class, payload FROM observability_events WHERE trace_id=$1 ORDER BY event_id', [traceId]);
    const classes = persisted.rows.map((row) => `${row.channel}:${row.event_class}`);
    assertOrderedSubsequence(classes, ['telemetry:audit_event','telemetry:request_received','telemetry:policy_context_resolved','telemetry:audit_event','telemetry:language_context_resolved','telemetry:semantic_decision_created','audit:action_gate_decision','telemetry:capability_started','telemetry:capability_completed']);
    const versionEvents = persisted.rows.filter((row) => String(row.payload?.data?.operationalEventType ?? '').startsWith('contract_version_'));
    assert.ok(versionEvents.length >= 3);
  } finally { await verifier.close(); }
});

test('protected intent cannot bypass Action Gate', async () => {
  const harness = createLocalProductionHarness({ interpretationResolver: protectedInterpretation });
  await harness.runtime.start();
  const result = await harness.transport.send({ text: 'change external state', userId: 'gary', projectId: 'sg2.1' });
  assert.notEqual(result.response.status, 'success');
  assert.equal(result.response.data.gateOutcome, 'downgrade-to-prepare');
  const started = harness.observability.list({ traceId: result.canonicalInput.traceContext.traceId, eventClass: 'capability_started' });
  assert.equal(started.length, 0);
  await harness.runtime.stop();
});

test('shutdown rejects new requests after readiness is removed', async () => {
  const harness = createLocalProductionHarness();
  await harness.runtime.start();
  await harness.runtime.stop();
  await assert.rejects(() => harness.transport.send({ text: 'late request', userId: 'gary', projectId: 'sg2.1' }), /runtime is not ready/);
  assert.equal(harness.runtime.health().phase, 'stopped');
});
