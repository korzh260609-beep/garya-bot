import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresDatabase } from '../src/persistence/database.js';
import { createPostgresDiagnosticStore } from '../src/diagnostics/postgresDiagnosticStore.js';
import { createObservabilityEvidenceSource } from '../src/diagnostics/sourceAdapters.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Universal Diagnostics evidence is durable, production observability is readable and access is audited', async () => {
  const database = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-diagnostics-store-test' });
  await database.start();
  await database.query('TRUNCATE diagnostic_access_audit, diagnostic_findings, diagnostic_evidence, diagnostic_runs, diagnostic_regressions, observability_events RESTART IDENTITY CASCADE');
  const store = createPostgresDiagnosticStore({ database });
  const source = createObservabilityEvidenceSource({ database });
  const traceId = `trace:${randomUUID()}`;
  const runA = `diag:${randomUUID()}`;
  const runB = `diag:${randomUUID()}`;
  const monarchGlobalUserId = `usr:${randomUUID()}`;
  await store.createRun({ runId: runA, mode: 'request', traceId, environment: 'ci', revision: 'rev-a' });
  await store.createRun({ runId: runB, mode: 'request', traceId, environment: 'ci', revision: 'rev-a' });

  await database.query(`INSERT INTO observability_events(channel,event_class,trace_id,request_id,global_user_id,project_scope,stage,outcome,payload)
    VALUES ('telemetry','request_received',$1,'request-1',$2,'sg2.1','request_received','completed',$3::jsonb)`, [traceId, monarchGlobalUserId, JSON.stringify({ occurredAt: '2026-08-09T10:00:00.000Z', data: { safe: true } })]);
  await database.query(`INSERT INTO observability_events(channel,event_class,trace_id,request_id,global_user_id,project_scope,stage,outcome,payload)
    VALUES ('telemetry','telegram_update_completed',$1,'request-1',$2,'sg2.1','telegram_update_completed','completed','{}'::jsonb)`, [traceId, monarchGlobalUserId]);

  const collected = await source.collect({ traceId });
  assert.equal(collected.length, 2);
  assert.match(collected[0].sourceRef, /^observability_events:\d+$/);
  assert.equal(collected[0].traceId, traceId);
  const recent = await source.recentTraces({ globalUserId: monarchGlobalUserId, projectScope: 'sg2.1', limit: 1 });
  assert.equal(recent.length, 1);
  assert.equal(recent[0].traceId, traceId);
  assert.equal(recent[0].requestId, 'request-1');
  assert.equal(recent[0].eventCount, 2);

  const input = {
    source: 'sg-observability',
    sourceRef: collected[0].sourceRef,
    occurredAt: '2026-08-09T10:00:00.000Z',
    traceId,
    stage: 'request_received',
    status: 'completed',
    component: 'runtime',
    payload: { eventClass: 'request_received', token: 'must-redact' }
  };

  const first = await store.addEvidence(runA, input);
  const duplicate = await store.addEvidence(runA, input);
  const secondRun = await store.addEvidence(runB, input);
  assert.equal(first.evidenceId, duplicate.evidenceId);
  assert.notEqual(first.evidenceId, secondRun.evidenceId);
  assert.equal(first.payload.token, '[REDACTED]');
  assert.equal((await store.listEvidence({ runId: runA })).length, 1);
  assert.equal((await store.listEvidence({ runId: runB })).length, 1);

  await store.recordAccess({ actorGlobalUserId: monarchGlobalUserId, method: 'GET', path: '/api/traces', outcome: 'allow', reason: 'owner-authenticated' });
  await store.recordAccess({ actorGlobalUserId: 'unknown', method: 'POST', path: '/api/system', outcome: 'deny', reason: 'diagnostics-owner-auth-required' });
  const audit = await store.listAccessAudit({ limit: 10 });
  assert.equal(audit.length, 2);
  assert.deepEqual(new Set(audit.map((row) => row.outcome)), new Set(['allow', 'deny']));
  assert.ok(audit.every((row) => !JSON.stringify(row).includes('must-redact')));

  await store.completeRun({ runId: runA, status: 'healthy', report: { status: 'healthy', traceId } });
  await database.close();

  const restarted = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-diagnostics-store-restart-test' });
  await restarted.start();
  const restartedStore = createPostgresDiagnosticStore({ database: restarted });
  const persisted = await restartedStore.getRun(runA);
  assert.equal(persisted.status, 'healthy');
  assert.equal(persisted.trace_id, traceId);
  assert.equal(persisted.report.status, 'healthy');
  assert.equal((await restartedStore.listEvidence({ runId: runA })).length, 1);
  assert.equal((await restartedStore.listAccessAudit({ limit: 10 })).length, 2);
  await restarted.close();
});