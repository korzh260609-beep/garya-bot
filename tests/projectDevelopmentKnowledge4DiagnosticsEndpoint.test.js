import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticsHttpServer } from '../src/diagnostics/httpServer.js';
import { createDevelopmentKnowledgeDiagnostics } from '../src/projectDevelopmentKnowledge/developmentKnowledgeDiagnostics.js';

const PROJECT = 'sg2.1';
const REPOSITORY = 'korzh260609-beep/garya-bot';
const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SOURCE_ID = `github:${REPOSITORY}:commit:${SHA}`;

function diagnosticsStore(audits) {
  return {
    async getRun() { return null; },
    async listRuns() { return []; },
    async listEvidence() { return []; },
    async listRegressions() { return []; },
    async putRegression(input) { return input; },
    async recordAccess(input) { audits.push(input); return input; }
  };
}

test('PDK4.13 protected diagnostics endpoint is owner authenticated and audited', async () => {
  const audits = [];
  const service = {
    async recentTraces() { return []; },
    async analyzeRequest() { return {}; },
    async systemHealth() { return {}; },
    async pdk4() {
      return {
        kind: 'DevelopmentKnowledgeDiagnostics',
        continuous_ingestion_health: { status: 'ok', lastCommitSha: SHA },
        exact_once_evidence: { status: 'ok', exactlyOnce: true, totalOccurrences: 1 }
      };
    },
    async runLive() { return { result: { failed: 0 } }; },
    async runRegressions() { return { failed: 0 }; }
  };
  const server = createDiagnosticsHttpServer({
    service,
    store: diagnosticsStore(audits),
    host: '127.0.0.1',
    port: 0,
    adminToken: 'pdk4-owner-token',
    monarchGlobalUserId: 'usr_monarch',
    projectScope: PROJECT,
    environment: 'test',
    revision: 'test-revision'
  });
  const address = await server.start();
  const headers = { 'x-diagnostics-token': 'pdk4-owner-token', 'x-sg-global-user-id': 'usr_monarch' };
  try {
    const denied = await fetch(`http://127.0.0.1:${address.port}/internal/pdk4/diagnostics`);
    assert.equal(denied.status, 403);

    const allowed = await fetch(`http://127.0.0.1:${address.port}/internal/pdk4/diagnostics`, { headers });
    assert.equal(allowed.status, 200);
    const payload = await allowed.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.continuous_ingestion_health.lastCommitSha, SHA);
    assert.equal(payload.exact_once_evidence.totalOccurrences, 1);

    const alias = await fetch(`http://127.0.0.1:${address.port}/api/pdk4`, { headers });
    assert.equal(alias.status, 200);
    assert.equal((await alias.json()).exact_once_evidence.exactlyOnce, true);

    assert.ok(audits.some((entry) => entry.path === '/internal/pdk4/diagnostics' && entry.outcome === 'deny'));
    assert.ok(audits.some((entry) => entry.path === '/internal/pdk4/diagnostics' && entry.outcome === 'allow'));
    assert.ok(audits.every((entry) => !JSON.stringify(entry).includes('pdk4-owner-token')));
  } finally {
    await server.stop();
  }
});

test('PDK4.13 diagnostics proves the latest processed source occurs exactly once across ingestion ledgers', async () => {
  const database = {
    async query(sql) {
      if (sql.includes('FROM pdk4_continuous_processed_sources')) return { rows: [{ count: 1 }], rowCount: 1 };
      if (sql.includes('FROM pdk4_processed_sources')) return { rows: [{ count: 0 }], rowCount: 1 };
      return { rows: [{ count: 0 }], rowCount: 1 };
    }
  };
  const historyCursorStore = {
    async getCursor() {
      return {
        status: 'complete',
        lastSourceId: SOURCE_ID,
        scannedCount: 10,
        batchCount: 2,
        completedAt: '2026-08-16T06:00:00.000Z'
      };
    },
    async countProcessed() { return 10; }
  };
  const ingestionStateStore = {
    async getState() {
      return {
        bootstrapLastSourceId: SOURCE_ID,
        lastSourceId: SOURCE_ID,
        lastCommitSha: SHA,
        lastProcessedAt: '2026-08-16T06:08:46.861Z'
      };
    },
    async countProcessed() { return 1; }
  };

  const diagnostics = createDevelopmentKnowledgeDiagnostics({
    database,
    historyCursorStore,
    ingestionStateStore,
    clock: () => new Date('2026-08-16T06:10:00.000Z')
  });
  const result = await diagnostics.inspect({ projectKey: PROJECT, repository: REPOSITORY });

  assert.equal(result.contractVersion, 2);
  assert.equal(result.continuous_ingestion_health.status, 'ok');
  assert.equal(result.continuous_ingestion_health.lastCommitSha, SHA);
  assert.equal(result.exact_once_evidence.status, 'ok');
  assert.equal(result.exact_once_evidence.available, true);
  assert.equal(result.exact_once_evidence.continuousOccurrences, 1);
  assert.equal(result.exact_once_evidence.historicalOccurrences, 0);
  assert.equal(result.exact_once_evidence.totalOccurrences, 1);
  assert.equal(result.exact_once_evidence.exactlyOnce, true);
});
