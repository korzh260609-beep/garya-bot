const REQUIRED_TABLES = Object.freeze([
  'memory_records',
  'project_memory_entries',
  'project_memory_provenance',
  'project_memory_relations',
  'project_memory_conflicts',
  'project_memory_history',
  'project_memory_embeddings'
]);

const CHECKS = Object.freeze([
  'project_memory_health',
  'project_memory_counts',
  'project_memory_search_test',
  'project_memory_duplicate_test',
  'project_memory_conflict_test',
  'project_memory_source_test',
  'project_memory_context_test',
  'project_memory_restart_continuity_test'
]);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function bounded(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

function iso(clock) {
  const value = clock();
  const date = new Date(value?.toISOString?.() ?? value);
  if (Number.isNaN(date.getTime())) throw new TypeError('clock must return a valid time');
  return date.toISOString();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function result(check, status, data, generatedAt) {
  return freeze({ check, status, ok: status === 'healthy', generatedAt, data });
}

function errorResult(check, error, generatedAt) {
  return result(check, 'failed', {
    code: String(error?.code ?? 'project-memory-diagnostic-failed').slice(0, 128),
    message: String(error?.message ?? 'Project Memory diagnostic failed').slice(0, 256)
  }, generatedAt);
}

export const PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION = 1;
export const PROJECT_MEMORY3_DIAGNOSTIC_CHECKS = CHECKS;

export function createProjectMemoryDiagnostics({
  database,
  retrieval = null,
  contextGuard = null,
  authorize,
  clock = () => new Date()
} = {}) {
  if (!database?.query) throw new TypeError('started PostgreSQL database is required');
  if (retrieval != null && typeof retrieval.search !== 'function') throw new TypeError('retrieval.search is required');
  if (contextGuard != null && typeof contextGuard.retrieve !== 'function') throw new TypeError('contextGuard.retrieve is required');
  if (typeof authorize !== 'function') throw new TypeError('authorize callback is required');

  async function assertAuthorized({ actor, projectKey }) {
    const allowed = await authorize({ actor, projectKey, operation: 'diagnostics-read' });
    if (allowed !== true) {
      const error = new Error(`Project Memory diagnostics denied for ${projectKey}`);
      error.code = 'project-memory-diagnostics-unauthorized';
      throw error;
    }
  }

  async function health({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const tables = await database.query(`SELECT table_name FROM information_schema.tables
        WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name`, [REQUIRED_TABLES]);
      const present = new Set(tables.rows.map((row) => row.table_name));
      const missing = REQUIRED_TABLES.filter((name) => !present.has(name));
      const db = await database.query('SELECT 1 AS ok');
      return result('project_memory_health', missing.length === 0 && db.rows[0]?.ok === 1 ? 'healthy' : 'degraded', {
        projectKey,
        databaseReachable: db.rows[0]?.ok === 1,
        requiredTableCount: REQUIRED_TABLES.length,
        presentTableCount: present.size,
        missingTables: missing
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_health', error, generatedAt); }
  }

  async function counts({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const summary = await database.query(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE m.confirmed=true)::int AS confirmed,
        count(*) FILTER (WHERE m.confirmation_state='proposed')::int AS proposed,
        count(*) FILTER (WHERE m.confirmation_state='rejected')::int AS rejected,
        count(*) FILTER (WHERE m.lifecycle_state='active')::int AS active,
        count(*) FILTER (WHERE m.lifecycle_state='archived')::int AS archived
        FROM project_memory_entries e JOIN memory_records m USING(memory_id)
        WHERE e.project_key=$1`, [projectKey]);
      const conflict = await database.query(`SELECT
        count(*) FILTER (WHERE status='open')::int AS open,
        count(*) FILTER (WHERE status='resolved')::int AS resolved
        FROM project_memory_conflicts WHERE project_key=$1`, [projectKey]);
      const row = summary.rows[0] ?? {};
      return result('project_memory_counts', 'healthy', {
        projectKey,
        total: Number(row.total ?? 0),
        confirmed: Number(row.confirmed ?? 0),
        proposed: Number(row.proposed ?? 0),
        rejected: Number(row.rejected ?? 0),
        active: Number(row.active ?? 0),
        archived: Number(row.archived ?? 0),
        conflicts: {
          open: Number(conflict.rows[0]?.open ?? 0),
          resolved: Number(conflict.rows[0]?.resolved ?? 0)
        }
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_counts', error, generatedAt); }
  }

  async function searchTest({ actor, projectKey, query = 'project memory', limit = 5 }) {
    const generatedAt = iso(clock);
    if (!retrieval) return result('project_memory_search_test', 'degraded', { projectKey, code: 'retrieval-not-configured' }, generatedAt);
    try {
      const search = await retrieval.search({ actor, projectKey, query: String(query).slice(0, 256), limit: bounded(limit, 5, 10), expandRelations: false });
      return result('project_memory_search_test', 'healthy', {
        projectKey,
        resultCount: Number(search.count ?? 0),
        semanticMode: String(search.semanticMode ?? 'none').slice(0, 64),
        topScores: search.results.slice(0, 5).map((item) => Number(Number(item.score ?? 0).toFixed(4)))
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_search_test', error, generatedAt); }
  }

  async function duplicateTest({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const replay = await database.query(`SELECT count(*)::int AS groups,coalesce(max(c),0)::int AS max_occurrences FROM (
        SELECT source_event_id,count(*) c FROM project_memory_entries
        WHERE project_key=$1 AND source_event_id IS NOT NULL
        GROUP BY source_event_id HAVING count(*)>1
      ) d`, [projectKey]);
      const canonical = await database.query(`SELECT count(*)::int AS groups,coalesce(max(c),0)::int AS max_occurrences FROM (
        SELECT e.namespace,e.fact_type,e.entity_key,m.semantic_fingerprint,count(*) c
        FROM project_memory_entries e JOIN memory_records m USING(memory_id)
        WHERE e.project_key=$1 AND m.semantic_fingerprint IS NOT NULL
          AND m.confirmation_state<>'rejected' AND m.lifecycle_state IN ('active','temporary')
        GROUP BY e.namespace,e.fact_type,e.entity_key,m.semantic_fingerprint HAVING count(*)>1
      ) d`, [projectKey]);
      const replayGroups = Number(replay.rows[0]?.groups ?? 0);
      const canonicalGroups = Number(canonical.rows[0]?.groups ?? 0);
      return result('project_memory_duplicate_test', replayGroups === 0 && canonicalGroups === 0 ? 'healthy' : 'degraded', {
        projectKey,
        sourceEventDuplicateGroups: replayGroups,
        canonicalDuplicateGroups: canonicalGroups,
        maxSourceEventOccurrences: Number(replay.rows[0]?.max_occurrences ?? 0),
        maxCanonicalOccurrences: Number(canonical.rows[0]?.max_occurrences ?? 0)
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_duplicate_test', error, generatedAt); }
  }

  async function conflictTest({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const conflicts = await database.query(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status='open')::int AS open,
        count(*) FILTER (WHERE status='resolved')::int AS resolved,
        count(*) FILTER (WHERE memory_id=conflicting_memory_id)::int AS self_conflicts
        FROM project_memory_conflicts WHERE project_key=$1`, [projectKey]);
      const row = conflicts.rows[0] ?? {};
      const selfConflicts = Number(row.self_conflicts ?? 0);
      return result('project_memory_conflict_test', selfConflicts === 0 ? 'healthy' : 'degraded', {
        projectKey,
        total: Number(row.total ?? 0),
        open: Number(row.open ?? 0),
        resolved: Number(row.resolved ?? 0),
        invalidSelfConflicts: selfConflicts
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_conflict_test', error, generatedAt); }
  }

  async function sourceTest({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const sources = await database.query(`SELECT p.source_kind,count(*)::int AS count
        FROM project_memory_provenance p
        WHERE p.project_key=$1
        GROUP BY p.source_kind ORDER BY p.source_kind LIMIT 32`, [projectKey]);
      const missing = await database.query(`SELECT count(*)::int AS missing FROM project_memory_entries e
        LEFT JOIN project_memory_provenance p ON p.memory_id=e.memory_id AND p.project_key=e.project_key
        WHERE e.project_key=$1 AND p.memory_id IS NULL`, [projectKey]);
      const missingCount = Number(missing.rows[0]?.missing ?? 0);
      return result('project_memory_source_test', missingCount === 0 ? 'healthy' : 'degraded', {
        projectKey,
        provenanceMissing: missingCount,
        sourceKinds: sources.rows.map((row) => ({ kind: String(row.source_kind).slice(0, 64), count: Number(row.count ?? 0) }))
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_source_test', error, generatedAt); }
  }

  async function contextTest({ actor, projectKey, query = 'project memory', limit = 5 }) {
    const generatedAt = iso(clock);
    if (!contextGuard) return result('project_memory_context_test', 'degraded', { projectKey, code: 'context-guard-not-configured' }, generatedAt);
    try {
      const context = await contextGuard.retrieve({ actor, projectKey, query: String(query).slice(0, 256), limit: bounded(limit, 5, 10), maxFacts: 5, maxTokens: 800, expandRelations: false });
      const policyHealthy = context?.dataPolicy?.contentIsDataOnly === true
        && context?.dataPolicy?.executableInstructionsAllowed === false
        && context?.dataPolicy?.authorityFromMemoryAllowed === false
        && context?.dataPolicy?.secretsAllowed === false;
      return result('project_memory_context_test', policyHealthy ? 'healthy' : 'degraded', {
        projectKey,
        factCount: Number(context?.limits?.factCount ?? 0),
        estimatedTokens: Number(context?.limits?.estimatedTokens ?? 0),
        maxFacts: Number(context?.limits?.maxFacts ?? 0),
        maxTokens: Number(context?.limits?.maxTokens ?? 0),
        policyHealthy,
        conflictSummary: context?.conflictSummary ?? { factsWithOpenConflicts: 0, openConflictReferences: 0 },
        exclusionCounts: context?.exclusions ?? {}
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_context_test', error, generatedAt); }
  }

  async function restartContinuityTest({ projectKey }) {
    const generatedAt = iso(clock);
    try {
      const integrity = await database.query(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE m.memory_id IS NULL)::int AS missing_memory_record,
        count(*) FILTER (WHERE p.memory_id IS NULL)::int AS missing_provenance
        FROM project_memory_entries e
        LEFT JOIN memory_records m ON m.memory_id=e.memory_id AND m.project_scope=e.project_key AND m.memory_layer='project-memory'
        LEFT JOIN project_memory_provenance p ON p.memory_id=e.memory_id AND p.project_key=e.project_key
        WHERE e.project_key=$1`, [projectKey]);
      const history = await database.query(`SELECT count(*)::int AS history_count FROM project_memory_history WHERE project_key=$1`, [projectKey]);
      const row = integrity.rows[0] ?? {};
      const missingMemory = Number(row.missing_memory_record ?? 0);
      const missingProvenance = Number(row.missing_provenance ?? 0);
      return result('project_memory_restart_continuity_test', missingMemory === 0 && missingProvenance === 0 ? 'healthy' : 'degraded', {
        projectKey,
        durableEntryCount: Number(row.total ?? 0),
        historyEventCount: Number(history.rows[0]?.history_count ?? 0),
        missingMemoryRecords: missingMemory,
        missingProvenance
      }, generatedAt);
    } catch (error) { return errorResult('project_memory_restart_continuity_test', error, generatedAt); }
  }

  async function auditMetadata({ projectKey, limit = 20 }) {
    const generatedAt = iso(clock);
    const boundedLimit = bounded(limit, 20, 100);
    const history = await database.query(`SELECT event_type,count(*)::int AS count,max(created_at) AS last_at
      FROM project_memory_history WHERE project_key=$1
      GROUP BY event_type ORDER BY event_type LIMIT $2`, [projectKey, boundedLimit]);
    const conflicts = await database.query(`SELECT status,count(*)::int AS count,max(coalesce(resolved_at,detected_at)) AS last_at
      FROM project_memory_conflicts WHERE project_key=$1
      GROUP BY status ORDER BY status LIMIT $2`, [projectKey, boundedLimit]);
    return freeze({
      generatedAt,
      projectKey,
      bounded: true,
      rawMemoryIncluded: false,
      history: history.rows.map((row) => ({ eventType: String(row.event_type).slice(0, 64), count: Number(row.count ?? 0), lastAt: row.last_at?.toISOString?.() ?? String(row.last_at ?? '') })),
      conflicts: conflicts.rows.map((row) => ({ status: String(row.status).slice(0, 32), count: Number(row.count ?? 0), lastAt: row.last_at?.toISOString?.() ?? String(row.last_at ?? '') }))
    });
  }

  async function runAll({ actor, projectKey, query = 'project memory' } = {}) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    await assertAuthorized({ actor, projectKey: project });
    const checks = [
      await health({ projectKey: project }),
      await counts({ projectKey: project }),
      await searchTest({ actor, projectKey: project, query }),
      await duplicateTest({ projectKey: project }),
      await conflictTest({ projectKey: project }),
      await sourceTest({ projectKey: project }),
      await contextTest({ actor, projectKey: project, query }),
      await restartContinuityTest({ projectKey: project })
    ];
    const status = checks.some((item) => item.status === 'failed') ? 'failed'
      : checks.some((item) => item.status === 'degraded') ? 'degraded' : 'healthy';
    return freeze({
      contractVersion: PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION,
      kind: 'ProjectMemoryDiagnostics',
      projectKey: project,
      status,
      ok: status === 'healthy',
      generatedAt: iso(clock),
      checks,
      audit: await auditMetadata({ projectKey: project })
    });
  }

  return Object.freeze({
    health,
    counts,
    searchTest,
    duplicateTest,
    conflictTest,
    sourceTest,
    contextTest,
    restartContinuityTest,
    auditMetadata,
    runAll
  });
}
