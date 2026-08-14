import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticEvidence } from '../src/diagnostics/contracts.js';
import { createExpectedPathRegistry } from '../src/diagnostics/pathRegistry.js';
import { analyzeRootCause, downstreamEffects, findFirstDivergence, isTraceInFlight, reconstructTrace } from '../src/diagnostics/analyzer.js';
import { createDiagnosticsHttpServer } from '../src/diagnostics/httpServer.js';
import { createLiveDiagnosticRunner } from '../src/diagnostics/liveRunner.js';
import { createDeploymentEvidenceSource } from '../src/diagnostics/sourceAdapters.js';

function ev({ stage, eventClass = stage, status = 'completed', outcome = 'completed', errorCode = null, at = '2026-08-09T10:00:00.000Z', component = null }) {
  return createDiagnosticEvidence({ source: 'sg-observability', occurredAt: at, stage, status, errorCode, component: component ?? stage, payload: { eventClass, outcome, data: errorCode ? { code: errorCode } : {} } });
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

test('recent incomplete trace is treated as in-flight, not failed', () => {
  const now = Date.parse('2026-08-09T10:05:00.000Z');
  const evidence = [
    ev({ stage: 'request_received', at: '2026-08-09T10:04:58.000Z' }),
    ev({ stage: 'conversation_context_resolved', at: '2026-08-09T10:04:58.100Z' }),
    ev({ stage: 'semantic_decision_created', at: '2026-08-09T10:04:58.200Z' }),
    ev({ stage: 'action_gate_decision', outcome: 'allow', at: '2026-08-09T10:04:58.300Z' }),
    ev({ stage: 'capability_started', status: 'unknown', outcome: 'started', at: '2026-08-09T10:04:59.000Z' })
  ];
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence });
  const first = findFirstDivergence(trace);
  assert.equal(first.stage, 'capability');
  assert.equal(isTraceInFlight(trace, first, { nowMs: now, graceMs: 300000 }), true);
  assert.equal(isTraceInFlight(trace, first, { nowMs: now + 301000, graceMs: 300000 }), false);
});

test('delivery failure after successful execution is isolated to delivery', () => {
  const evidence = healthyConversation().filter((item) => item.stage !== 'telegram_update_completed');
  evidence.push(ev({ stage: 'delivery_attempt', status: 'failed', outcome: 'failed', errorCode: 'telegram-delivery-failed', component: 'telegram' }));
  const trace = reconstructTrace({ expectedPath: registry.get('conversation'), evidence });
  const first = findFirstDivergence(trace);
  assert.equal(first.stage, 'delivery');
  const cause = analyzeRootCause({ trace, firstDivergence: first });
  assert.equal(cause.errorClass, 'DELIVERY');
  assert.equal(cause.confidence, 'CONFIRMED');
});

test('deployment mismatch outranks request symptoms when revision evidence is confirmed', () => {
  const source = createDeploymentEvidenceSource({ expectedRevision: 'expected-sha' });
  const evidence = [createDiagnosticEvidence({ source: 'runtime-health', stage: 'deployment.web', status: 'completed', component: 'web', payload: { revision: 'old-sha' } })];
  const findings = source.evaluate(evidence, 'expected-sha');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'deployment-mismatch');
  assert.equal(findings[0].confidence, 'CONFIRMED');
  assert.deepEqual(findings[0].data, { expectedRevision: 'expected-sha', actualRevision: 'old-sha' });
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

test('diagnostics HTTP API is owner authenticated, audited and can analyze latest Monarch trace', async () => {
  const regressions = [];
  const audits = [];
  const analyzed = [];
  const service = {
    async recentTraces(input) { assert.deepEqual(input, { globalUserId: 'usr_monarch', projectScope: 'sg2.1', limit: 1 }); return [{ traceId: 'trace-latest', requestId: 'request-latest', eventCount: 8 }]; },
    async analyzeRequest(input) { analyzed.push(input); return { report: { status: 'healthy', traceId: input.traceId }, evidence: [] }; },
    async systemHealth() { return { report: { status: 'healthy' }, evidence: [] }; },
    async runLive() { return { report: { status: 'healthy' }, result: { failed: 0 }, evidence: [] }; },
    async runRegressions() { return { total: regressions.length, passed: regressions.length, failed: 0, results: [] }; }
  };
  const store = {
    async getRun() { return null; }, async listRuns() { return []; }, async listEvidence() { return []; },
    async listRegressions() { return regressions; },
    async putRegression(input) { const row = { regression_id: input.regressionId ?? 'reg-1', name: input.name, fixture: input.fixture, expected: input.expected }; regressions.push(row); return row; },
    async recordAccess(input) { audits.push(input); return input; }
  };
  const server = createDiagnosticsHttpServer({ service, store, host: '127.0.0.1', port: 0, adminToken: 'secret-token', monarchGlobalUserId: 'usr_monarch', projectScope: 'sg2.1', environment: 'test', revision: 'abc' });
  const address = await server.start();
  const headers = { 'content-type': 'application/json', 'x-diagnostics-token': 'secret-token', 'x-sg-global-user-id': 'usr_monarch' };
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    const forbidden = await fetch(`http://127.0.0.1:${address.port}/api/system`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(forbidden.status, 403);
    const tracesResponse = await fetch(`http://127.0.0.1:${address.port}/api/traces?limit=1`, { headers });
    assert.equal(tracesResponse.status, 200);
    const traces = (await tracesResponse.json()).traces;
    assert.equal(traces[0].traceId, 'trace-latest');
    const latestAnalysis = await fetch(`http://127.0.0.1:${address.port}/api/request`, { method: 'POST', headers, body: JSON.stringify({ traceId: traces[0].traceId }) });
    assert.equal(latestAnalysis.status, 200);
    assert.equal(analyzed[0].traceId, 'trace-latest');
    const allowed = await fetch(`http://127.0.0.1:${address.port}/api/system`, { method: 'POST', headers, body: '{}' });
    assert.equal(allowed.status, 200);
    const created = await fetch(`http://127.0.0.1:${address.port}/api/regressions`, { method: 'POST', headers, body: JSON.stringify({ name: 'echo regression', fixture: { pathId: 'conversation', evidence: [] }, expected: { errorClass: 'TRANSPORT' } }) });
    assert.equal(created.status, 201);
    const listed = await fetch(`http://127.0.0.1:${address.port}/api/regressions`, { headers });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).regressions.length, 1);
    assert.equal(audits[0].outcome, 'deny');
    assert.ok(audits.slice(1).every((item) => item.outcome === 'allow'));
    assert.ok(audits.some((item) => item.path === '/api/traces'));
    assert.ok(audits.every((item) => !JSON.stringify(item).includes('secret-token')));
  } finally { await server.stop(); }
});

test('diagnostics privileged API fails closed when access audit is unavailable', async () => {
  const service = { recentTraces: async () => [], analyzeRequest: async () => ({}), systemHealth: async () => ({}), runLive: async () => ({ result: { failed: 0 } }), runRegressions: async () => ({ failed: 0 }) };
  const store = { getRun: async () => null, listRuns: async () => [], listEvidence: async () => [], listRegressions: async () => [], putRegression: async () => ({}), recordAccess: async () => { throw new Error('audit db unavailable'); } };
  const server = createDiagnosticsHttpServer({ service, store, host: '127.0.0.1', port: 0, adminToken: 'secret-token', monarchGlobalUserId: 'usr_monarch' });
  const address = await server.start();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/system`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostics-token': 'secret-token', 'x-sg-global-user-id': 'usr_monarch' }, body: '{}' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'diagnostics-access-audit-unavailable');
  } finally { await server.stop(); }
});

test('diagnostics server failure does not couple to SG runtime', () => {
  assert.throws(() => createDiagnosticsHttpServer({ service: {}, store: {}, adminToken: 'x', monarchGlobalUserId: 'y' }), /diagnostic service/);
});