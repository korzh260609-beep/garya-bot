function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function normalizeProjectKey(value) { return requiredString(value, 'projectKey').toLowerCase(); }
function normalizeScope(value) { return requiredString(value, 'sourceScope').toLowerCase(); }
function normalizeSourceKind(value) { return requiredString(value, 'sourceKind').toLowerCase(); }
function boundedCount(value, name) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return number;
}
function isoOrNull(value, name) {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be an ISO timestamp`);
  return date.toISOString();
}
function json(value) { return JSON.stringify(value ?? {}); }

export function createPostgresHistoricalCursorStore(database) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');

  async function getCursor({ projectKey, sourceKind = 'github-commit', sourceScope }, db = database) {
    const result = await db.query(`SELECT project_key,source_kind,source_scope,cursor_token,last_source_id,scanned_count,batch_count,status,completed_at,created_at,updated_at
      FROM pdk4_history_cursors WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3`, [
      normalizeProjectKey(projectKey), normalizeSourceKind(sourceKind), normalizeScope(sourceScope)
    ]);
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return Object.freeze({
      projectKey: row.project_key,
      sourceKind: row.source_kind,
      sourceScope: row.source_scope,
      cursorToken: row.cursor_token,
      lastSourceId: row.last_source_id,
      scannedCount: Number(row.scanned_count),
      batchCount: Number(row.batch_count),
      status: row.status,
      completedAt: row.completed_at?.toISOString?.() ?? row.completed_at ?? null,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
      updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at
    });
  }

  async function ensureCursor({ projectKey, sourceKind = 'github-commit', sourceScope }, db = database) {
    const project = normalizeProjectKey(projectKey);
    const kind = normalizeSourceKind(sourceKind);
    const scope = normalizeScope(sourceScope);
    await db.query(`INSERT INTO pdk4_history_cursors(project_key,source_kind,source_scope)
      VALUES ($1,$2,$3) ON CONFLICT(project_key,source_kind,source_scope) DO NOTHING`, [project, kind, scope]);
    return getCursor({ projectKey: project, sourceKind: kind, sourceScope: scope }, db);
  }

  async function listProcessedSourceIds({ projectKey, sourceKind = 'github-commit', sourceScope, sourceIds = [] }, db = database) {
    if (!Array.isArray(sourceIds)) throw new TypeError('sourceIds must be an array');
    if (sourceIds.length === 0) return Object.freeze([]);
    const result = await db.query(`SELECT source_id FROM pdk4_processed_sources
      WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3 AND source_id=ANY($4::text[])`, [
      normalizeProjectKey(projectKey), normalizeSourceKind(sourceKind), normalizeScope(sourceScope), sourceIds.map((value) => requiredString(value, 'sourceId'))
    ]);
    return Object.freeze(result.rows.map((row) => row.source_id));
  }

  async function commitBatch({ projectKey, sourceKind = 'github-commit', sourceScope, expectedCursorToken = null, nextCursorToken = null, lastSourceId = null, processedSources = [], complete = false }, db = database) {
    if (!Array.isArray(processedSources)) throw new TypeError('processedSources must be an array');
    const project = normalizeProjectKey(projectKey);
    const kind = normalizeSourceKind(sourceKind);
    const scope = normalizeScope(sourceScope);
    const expected = expectedCursorToken == null ? null : requiredString(expectedCursorToken, 'expectedCursorToken');
    const next = nextCursorToken == null ? null : requiredString(nextCursorToken, 'nextCursorToken');
    const last = lastSourceId == null ? null : requiredString(lastSourceId, 'lastSourceId');

    return db.transaction(async (tx) => {
      await ensureCursor({ projectKey: project, sourceKind: kind, sourceScope: scope }, tx);
      const locked = await tx.query(`SELECT cursor_token,status FROM pdk4_history_cursors
        WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3 FOR UPDATE`, [project, kind, scope]);
      const current = locked.rows[0];
      if ((current.cursor_token ?? null) !== expected) {
        const error = new Error('PDK4 historical cursor changed concurrently');
        error.code = 'pdk4-cursor-conflict';
        throw error;
      }

      let inserted = 0;
      for (const source of processedSources) {
        const sourceId = requiredString(source.sourceId, 'processedSource.sourceId');
        const fingerprint = requiredString(source.fingerprint, 'processedSource.fingerprint');
        const metadata = source.metadata ?? {};
        const result = await tx.query(`INSERT INTO pdk4_processed_sources(
          project_key,source_kind,source_scope,source_id,source_fingerprint,source_position,source_timestamp,metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
          ON CONFLICT(project_key,source_kind,source_scope,source_id) DO NOTHING`, [
          project, kind, scope, sourceId, fingerprint,
          source.position == null ? null : String(source.position),
          isoOrNull(source.timestamp, 'processedSource.timestamp'), json(metadata)
        ]);
        inserted += result.rowCount;
      }

      const status = complete ? 'complete' : 'scanning';
      const update = await tx.query(`UPDATE pdk4_history_cursors SET
        cursor_token=$4,last_source_id=$5,scanned_count=scanned_count+$6,batch_count=batch_count+1,status=$7,
        completed_at=CASE WHEN $7='complete' THEN now() ELSE NULL END,updated_at=now()
        WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3
        RETURNING *`, [project, kind, scope, next, last, inserted, status]);
      const row = update.rows[0];
      return Object.freeze({
        projectKey: row.project_key,
        sourceKind: row.source_kind,
        sourceScope: row.source_scope,
        cursorToken: row.cursor_token,
        lastSourceId: row.last_source_id,
        scannedCount: Number(row.scanned_count),
        batchCount: Number(row.batch_count),
        status: row.status,
        insertedProcessedSources: inserted,
        completedAt: row.completed_at?.toISOString?.() ?? row.completed_at ?? null
      });
    });
  }

  async function restartScan({ projectKey, sourceKind = 'github-commit', sourceScope }, db = database) {
    const project = normalizeProjectKey(projectKey);
    const kind = normalizeSourceKind(sourceKind);
    const scope = normalizeScope(sourceScope);
    return db.transaction(async (tx) => {
      await ensureCursor({ projectKey: project, sourceKind: kind, sourceScope: scope }, tx);
      await tx.query(`UPDATE pdk4_history_cursors SET
        cursor_token=NULL,last_source_id=NULL,status='scanning',completed_at=NULL,updated_at=now()
        WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3`, [project, kind, scope]);
      return getCursor({ projectKey: project, sourceKind: kind, sourceScope: scope }, tx);
    });
  }

  async function markFailed({ projectKey, sourceKind = 'github-commit', sourceScope }, db = database) {
    await ensureCursor({ projectKey, sourceKind, sourceScope }, db);
    await db.query(`UPDATE pdk4_history_cursors SET status='failed',updated_at=now()
      WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3`, [normalizeProjectKey(projectKey), normalizeSourceKind(sourceKind), normalizeScope(sourceScope)]);
    return getCursor({ projectKey, sourceKind, sourceScope }, db);
  }

  async function countProcessed({ projectKey, sourceKind = 'github-commit', sourceScope }, db = database) {
    const result = await db.query(`SELECT count(*)::int AS count FROM pdk4_processed_sources
      WHERE project_key=$1 AND source_kind=$2 AND source_scope=$3`, [normalizeProjectKey(projectKey), normalizeSourceKind(sourceKind), normalizeScope(sourceScope)]);
    return Number(result.rows[0].count);
  }

  return Object.freeze({ getCursor, ensureCursor, listProcessedSourceIds, commitBatch, restartScan, markFailed, countProcessed });
}
