import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeRouteDiagnostics } from '../src/diagnostics/runtimeRouteDiagnostics.js';

function fakeDatabase({ latestRows = [], eventRows = [] } = {}) {
  const calls = [];
  return Object.freeze({
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("event_class='request_received'")) return { rows: latestRows };
      if (sql.includes('WHERE trace_id=$1')) return { rows: eventRows };
      throw new Error(`unexpected query: ${sql}`);
    }
  });
}

function jsonResponse(body, status = 200) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, async json() { return body; } });
}

test('runtime route diagnostics exposes latest telegram route metadata without message text', async () => {
  const database = fakeDatabase({
    latestRows: [{
      trace_id: 'trace-live', request_id: 'request-live', created_at: new Date('2026-08-16T09:05:00.000Z'), project_scope: null,
      payload: { transport: 'telegram', traceContext: { revision: 'rev-live' } }
    }],
    eventRows: [
      { event_class: 'audit_event', payload: { data: { operationalEventClass: 'semantic_decision_created', intent: 'project_development_current' } } },
      { event_class: 'audit_event', outcome: 'allow', payload: { data: { operationalEventClass: 'action_gate_decision', capability: 'compose-answer' } } },
      { event_class: 'audit_event', payload: { data: { operationalEventClass: 'capability_started', capability: 'compose-answer' } } },
      { event_class: 'audit_event', payload: { data: { operationalEventClass: 'capability_completed', capability: 'compose-answer' } } }
    ]
  });
  const diagnostics = createRuntimeRouteDiagnostics({
    database,
    diagnosticsRevision: 'rev-live',
    runtimeHealthUrl: 'https://runtime.example/health',
    fetchImpl: async () => jsonResponse({ revision: 'rev-live' })
  });

  const result = await diagnostics.inspect({ globalUserId: 'usr-monarch', projectScope: 'sg2.1' });

  assert.equal(result.diagnosticsRevision, 'rev-live');
  assert.equal(result.telegramRuntimeRevision, 'rev-live');
  assert.equal(result.diagnosticsMatchesTelegramRuntime, true);
  assert.equal(result.latestTelegramTraceMatchesRuntime, true);
  assert.deepEqual(result.latestTelegramTrace, {
    traceId: 'trace-live',
    requestId: 'request-live',
    occurredAt: '2026-08-16T09:05:00.000Z',
    revision: 'rev-live',
    projectScopeAtIngress: null,
    intent: 'project_development_current',
    selectedCapability: 'compose-answer',
    startedCapability: 'compose-answer',
    completedCapability: 'compose-answer',
    gateOutcome: 'allow'
  });
  assert.doesNotMatch(JSON.stringify(result), /message|text/i);
  assert.match(database.calls[0].sql, /project_scope=\$2 OR project_scope IS NULL/);
});

test('runtime route diagnostics makes stale telegram runtime/trace visible', async () => {
  const database = fakeDatabase({
    latestRows: [{
      trace_id: 'trace-old', request_id: 'request-old', created_at: new Date('2026-08-15T18:29:43.000Z'), project_scope: 'sg2.1',
      payload: { transport: 'telegram', traceContext: { revision: 'old-runtime' } }
    }],
    eventRows: [
      { event_class: 'semantic_decision_created', payload: { data: { intent: 'answer' } } },
      { event_class: 'action_gate_decision', outcome: 'allow', payload: { data: { capability: 'repository-analyze' } } },
      { event_class: 'capability_started', payload: { data: { capability: 'repository-analyze' } } }
    ]
  });
  const diagnostics = createRuntimeRouteDiagnostics({
    database,
    diagnosticsRevision: 'new-diagnostics',
    runtimeHealthUrl: 'https://runtime.example/health',
    fetchImpl: async () => jsonResponse({ revision: 'old-runtime' })
  });

  const result = await diagnostics.inspect({ globalUserId: 'usr-monarch', projectScope: 'sg2.1' });

  assert.equal(result.diagnosticsMatchesTelegramRuntime, false);
  assert.equal(result.latestTelegramTraceMatchesRuntime, true);
  assert.equal(result.latestTelegramTrace.intent, 'answer');
  assert.equal(result.latestTelegramTrace.selectedCapability, 'repository-analyze');
  assert.equal(result.latestTelegramTrace.startedCapability, 'repository-analyze');
});

test('runtime route diagnostics reports no telegram trace instead of selecting unrelated worker traces', async () => {
  const database = fakeDatabase({ latestRows: [] });
  const diagnostics = createRuntimeRouteDiagnostics({ database, diagnosticsRevision: 'rev', runtimeHealthUrl: null });
  const result = await diagnostics.inspect({ globalUserId: 'usr-monarch', projectScope: 'sg2.1' });

  assert.equal(result.latestTelegramTraceAvailable, false);
  assert.equal(result.latestTelegramTrace, null);
  assert.equal(result.telegramRuntimeHealthConfigured, false);
  assert.equal(database.calls.length, 1);
  assert.match(database.calls[0].sql, /transport/);
});
