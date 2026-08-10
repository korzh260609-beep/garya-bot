import { randomUUID } from 'node:crypto';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function iso(value, name) {
  const text = required(String(value), name);
  if (Number.isNaN(Date.parse(text))) throw new TypeError(`${name} must be ISO timestamp`);
  return new Date(text).toISOString();
}
function temporalError(message, code) { const error = new Error(message); error.code = code; return error; }
function sameEntity(left, right) {
  return left.projectKey === right.projectKey && left.namespace === right.namespace && left.factType === right.factType && left.entityKey === right.entityKey;
}

export const PROJECT_MEMORY3_TEMPORAL_CONTRACT_VERSION = 1;

export function createProjectMemoryTemporalHistory({ store, database, clock = () => new Date() } = {}) {
  if (!store?.get || !store?.history) throw new TypeError('project memory store with get/history is required');
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function supersede({ projectKey, currentMemoryId, successorMemoryId, effectiveAt = null, traceId = null, sourceEventId = null } = {}) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    const currentId = required(currentMemoryId, 'currentMemoryId');
    const successorId = required(successorMemoryId, 'successorMemoryId');
    if (currentId === successorId) throw temporalError('record cannot supersede itself', 'project-memory-supersession-self-cycle');

    return database.transaction(async (tx) => {
      const lockKey = `pm3.6:${project}:${currentId}:${successorId}`;
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
      const current = await store.get(currentId, { projectKey: project }, tx);
      const successor = await store.get(successorId, { projectKey: project }, tx);
      if (!current || !successor) throw temporalError('supersession record not found in project scope', 'project-memory-supersession-record-missing');
      if (!sameEntity(current, successor)) throw temporalError('successor must describe the same canonical entity', 'project-memory-supersession-entity-mismatch');
      if (!current.confirmed || current.confirmationState !== 'confirmed' || !successor.confirmed || successor.confirmationState !== 'confirmed') {
        throw temporalError('only confirmed project facts can participate in supersession', 'project-memory-supersession-unconfirmed');
      }
      if (current.successorMemoryId && current.successorMemoryId !== successorId) throw temporalError('current record already has a different successor', 'project-memory-supersession-already-linked');
      if (current.supersededAt && current.successorMemoryId === successorId) {
        return Object.freeze({ status: 'already-superseded', current, successor });
      }
      if (successor.successorMemoryId === currentId) throw temporalError('supersession would create a cycle', 'project-memory-supersession-cycle');

      const at = iso(effectiveAt ?? successor.validFrom ?? clock().toISOString(), 'effectiveAt');
      if (Date.parse(at) <= Date.parse(current.validFrom)) throw temporalError('effectiveAt must be later than current validFrom', 'project-memory-supersession-time-order');
      if (Date.parse(successor.validFrom) !== Date.parse(at)) throw temporalError('successor validFrom must equal supersession effectiveAt', 'project-memory-supersession-effective-time-mismatch');

      const chainCheck = await tx.query(`WITH RECURSIVE chain(memory_id, successor_memory_id) AS (
          SELECT memory_id,successor_memory_id FROM project_memory_entries WHERE memory_id=$1 AND project_key=$2
          UNION ALL
          SELECT e.memory_id,e.successor_memory_id FROM project_memory_entries e JOIN chain c ON e.memory_id=c.successor_memory_id WHERE e.project_key=$2
        ) SELECT 1 FROM chain WHERE memory_id=$3 LIMIT 1`, [successorId, project, currentId]);
      if (chainCheck.rowCount > 0) throw temporalError('supersession would create a successor cycle', 'project-memory-supersession-cycle');

      const updatedAt = iso(clock().toISOString(), 'updatedAt');
      const entry = await tx.query(`UPDATE project_memory_entries SET valid_to=$3,successor_memory_id=$4,updated_at=$5
        WHERE memory_id=$1 AND project_key=$2 AND successor_memory_id IS NULL AND valid_to IS NULL RETURNING *`, [currentId, project, at, successorId, updatedAt]);
      if (entry.rowCount !== 1) throw temporalError('current record is no longer an open temporal version', 'project-memory-supersession-concurrent-update');
      const memory = await tx.query(`UPDATE memory_records SET lifecycle_state='archived',superseded_at=$3,superseded_by=$4,updated_at=$5
        WHERE memory_id=$1 AND project_scope=$2 AND scope_kind='project' AND memory_layer='project-memory' RETURNING *`, [currentId, project, at, successorId, updatedAt]);
      if (memory.rowCount !== 1) throw temporalError('memory scope mismatch during supersession', 'project-memory-project-scope-denied');

      await tx.query(`INSERT INTO project_memory_history(history_id,memory_id,project_key,event_type,lifecycle_state,record_version,trace_id,source_event_id,snapshot,created_at)
        VALUES ($1,$2,$3,'superseded','archived',$4,$5,$6,$7::jsonb,$8)`, [randomUUID(), currentId, project, current.recordVersion, traceId ?? current.traceId, sourceEventId ?? current.sourceEventId,
        JSON.stringify({ successorMemoryId: successorId, validFrom: current.validFrom, validTo: at, supersededAt: at }), updatedAt]);
      await tx.query(`INSERT INTO project_memory_history(history_id,memory_id,project_key,event_type,lifecycle_state,record_version,trace_id,source_event_id,snapshot,created_at)
        VALUES ($1,$2,$3,'became-current',$4,$5,$6,$7,$8::jsonb,$9)`, [randomUUID(), successorId, project, successor.lifecycleState, successor.recordVersion, traceId ?? successor.traceId, sourceEventId ?? successor.sourceEventId,
        JSON.stringify({ predecessorMemoryId: currentId, validFrom: successor.validFrom }), updatedAt]);

      return Object.freeze({ status: 'superseded', current: await store.get(currentId, { projectKey: project }, tx), successor: await store.get(successorId, { projectKey: project }, tx) });
    });
  }

  async function selectAt({ projectKey, namespace = null, factType = null, entityKey = null, at = null, currentOnly = false, limit = 100 } = {}) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    const instant = iso(at ?? clock().toISOString(), 'at');
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const result = await database.query(`SELECT e.memory_id FROM project_memory_entries e JOIN memory_records m USING(memory_id)
      WHERE e.project_key=$1
        AND ($2::text IS NULL OR e.namespace=$2)
        AND ($3::text IS NULL OR e.fact_type=$3)
        AND ($4::text IS NULL OR e.entity_key=$4)
        AND e.valid_from <= $5 AND (e.valid_to IS NULL OR e.valid_to > $5)
        AND m.confirmed=true AND m.confirmation_state='confirmed'
        AND ($6::boolean=false OR m.lifecycle_state IN ('active','temporary'))
      ORDER BY e.valid_from DESC,e.updated_at DESC,e.memory_id LIMIT $7`, [project, namespace, factType, entityKey, instant, currentOnly, boundedLimit]);
    const records = [];
    for (const row of result.rows) {
      const record = await store.get(row.memory_id, { projectKey: project });
      if (record) records.push(record);
    }
    return Object.freeze(records);
  }

  function getCurrent(options = {}) { return selectAt({ ...options, at: options.at ?? clock().toISOString(), currentOnly: true }); }
  function getAt(options = {}) { return selectAt({ ...options, currentOnly: false }); }

  async function getChain({ projectKey, memoryId } = {}) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    const id = required(memoryId, 'memoryId');
    const result = await database.query(`WITH RECURSIVE ancestors AS (
        SELECT memory_id,successor_memory_id,valid_from,valid_to FROM project_memory_entries WHERE memory_id=$1 AND project_key=$2
        UNION ALL
        SELECT e.memory_id,e.successor_memory_id,e.valid_from,e.valid_to FROM project_memory_entries e JOIN ancestors a ON e.successor_memory_id=a.memory_id WHERE e.project_key=$2
      ), root AS (SELECT memory_id FROM ancestors ORDER BY valid_from ASC,memory_id LIMIT 1), chain AS (
        SELECT e.memory_id,e.successor_memory_id,e.valid_from,e.valid_to,0 depth FROM project_memory_entries e JOIN root r ON e.memory_id=r.memory_id
        UNION ALL
        SELECT e.memory_id,e.successor_memory_id,e.valid_from,e.valid_to,c.depth+1 FROM project_memory_entries e JOIN chain c ON e.memory_id=c.successor_memory_id WHERE e.project_key=$2
      ) SELECT memory_id FROM chain ORDER BY depth`, [id, project]);
    const records = [];
    for (const row of result.rows) {
      const record = await store.get(row.memory_id, { projectKey: project });
      if (record) records.push(record);
    }
    return Object.freeze(records);
  }

  return Object.freeze({ supersede, getCurrent, getAt, getChain });
}
