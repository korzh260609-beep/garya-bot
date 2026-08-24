import { randomUUID } from 'node:crypto';
import { createDiagnosticEvidence } from './contracts.js';

async function fetchProbe(url, { method = 'GET', body = null, headers = {}, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: { ...headers, 'x-sg-diagnostic': 'true' },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { text: text.slice(0, 1000) }; }
    return { ok: response.ok, status: response.status, body: parsed };
  } finally { clearTimeout(timer); }
}

export function createLiveDiagnosticRunner({ probes = [], idFactory = randomUUID } = {}) {
  const catalog = new Map();
  for (const probe of probes) register(probe);

  function register(probe) {
    if (!probe?.id || typeof probe.run !== 'function') throw new TypeError('probe id/run are required');
    if (probe.safe !== true) throw new TypeError('live diagnostic probes must declare safe=true');
    if (probe.mutatesUserState === true || probe.externalSideEffect === true) throw new TypeError('mutating/external-side-effect probes are forbidden');
    catalog.set(String(probe.id), Object.freeze({ ...probe }));
  }

  async function run({ probeIds = [...catalog.keys()] } = {}) {
    const diagnosticRunId = idFactory();
    const results = [];
    for (const probeId of probeIds) {
      const probe = catalog.get(String(probeId));
      if (!probe) throw new TypeError(`Unknown live diagnostic probe: ${probeId}`);
      const startedAt = Date.now();
      try {
        const output = await probe.run({ diagnostic: true, diagnosticRunId, testCaseId: probe.id });
        results.push(Object.freeze({ probeId: probe.id, ok: output?.ok !== false, durationMs: Date.now() - startedAt, output }));
      } catch (error) {
        results.push(Object.freeze({ probeId: probe.id, ok: false, durationMs: Date.now() - startedAt, error: { code: error.code ?? 'probe-failed', message: error.message } }));
      }
    }
    return Object.freeze({ diagnosticRunId, total: results.length, passed: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results: Object.freeze(results) });
  }

  return Object.freeze({ register, run, list: () => Object.freeze([...catalog.keys()]) });
}

export function createHttpHealthProbe({ id, url, expectedService = null } = {}) {
  if (!id || !url) throw new TypeError('health probe id/url are required');
  return Object.freeze({
    id,
    safe: true,
    mutatesUserState: false,
    externalSideEffect: false,
    async run({ diagnosticRunId, testCaseId }) {
      const result = await fetchProbe(url, { headers: { 'x-diagnostic-run-id': diagnosticRunId, 'x-diagnostic-test-case-id': testCaseId } });
      const serviceMatches = expectedService == null || result.body?.service === expectedService;
      return Object.freeze({ ok: result.ok && serviceMatches, status: result.status, service: result.body?.service ?? null, revision: result.body?.revision ?? null });
    }
  });
}

export function liveResultEvidence(result) {
  return result.results.map((item) => createDiagnosticEvidence({
    source: 'live-runner', sourceRef: `${result.diagnosticRunId}:${item.probeId}`, stage: `live.${item.probeId}`,
    status: item.ok ? 'completed' : 'failed', component: item.probeId,
    errorCode: item.error?.code ?? null, payload: { diagnosticRunId: result.diagnosticRunId, ...item }
  }));
}
