import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticEvidence } from '../src/diagnostics/contracts.js';
import { createExpectedPathRegistry } from '../src/diagnostics/pathRegistry.js';
import { analyzeRootCause, downstreamEffects, findFirstDivergence, reconstructTrace } from '../src/diagnostics/analyzer.js';
import { createDiagnosticsHttpServer } from '../src/diagnostics/httpServer.js';
import { createLiveDiagnosticRunner } from '../src/diagnostics/liveRunner.js';

function ev({ stage, eventClass = stage, status = 'completed', outcome = 'completed', errorCode = null, at = '2026-08-09T10:00:00.000Z' }) {
  return createDiagnosticEvidence({ source: 'sg-observability', occurredAt: at, stage, status, errorCode, payload: { eventClass, outcome, data: errorCode ? { code: errorCode } : {} } });
}

const registry = createExpectedPathRegistry();

function healthyConversation() {
  return [
    ev({ stage: 'request_received' }),
    ev({ stage: 'conversation_context_resolved' }),
    ev({ stage: 'semantic_decision_created' }),
    ev({ stage: 'action_gate_decision', outcome: 'allow' }),
    ev({ stage: 'capability_started', status: 'unknown', outcome: 'started' }),
    ev({ stage: 'capability_completed' }),
    ev({ stage: 'model_call' }),
    ev({ stage: 'telegram_update_completed' })
  ];
}

test('healthy request has no divergence', () => {
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence: healthyConversation() });
  assert.equal(findFirstDivergence(trace), null);
});

test('capability timeout is first divergence and later stages are downstream', () => {
  const evidence = healthyConversation().filter((item) => !['capability_completed', 'model_call', 'telegram_update_completed'].includes(item.stage));
  evidence.push(ev({ stage: 'capability_failed', status: 'timeout', outcome: 'failed', errorCode: 'capability-timeout' }));
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence });
  const first = findFirstDivergence(trace);
  assert.equal(first.stage, 'capability');
  assert.equal(first.status, 'timeout');
  const cause = analyzeRootCause({ trace, firstDivergence: first });
  assert.equal(cause.errorClass, 'CAPABILITY');
  assert.equal(cause.confidence, 'CONFIRMED');
  assert.deepEqual(downstreamEffects(trace, first).map((item) => item.stage), ['ai', 'response', 'delivery']);
});

test('provider-like failure is classified as AI provider', () => {
  const evidence = healthyConversation().filter((item) => !['capability_completed', 'model_call', 'telegram_update_completed'].includes(item.stage));
  evidence.push(ev({ stage: 'capability_failed', status: 'failed', outcome: 'failed', errorCode: 'openai-provider-timeout' }));
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence });
  const first = findFirstDivergence(trace);
  const cause = analyzeRootCause({ trace, firstDivergence: first });
  assert.equal(cause.errorClass, 'AI_PROVIDER');
});

test('explicit action gate denial is controlled rather than downstream system fault', () => {
  const evidence = [
    ev({ stage: 'request_received' }),
    ev({ stage: 'conversation_context_resolved' }),
    ev({ stage: 'semantic_decision_created' }),
    ev({ stage: 'action_gate_decision', status: 'failed', outcome: 'denied', errorCode: 'permission-denied' })
  ];
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence });
  const first = findFirstDivergence(trace);
  const cause = analyzeRootCause({ trace, firstDivergence: first });
  assert.equal(cause.errorClass, 'ACTION_GATE');
  assert.equal(cause.data.expectedControlOutcome, true);
});

test('diagnostic evidence redacts secrets', () => {
  const evidence = createDiagnosticEvidence({ source: 'test', payload: { token: 'abc', nested: { apiKey: 'def', safe: 'ok' } } });
  assert.equal(evidence.payload.token, '[REDACTED]');
  assert.equal(evidence.payload.nested.apiKey, '[REDACTED]');
  assert.equal(evidence.payload.nested.safe, 'ok');
});

test('live runner refuses mutating probes', () => {
  assert.throws(() => createLiveDiagnosticRunner({ probes: [{ id: 'bad', safe: true, mutatesUserState: true, run: async () => ({ ok: true }) }] }), /forbidden/);
});

test('diagnostics HTTP API is owner authenticated and health remains bounded', async () => {
  const service = {
    async analyzeRequest() { return { report: { status: 'healthy' }, evidence: [] }; },
    async systemHealth() { return { report: { status: 'healthy' }, evidence: [] }; },
    async runLive() { return { report: { status: 'healthy' }, result: { failed: 0 }, evidence: [] }; },
    async runRegressions() { return { total: 0, passed: 0, failed: 0, results: [] }; }
  };
  const store = { async getRun() { return null; }, async listRuns() { return []; }, async listEvidence() { return []; } };
  const server = createDiagnosticsHttpServer({ service, store, host: '127.0.0.1', port: 0, adminToken: 'secret-token', monarchGlobalUserId: 'usr_monarch', environment: 'test', revision: 'abc' });
  const address = await server.start();
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    const forbidden = await fetch(`http://127.0.0.1:${address.port}/api/system`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(forbidden.status, 403);
    const allowed = await fetch(`http://127.0.0.1:${address.port}/api/system`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostics-token': 'secret-token', 'x-sg-global-user-id': 'usr_monarch' }, body: '{}' });
    assert.equal(allowed.status, 200);
  } finally { await server.stop(); }
});

test('diagnostics server failure does not couple to SG runtime', () => {
  assert.throws(() => createDiagnosticsHttpServer({ service: {}, store: {}, adminToken: 'x', monarchGlobalUserId: 'y' }), /diagnostic service/);
});
