function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function project(value) {
  return required(value, 'projectKey').toLowerCase();
}

function repository(value) {
  const repo = required(value, 'repository').toLowerCase();
  const parts = repo.split('/');
  const validPart = (part) => /^[a-z0-9_.-]+$/i.test(part);
  if (parts.length !== 2 || parts.some((part) => !validPart(part))) throw new TypeError('repository must be owner/name');
  return repo;
}

function n(value) {
  return Math.max(0, Number(value ?? 0) || 0);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function health(ok, details = {}) {
  return freeze({ status: ok ? 'ok' : 'degraded', ...details });
}

async function scalar(database, sql, params = []) {
  const result = await database.query(sql, params);
  return n(result.rows?.[0]?.count);
}

export const PDK4_DIAGNOSTICS_CONTRACT_VERSION = 2;

export function createDevelopmentKnowledgeDiagnostics({ database, historyCursorStore, ingestionStateStore, authorization = null, clock = () => new Date() } = {}) {
  if (!database?.query) throw new TypeError('started PostgreSQL database is required');
  if (!historyCursorStore?.getCursor || !historyCursorStore?.countProcessed) throw new TypeError('historyCursorStore is required');
  if (!ingestionStateStore?.getState || !ingestionStateStore?.countProcessed) throw new TypeError('ingestionStateStore is required');

  async function authorize(input) {
    if (!authorization) return;
    if (typeof authorization.assertAllowed !== 'function') throw new TypeError('authorization.assertAllowed is required');
    const result = await authorization.assertAllowed(input);
    if (result === false || result?.allowed === false) {
      const error = new Error('PDK4 diagnostics authorization denied');
      error.code = 'pdk4-diagnostics-authority-denied';
      throw error;
    }
  }

  async function inspect({ projectKey, repository: repoInput } = {}) {
    const p = project(projectKey);
    const repo = repository(repoInput);
    await authorize({ projectKey: p, repository: repo, operation: 'pdk4.diagnostics' });

    const cursor = await historyCursorStore.getCursor({ projectKey: p, sourceKind: 'github-commit', sourceScope: repo });
    const ingestion = await ingestionStateStore.getState({ projectKey: p, repository: repo });
    const lastCommitSha = ingestion?.lastCommitSha ?? null;
    const lastSourceId = ingestion?.lastSourceId ?? null;

    const [
      commitsScanned,
      incrementalProcessed,
      eventsExtracted,
      eventsConfirmed,
      eventsRejected,
      eventsSuperseded,
      unresolvedConflicts,
      confirmedComponents,
      activeConfirmedEvents,
      gapCandidates,
      lastContinuousSourceOccurrences,
      lastHistoricalSourceOccurrences
    ] = await Promise.all([
      historyCursorStore.countProcessed({ projectKey: p, sourceKind: 'github-commit', sourceScope: repo }),
      ingestionStateStore.countProcessed({ projectKey: p, repository: repo }),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_entries WHERE project_key=$1 AND fact_type='project-event'", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmed=true AND m.confirmation_state='confirmed'", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmation_state='rejected'", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND (m.lifecycle_state='superseded' OR m.superseded_at IS NOT NULL)", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_conflicts WHERE project_key=$1 AND status='open'", [p]),
      scalar(database, "SELECT count(DISTINCT e.fact->>'component')::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmed=true AND m.confirmation_state='confirmed' AND e.fact ? 'component'", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmed=true AND m.confirmation_state='confirmed' AND m.lifecycle_state='active'", [p]),
      scalar(database, "SELECT count(*)::int AS count FROM memory_records WHERE project_scope=$1 AND memory_layer='project-memory' AND value->>'candidateType'='development-knowledge-gap' AND confirmation_state<>'rejected'", [p]),
      lastSourceId ? scalar(database, 'SELECT count(*)::int AS count FROM pdk4_continuous_processed_sources WHERE project_key=$1 AND repository=$2 AND source_id=$3', [p, repo, lastSourceId]) : 0,
      lastSourceId ? scalar(database, "SELECT count(*)::int AS count FROM pdk4_processed_sources WHERE project_key=$1 AND source_kind='github-commit' AND source_scope=$2 AND source_id=$3", [p, repo, lastSourceId]) : 0
    ]);

    const sourceGap = Math.max(0, commitsScanned - eventsExtracted);
    const bootstrapComplete = cursor?.status === 'complete';
    const continuousReady = bootstrapComplete && Boolean(ingestion) && ingestion.bootstrapLastSourceId === cursor?.lastSourceId;
    const timelineOk = eventsConfirmed <= eventsExtracted && eventsSuperseded <= eventsExtracted;
    const continuousOccurrenceTotal = n(lastContinuousSourceOccurrences) + n(lastHistoricalSourceOccurrences);
    const exactlyOnceEvidence = lastSourceId == null ? null : continuousOccurrenceTotal === 1;

    return freeze({
      contractVersion: PDK4_DIAGNOSTICS_CONTRACT_VERSION,
      kind: 'DevelopmentKnowledgeDiagnostics',
      projectKey: p,
      repository: repo,
      generatedAt: new Date(clock()).toISOString(),
      development_history_health: health(bootstrapComplete && timelineOk, { bootstrapComplete, timelineIntegrity: timelineOk }),
      historical_bootstrap_status: cursor?.status ?? 'not-started',
      historical_bootstrap_cursor: cursor ? {
        lastSourceId: cursor.lastSourceId ?? null,
        scannedCount: n(cursor.scannedCount),
        batchCount: n(cursor.batchCount),
        completedAt: cursor.completedAt ?? null
      } : null,
      commits_scanned: n(commitsScanned),
      events_extracted: n(eventsExtracted),
      events_confirmed: n(eventsConfirmed),
      events_rejected: n(eventsRejected),
      events_superseded: n(eventsSuperseded),
      unresolved_conflicts: n(unresolvedConflicts),
      unlinked_source_events: sourceGap,
      timeline_integrity: health(timelineOk, { eventCount: n(eventsExtracted), confirmedCount: n(eventsConfirmed), supersededCount: n(eventsSuperseded) }),
      component_registry_health: health(bootstrapComplete, { componentCount: n(confirmedComponents) }),
      current_snapshot_health: health(bootstrapComplete, { activeConfirmedEventCount: n(activeConfirmedEvents) }),
      continuous_ingestion_health: health(continuousReady, {
        ready: continuousReady,
        processed: n(incrementalProcessed),
        lastCommitSha,
        lastSourceId,
        lastProcessedAt: ingestion?.lastProcessedAt ?? null
      }),
      exact_once_evidence: health(exactlyOnceEvidence !== false, {
        available: lastSourceId != null,
        lastSourceId,
        lastCommitSha,
        continuousOccurrences: n(lastContinuousSourceOccurrences),
        historicalOccurrences: n(lastHistoricalSourceOccurrences),
        totalOccurrences: continuousOccurrenceTotal,
        exactlyOnce: exactlyOnceEvidence
      }),
      last_successful_ingestion: ingestion?.lastProcessedAt ?? null,
      reconciliation_gap_count: n(gapCandidates),
      source_gap_check: health(true, {
        unlinkedSourceCount: sourceGap,
        note: 'scanner bookkeeping and Project Memory events are separate evidence dimensions; this count is informational'
      })
    });
  }

  return Object.freeze({ inspect });
}
