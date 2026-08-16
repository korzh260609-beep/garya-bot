function iso(value) {
  if (value == null) return null;
  if (typeof value?.toISOString === 'function') return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function traceRevision(payload) {
  return payload?.traceContext?.revision ?? payload?.revision ?? null;
}

function eventData(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : {};
}

async function fetchRuntimeHealth(url, fetchImpl, timeoutMs) {
  if (!url) return Object.freeze({ configured: false, ok: false, revision: null, status: null });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    const revision = body?.revision ?? body?.runtime?.revision ?? body?.diagnostics?.revision ?? null;
    return Object.freeze({ configured: true, ok: response.ok, revision, status: response.status });
  } catch (error) {
    return Object.freeze({ configured: true, ok: false, revision: null, status: null, errorCode: error?.name === 'AbortError' ? 'timeout' : 'health-unavailable' });
  } finally {
    clearTimeout(timer);
  }
}

export function createRuntimeRouteDiagnostics({ database, runtimeHealthUrl = null, diagnosticsRevision = 'unknown', fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  if (runtimeHealthUrl && typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required when runtimeHealthUrl is configured');

  return Object.freeze({
    async inspect({ globalUserId, projectScope }) {
      if (!globalUserId) throw new TypeError('globalUserId is required');
      if (!projectScope) throw new TypeError('projectScope is required');

      const latest = await database.query(`SELECT trace_id, request_id, created_at, payload
        FROM observability_events
        WHERE event_class='request_received'
          AND global_user_id=$1
          AND project_scope=$2
          AND payload->>'transport'='telegram'
        ORDER BY created_at DESC, event_id DESC
        LIMIT 1`, [globalUserId, projectScope]);

      const latestRow = latest.rows?.[0] ?? null;
      let route = null;
      if (latestRow?.trace_id) {
        const events = await database.query(`SELECT event_class, stage, outcome, payload, created_at
          FROM observability_events
          WHERE trace_id=$1
          ORDER BY created_at, event_id`, [latestRow.trace_id]);
        const rows = events.rows ?? [];
        const semantic = rows.find((row) => row.event_class === 'semantic_decision_created') ?? null;
        const gate = rows.find((row) => row.event_class === 'action_gate_decision') ?? null;
        const started = rows.find((row) => row.event_class === 'capability_started') ?? null;
        const completed = rows.find((row) => row.event_class === 'capability_completed') ?? null;
        route = Object.freeze({
          traceId: latestRow.trace_id,
          requestId: latestRow.request_id ?? null,
          occurredAt: iso(latestRow.created_at),
          revision: traceRevision(latestRow.payload),
          intent: eventData(semantic?.payload).intent ?? null,
          selectedCapability: eventData(gate?.payload).capability ?? null,
          startedCapability: eventData(started?.payload).capability ?? null,
          completedCapability: eventData(completed?.payload).capability ?? null,
          gateOutcome: gate?.outcome ?? gate?.payload?.outcome ?? null
        });
      }

      const runtimeHealth = await fetchRuntimeHealth(runtimeHealthUrl, fetchImpl, timeoutMs);
      const revisionMatch = Boolean(runtimeHealth.revision && diagnosticsRevision && runtimeHealth.revision === diagnosticsRevision);
      const traceRevisionMatch = Boolean(route?.revision && runtimeHealth.revision && route.revision === runtimeHealth.revision);

      return Object.freeze({
        diagnosticsRevision,
        telegramRuntimeRevision: runtimeHealth.revision,
        telegramRuntimeHealthOk: runtimeHealth.ok,
        telegramRuntimeHealthConfigured: runtimeHealth.configured,
        diagnosticsMatchesTelegramRuntime: revisionMatch,
        latestTelegramTrace: route,
        latestTelegramTraceMatchesRuntime: traceRevisionMatch,
        latestTelegramTraceAvailable: Boolean(route)
      });
    }
  });
}
