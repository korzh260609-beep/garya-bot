function required(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`); return value.trim(); }
function project(value) { return required(value, 'projectKey').toLowerCase(); }
function repository(value) { return required(value, 'repository').toLowerCase(); }
function json(value) { return JSON.stringify(value ?? {}); }
function iso(value, name) { const d = new Date(value); if (Number.isNaN(d.getTime())) throw new TypeError(`${name} must be ISO timestamp`); return d.toISOString(); }

export function createPostgresContinuousIngestionStore(database) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');

  async function getState({ projectKey, repository: repo }, db = database) {
    const result = await db.query(`SELECT * FROM pdk4_continuous_ingestion_state WHERE project_key=$1 AND repository=$2`, [project(projectKey), repository(repo)]);
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return Object.freeze({ projectKey: row.project_key, repository: row.repository, bootstrapLastSourceId: row.bootstrap_last_source_id, lastSourceId: row.last_source_id, lastCommitSha: row.last_commit_sha, processedCount: Number(row.processed_count), lastProcessedAt: row.last_processed_at?.toISOString?.() ?? row.last_processed_at ?? null, createdAt: row.created_at?.toISOString?.() ?? row.created_at, updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at });
  }

  async function ensureState({ projectKey, repository: repo, bootstrapLastSourceId }, db = database) {
    const p = project(projectKey); const r = repository(repo); const anchor = required(bootstrapLastSourceId, 'bootstrapLastSourceId');
    await db.query(`INSERT INTO pdk4_continuous_ingestion_state(project_key,repository,bootstrap_last_source_id) VALUES ($1,$2,$3) ON CONFLICT(project_key,repository) DO NOTHING`, [p,r,anchor]);
    return getState({ projectKey: p, repository: r }, db);
  }

  async function isProcessed({ projectKey, repository: repo, sourceId }, db = database) {
    const result = await db.query(`SELECT 1 FROM pdk4_continuous_processed_sources WHERE project_key=$1 AND repository=$2 AND source_id=$3`, [project(projectKey), repository(repo), required(sourceId,'sourceId')]);
    return result.rowCount === 1;
  }

  async function recordTrigger({ projectKey, repository: repo, triggerId, triggerType, metadata = {} }, db = database) {
    const result = await db.query(`INSERT INTO pdk4_continuous_triggers(project_key,repository,trigger_id,trigger_type,metadata) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT(project_key,repository,trigger_id) DO NOTHING RETURNING trigger_id`, [project(projectKey), repository(repo), required(triggerId,'triggerId'), required(triggerType,'triggerType'), json(metadata)]);
    return Object.freeze({ duplicate: result.rowCount === 0 });
  }

  async function commitProcessed({ projectKey, repository: repo, sourceId, sourceFingerprint, commitSha, occurredAt, triggerId, metadata = {} }, db = database) {
    const p = project(projectKey); const r = repository(repo); const sid = required(sourceId,'sourceId'); const fp = required(sourceFingerprint,'sourceFingerprint'); const sha = required(commitSha,'commitSha').toLowerCase();
    return db.transaction(async (tx) => {
      const inserted = await tx.query(`INSERT INTO pdk4_continuous_processed_sources(project_key,repository,source_id,source_fingerprint,commit_sha,occurred_at,trigger_id,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(project_key,repository,source_id) DO NOTHING RETURNING source_id`, [p,r,sid,fp,sha,iso(occurredAt,'occurredAt'),required(triggerId,'triggerId'),json(metadata)]);
      if (inserted.rowCount === 0) return Object.freeze({ duplicate: true, state: await getState({projectKey:p,repository:r},tx) });
      await tx.query(`UPDATE pdk4_continuous_ingestion_state SET last_source_id=$3,last_commit_sha=$4,processed_count=processed_count+1,last_processed_at=$5,updated_at=now() WHERE project_key=$1 AND repository=$2`, [p,r,sid,sha,iso(occurredAt,'occurredAt')]);
      return Object.freeze({ duplicate: false, state: await getState({projectKey:p,repository:r},tx) });
    });
  }

  async function countProcessed({ projectKey, repository: repo }, db = database) {
    const result = await db.query(`SELECT count(*)::int AS count FROM pdk4_continuous_processed_sources WHERE project_key=$1 AND repository=$2`, [project(projectKey),repository(repo)]);
    return Number(result.rows[0].count);
  }

  return Object.freeze({ getState, ensureState, isProcessed, recordTrigger, commitProcessed, countProcessed });
}
