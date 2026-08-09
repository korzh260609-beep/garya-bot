import { createDiagnosticEvidence, createDiagnosticFinding } from './contracts.js';

function statusFromObservability(row) {
  const outcome = String(row.outcome ?? row.payload?.outcome ?? '').toLowerCase();
  const code = row.payload?.data?.code ?? null;
  if (outcome === 'timeout' || String(code ?? '').toLowerCase().includes('timeout')) return 'timeout';
  if (['failed', 'failure', 'error', 'denied'].includes(outcome)) return 'failed';
  if (['completed', 'success', 'succeeded', 'ok', 'allow', 'allowed', 'delivered'].includes(outcome)) return 'completed';
  if (row.event_class === 'capability_failed') return 'failed';
  return 'unknown';
}

export function createObservabilityEvidenceSource({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async collect({ traceId = null, requestId = null, limit = 1000 } = {}) {
      if (!traceId && !requestId) throw new TypeError('traceId or requestId is required');
      const result = await database.query(`SELECT id,channel,event_class,trace_id,request_id,stage,outcome,payload,created_at
        FROM observability_events WHERE ($1::text IS NULL OR trace_id=$1) AND ($2::text IS NULL OR request_id=$2)
        ORDER BY created_at,id LIMIT $3`, [traceId, requestId, limit]);
      return Object.freeze(result.rows.map((row) => createDiagnosticEvidence({
        source: 'sg-observability', sourceRef: `observability_events:${row.id}`,
        occurredAt: row.payload?.occurredAt ?? row.created_at?.toISOString?.() ?? String(row.created_at ?? ''),
        traceId: row.trace_id, requestId: row.request_id, stage: row.stage ?? row.event_class,
        status: statusFromObservability(row), component: row.stage ?? row.event_class,
        errorCode: row.payload?.data?.code ?? null,
        payload: { eventClass: row.event_class, channel: row.channel, outcome: row.outcome, ...row.payload }
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
      return Object.freeze(findings);
    }
  });
}
