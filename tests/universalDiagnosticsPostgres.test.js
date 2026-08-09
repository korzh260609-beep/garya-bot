import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresDatabase } from '../src/persistence/database.js';
import { createPostgresDiagnosticStore } from '../src/diagnostics/postgresDiagnosticStore.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Universal Diagnostics evidence is durable and deduplicated only within one run', async () => {
  const database = createPostgresDatabase({ connectionString, ssl: false, applicationName: 'sg-diagnostics-store-test' });
  await database.start();
  await database.query('TRUNCATE diagnostic_findings, diagnostic_evidence, diagnostic_runs, diagnostic_regressions RESTART IDENTITY CASCADE');
  const store = createPostgresDiagnosticStore({ database });
  const traceId = `trace:${randomUUID()}`;
  const runA = `diag:${randomUUID()}`;
  const runB = `diag:${randomUUID()}`;
  await store.createRun({ runId: runA, mode: 'request', traceId, environment: 'ci', revision: 'rev-a' });
  await store.createRun({ runId: runB, mode: 'request', traceId, environment: 'ci', revision: 'rev-a' });

  const input = {
    source: 'sg-observability',
    sourceRef: 'observability_events:1',
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
  await restarted.close();
});
