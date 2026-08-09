import { createDiagnosticEvidence, createDiagnosticFinding } from './contracts.js';

function effectiveEventClass(row) {
  return row.payload?.data?.operationalEventClass
    ?? row.payload?.data?.responseEventClass
    ?? row.payload?.data?.contextEventClass
    ?? row.payload?.data?.settingsEventClass
    ?? row.event_class;
}

function statusFromObservability(row) {
  const outcome = String(row.outcome ?? row.payload?.outcome ?? '').toLowerCase();
  const code = row.payload?.data?.code ?? null;
  if (outcome === 'timeout' || String(code ?? '').toLowerCase().includes('timeout')) return 'timeout';
  if (['failed', 'failure', 'error', 'denied'].includes(outcome)) return 'failed';
  if (['completed', 'success', 'succeeded', 'ok', 'allow', 'allowed', 'delivered'].includes(outcome)) return 'completed';
  if (effectiveEventClass(row) === 'capability_failed') return 'failed';
  return 'unknown';
}

function boundedLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
}

export function createObservabilityEvidenceSource({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async collect({ traceId = null, requestId = null, limit = 1000 } = {}) {
      if (!traceId && !requestId) throw new TypeError('traceId or requestId is required');
      const result = await database.query(`SELECT event_id,channel,event_class,trace_id,request_id,stage,outcome,payload,created_at
        FROM observability_events WHERE ($1::text IS NULL OR trace_id=$1) AND ($2::text IS NULL OR request_id=$2)
        ORDER BY created_at,event_id LIMIT $3`, [traceId, requestId, boundedLimit(limit, 1000, 5000)]);
      return Object.freeze(result.rows.map((row) => {
        const eventClass = effectiveEventClass(row);
        return createDiagnosticEvidence({
          source: 'sg-observability', sourceRef: `observability_events:${row.event_id}`,
          occurredAt: row.payload?.occurredAt ?? row.created_at?.toISOString?.() ?? String(row.created_at ?? ''),
          traceId: row.trace_id, requestId: row.request_id, stage: row.stage ?? eventClass,
          status: statusFromObservability(row), component: row.stage ?? eventClass,
          errorCode: row.payload?.data?.code ?? null,
          payload: { rawEventClass: row.event_class, eventClass, channel: row.channel, outcome: row.outcome, ...row.payload, eventClass }
        });
      }));
    },
    async recentTraces({ globalUserId = null, projectScope = null, limit = 20 } = {}) {
      const result = await database.query(`SELECT trace_id,
          max(request_id) FILTER (WHERE request_id IS NOT NULL) AS request_id,
          min(created_at) AS first_seen_at,
          max(created_at) AS last_seen_at,
          count(*)::int AS event_count
        FROM observability_events
        WHERE trace_id IS NOT NULL
          AND ($1::text IS NULL OR global_user_id=$1)
          AND ($2::text IS NULL OR project_scope=$2)
        GROUP BY trace_id
        ORDER BY max(created_at) DESC
        LIMIT $3`, [globalUserId, projectScope, boundedLimit(limit)]);
      return Object.freeze(result.rows.map((row) => Object.freeze({
        traceId: row.trace_id,
        requestId: row.request_id ?? null,
        firstSeenAt: row.first_seen_at?.toISOString?.() ?? String(row.first_seen_at ?? ''),
        lastSeenAt: row.last_seen_at?.toISOString?.() ?? String(row.last_seen_at ?? ''),
        eventCount: Number(row.event_count ?? 0)
      })));
    }
  });
}

async function fetchJson(url, { headers = {}, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { text: text.slice(0, 1000) }; }
    return { ok: response.ok, status: response.status, body };
  } finally { clearTimeout(timer); }
}

export function createInfrastructureEvidenceSource({ database } = {}) {
  if (!database?.query || !database?.health) throw new TypeError('database with query/health is required');
  return Object.freeze({
    async collect() {
      const evidence = [];
      const pool = database.health();
      evidence.push(createDiagnosticEvidence({ source: 'postgres', stage: 'infrastructure.postgres', status: pool.started ? 'completed' : 'failed', component: 'postgres', errorCode: pool.started ? null : 'postgres-not-started', payload: { pool } }));
      try {
        const migrations = await database.query('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version');
        evidence.push(createDiagnosticEvidence({ source: 'postgres', stage: 'infrastructure.migrations', status: 'completed', component: 'migrations', payload: { count: migrations.rowCount, latest: migrations.rows.at(-1)?.version ?? null } }));
      } catch (error) {
        evidence.push(createDiagnosticEvidence({ source: 'postgres', stage: 'infrastructure.migrations', status: 'failed', component: 'migrations', errorCode: 'migration-state-unavailable', payload: { error: error.message } }));
      }
      return Object.freeze(evidence);
    }
  });
}

export function createDeploymentEvidenceSource({
  repository = 'korzh260609-beep/garya-bot',
  branch = 'dev/sg2.1-semantic',
  githubToken = null,
  runtimeHealthUrl = null,
  workerHealthUrl = null,
  expectedRevision = null
} = {}) {
  const githubHeaders = { accept: 'application/vnd.github+json', 'user-agent': 'sg-diagnostics' };
  if (githubToken) githubHeaders.authorization = `Bearer ${githubToken}`;

  return Object.freeze({
    async collect() {
      const evidence = [];
      let branchRevision = expectedRevision;
      try {
        const branchResult = await fetchJson(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`, { headers: githubHeaders });
        if (branchResult.ok && branchResult.body?.sha) branchRevision = branchResult.body.sha;
        evidence.push(createDiagnosticEvidence({ source: 'github', sourceRef: `${repository}:${branch}`, stage: 'deployment.github-head', status: branchResult.ok ? 'completed' : 'failed', component: 'github', errorCode: branchResult.ok ? null : `http-${branchResult.status}`, payload: { repository, branch, revision: branchResult.body?.sha ?? null } }));
      } catch (error) {
        evidence.push(createDiagnosticEvidence({ source: 'github', sourceRef: `${repository}:${branch}`, stage: 'deployment.github-head', status: 'failed', component: 'github', errorCode: error.name === 'AbortError' ? 'timeout' : 'github-unavailable', payload: { repository, branch, error: error.message } }));
      }

      if (branchRevision) {
        try {
          const checks = await fetchJson(`https://api.github.com/repos/${repository}/commits/${branchRevision}/check-runs`, { headers: { ...githubHeaders, accept: 'application/vnd.github+json' } });
          const runs = Array.isArray(checks.body?.check_runs) ? checks.body.check_runs : [];
          const completed = runs.filter((item) => item.status === 'completed');
          const successful = completed.length > 0 && completed.every((item) => ['success', 'neutral', 'skipped'].includes(item.conclusion));
          evidence.push(createDiagnosticEvidence({ source: 'github-actions', sourceRef: `${repository}:${branchRevision}`, stage: 'deployment.ci', status: checks.ok && successful ? 'completed' : checks.ok ? 'degraded' : 'failed', component: 'github-actions', errorCode: checks.ok ? null : `http-${checks.status}`, payload: { revision: branchRevision, total: runs.length, completed: completed.length, conclusions: completed.map((item) => item.conclusion) } }));
        } catch (error) {
          evidence.push(createDiagnosticEvidence({ source: 'github-actions', sourceRef: `${repository}:${branchRevision}`, stage: 'deployment.ci', status: 'failed', component: 'github-actions', errorCode: error.name === 'AbortError' ? 'timeout' : 'ci-unavailable', payload: { revision: branchRevision, error: error.message } }));
        }
      }

      for (const [name, url] of [['web', runtimeHealthUrl], ['worker', workerHealthUrl]]) {
        if (!url) continue;
        try {
          const result = await fetchJson(url);
          const revision = result.body?.revision ?? result.body?.runtime?.revision ?? result.body?.diagnostics?.revision ?? null;
          evidence.push(createDiagnosticEvidence({ source: 'runtime-health', sourceRef: url, stage: `deployment.${name}`, status: result.ok ? 'completed' : 'failed', component: name, errorCode: result.ok ? null : `http-${result.status}`, payload: { revision, health: result.body } }));
        } catch (error) {
          evidence.push(createDiagnosticEvidence({ source: 'runtime-health', sourceRef: url, stage: `deployment.${name}`, status: 'failed', component: name, errorCode: error.name === 'AbortError' ? 'timeout' : 'health-unavailable', payload: { error: error.message } }));
        }
      }
      return Object.freeze({ evidence: Object.freeze(evidence), expectedRevision: branchRevision });
    },
    evaluate(evidence, expected) {
      const findings = [];
      if (!expected) return Object.freeze(findings);
      for (const item of evidence.filter((entry) => entry.source === 'runtime-health' && entry.status === 'completed')) {
        const actual = item.payload?.revision;
        if (actual && actual !== expected) findings.push(createDiagnosticFinding({ kind: 'deployment-mismatch', errorClass: 'DEPLOYMENT', component: item.component, confidence: 'CONFIRMED', summary: `${item.component} revision does not match approved branch HEAD.`, evidenceIds: [item.evidenceId], data: { expectedRevision: expected, actualRevision: actual } }));
      }
      const ci = evidence.find((entry) => entry.stage === 'deployment.ci');
      if (ci && ci.status !== 'completed') findings.push(createDiagnosticFinding({ kind: 'deployment-ci-not-green', errorClass: 'DEPLOYMENT', component: 'github-actions', confidence: ci.status === 'failed' ? 'HIGH' : 'MEDIUM', summary: 'Approved branch revision does not have fully successful CI evidence.', evidenceIds: [ci.evidenceId], data: { expectedRevision: expected } }));
      return Object.freeze(findings);
    }
  });
}