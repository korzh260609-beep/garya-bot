import { randomUUID } from 'node:crypto';
import { createProjectFact } from './projectFactContract.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function normalizeFact(input) {
  return createProjectFact({
    ...input,
    memoryId: input.memoryId,
    source: input.source,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    validFrom: input.validFrom,
    validTo: input.validTo,
    supersededAt: input.supersededAt,
    successorMemoryId: input.successorMemoryId,
    relationKeys: input.relationKeys ?? [],
    tags: input.tags ?? [],
    metadata: input.metadata ?? {}
  }, { clock: () => new Date(input.createdAt ?? Date.now()) });
}

function fromRows(entry, memory, provenance, relations) {
  if (!entry || !memory || !provenance) return null;
  return createProjectFact({
    memoryId: entry.memory_id,
    projectKey: entry.project_key,
    namespace: entry.namespace,
    factType: entry.fact_type,
    entityKey: entry.entity_key,
    fact: entry.fact,
    source: {
      kind: provenance.source_kind,
      ref: provenance.source_ref,
      actorId: provenance.actor_id,
      timestamp: iso(provenance.source_timestamp)
    },
    traceId: entry.trace_id,
    sourceEventId: entry.source_event_id,
    trust: memory.trust,
    confidence: memory.confidence,
    confirmed: memory.confirmed,
    confirmationState: memory.confirmation_state,
    lifecycleState: memory.lifecycle_state,
    validFrom: iso(entry.valid_from),
    validTo: iso(entry.valid_to),
    createdAt: iso(entry.created_at),
    updatedAt: iso(entry.updated_at),
    supersededAt: iso(memory.superseded_at),
    successorMemoryId: entry.successor_memory_id,
    relationKeys: relations.map((row) => row.relation_key),
    tags: memory.tags ?? [],
    recordVersion: entry.record_version,
    metadata: memory.metadata ?? {}
  }, { clock: () => new Date(entry.created_at) });
}

export function createPostgresProjectMemoryStore(database) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');

  async function get(memoryId, { projectKey } = {}, db = database) {
    const id = required(memoryId, 'memoryId');
    const project = required(projectKey, 'projectKey').toLowerCase();
    const [entryResult, memoryResult, provenanceResult, relationsResult] = await Promise.all([
      db.query('SELECT * FROM project_memory_entries WHERE memory_id=$1 AND project_key=$2', [id, project]),
      db.query("SELECT * FROM memory_records WHERE memory_id=$1 AND project_scope=$2 AND scope_kind='project' AND memory_layer='project-memory'", [id, project]),
      db.query('SELECT * FROM project_memory_provenance WHERE memory_id=$1 AND project_key=$2 ORDER BY created_at, provenance_id LIMIT 1', [id, project]),
      db.query('SELECT * FROM project_memory_relations WHERE source_memory_id=$1 AND project_key=$2 ORDER BY created_at, relation_id', [id, project])
    ]);
    return fromRows(entryResult.rows[0], memoryResult.rows[0], provenanceResult.rows[0], relationsResult.rows);
  }

  async function put(input, db = database) {
    const fact = normalizeFact(input);
    return db.transaction ? db.transaction(async (tx) => putInTransaction(fact, tx)) : putInTransaction(fact, db);
  }

  async function putInTransaction(fact, db) {
    const memoryKey = `${fact.namespace}:${fact.factType}:${fact.entityKey}`;
    const provenance = {
      sourceType: fact.source.kind,
      sourceId: fact.source.ref,
      actorId: fact.source.actorId,
      sourceTimestamp: fact.source.timestamp,
      traceId: fact.traceId,
      sourceEventId: fact.sourceEventId
    };
    await db.query(`INSERT INTO memory_records(
      memory_id,global_user_id,project_scope,group_scope,thread_scope,memory_layer,memory_key,value,provenance,trust,confirmed,tags,confidence,expires_at,
      owner_global_user_id,scope_kind,privacy_class,confirmation_state,lifecycle_state,superseded_at,superseded_by,retention_class,record_version,semantic_fingerprint,metadata,created_at,updated_at)
      VALUES ($1,NULL,$2,NULL,NULL,'project-memory',$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,$10,NULL,'project','project',$11,$12,$13,$14,'durable',$15,$16,$17::jsonb,$18,$19)
      ON CONFLICT(memory_id) DO UPDATE SET
        memory_key=EXCLUDED.memory_key,value=EXCLUDED.value,provenance=EXCLUDED.provenance,trust=EXCLUDED.trust,confirmed=EXCLUDED.confirmed,tags=EXCLUDED.tags,
        confidence=EXCLUDED.confidence,expires_at=EXCLUDED.expires_at,confirmation_state=EXCLUDED.confirmation_state,lifecycle_state=EXCLUDED.lifecycle_state,
        superseded_at=EXCLUDED.superseded_at,superseded_by=EXCLUDED.superseded_by,record_version=EXCLUDED.record_version,semantic_fingerprint=EXCLUDED.semantic_fingerprint,
        metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at
      WHERE memory_records.project_scope=EXCLUDED.project_scope AND memory_records.scope_kind='project' AND memory_records.memory_layer='project-memory' RETURNING memory_id`, [
      fact.memoryId, fact.projectKey, memoryKey, json(fact.fact), json(provenance), fact.trust, fact.confirmed, json(fact.tags), fact.confidence, fact.validTo,
      fact.confirmationState, fact.lifecycleState, fact.supersededAt, fact.successorMemoryId, fact.recordVersion, fact.semanticFingerprint, json(fact.metadata), fact.createdAt, fact.updatedAt
    ]);

    await db.query(`INSERT INTO project_memory_entries(memory_id,project_key,namespace,domain,fact_type,entity_key,fact,trace_id,source_event_id,valid_from,valid_to,successor_memory_id,record_version,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(memory_id) DO UPDATE SET namespace=EXCLUDED.namespace,domain=EXCLUDED.domain,fact_type=EXCLUDED.fact_type,entity_key=EXCLUDED.entity_key,
        fact=EXCLUDED.fact,trace_id=EXCLUDED.trace_id,source_event_id=EXCLUDED.source_event_id,valid_from=EXCLUDED.valid_from,valid_to=EXCLUDED.valid_to,
        successor_memory_id=EXCLUDED.successor_memory_id,record_version=EXCLUDED.record_version,updated_at=EXCLUDED.updated_at
      WHERE project_memory_entries.project_key=EXCLUDED.project_key`, [
      fact.memoryId, fact.projectKey, fact.namespace, fact.domain, fact.factType, fact.entityKey, json(fact.fact), fact.traceId, fact.sourceEventId,
      fact.validFrom, fact.validTo, fact.successorMemoryId, fact.recordVersion, fact.createdAt, fact.updatedAt
    ]);

    await db.query('DELETE FROM project_memory_provenance WHERE memory_id=$1', [fact.memoryId]);
    await db.query(`INSERT INTO project_memory_provenance(provenance_id,memory_id,project_key,source_kind,source_ref,actor_id,source_timestamp,trace_id,source_event_id,metadata,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`, [randomUUID(), fact.memoryId, fact.projectKey, fact.source.kind, fact.source.ref, fact.source.actorId,
      fact.source.timestamp, fact.traceId, fact.sourceEventId, json({}), fact.createdAt]);

    await db.query('DELETE FROM project_memory_relations WHERE source_memory_id=$1', [fact.memoryId]);
    for (const relationKey of fact.relationKeys) {
      await db.query(`INSERT INTO project_memory_relations(relation_id,project_key,source_memory_id,relation_key,relation_type,metadata,created_at)
        VALUES ($1,$2,$3,$4,'related','{}'::jsonb,$5)`, [randomUUID(), fact.projectKey, fact.memoryId, relationKey, fact.createdAt]);
    }

    await db.query(`INSERT INTO project_memory_history(history_id,memory_id,project_key,event_type,lifecycle_state,record_version,trace_id,source_event_id,snapshot,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [randomUUID(), fact.memoryId, fact.projectKey, 'stored', fact.lifecycleState, fact.recordVersion,
      fact.traceId, fact.sourceEventId, json({ namespace: fact.namespace, factType: fact.factType, entityKey: fact.entityKey, semanticFingerprint: fact.semanticFingerprint }), fact.updatedAt]);
    return fact;
  }

  async function list({ projectKey, namespaces = [], entityKey = null, factTypes = [], lifecycleStates = [], limit = 100 }, db = database) {
    const project = required(projectKey, 'projectKey').toLowerCase();
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const result = await db.query(`SELECT memory_id FROM project_memory_entries e
      JOIN memory_records m USING(memory_id)
      WHERE e.project_key=$1
        AND ($2::text[]='{}'::text[] OR e.namespace=ANY($2::text[]))
        AND ($3::text IS NULL OR e.entity_key=$3)
        AND ($4::text[]='{}'::text[] OR e.fact_type=ANY($4::text[]))
        AND ($5::text[]='{}'::text[] OR m.lifecycle_state=ANY($5::text[]))
      ORDER BY e.updated_at DESC,e.memory_id LIMIT $6`, [project, namespaces, entityKey, factTypes, lifecycleStates, boundedLimit]);
    const records = [];
    for (const row of result.rows) records.push(await get(row.memory_id, { projectKey: project }, db));
    return Object.freeze(records.filter(Boolean));
  }

  async function recordConflict({ conflictId = randomUUID(), projectKey, memoryId, conflictingMemoryId, reason, metadata = {} }, db = database) {
    const result = await db.query(`INSERT INTO project_memory_conflicts(conflict_id,project_key,memory_id,conflicting_memory_id,reason,metadata)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`, [conflictId, required(projectKey, 'projectKey').toLowerCase(), required(memoryId, 'memoryId'), required(conflictingMemoryId, 'conflictingMemoryId'), required(reason, 'reason'), json(metadata)]);
    return result.rows[0];
  }

  async function history({ projectKey, memoryId }, db = database) {
    const result = await db.query('SELECT * FROM project_memory_history WHERE project_key=$1 AND memory_id=$2 ORDER BY created_at,history_id', [required(projectKey, 'projectKey').toLowerCase(), required(memoryId, 'memoryId')]);
    return result.rows;
  }

  return Object.freeze({ put, get, list, recordConflict, history });
}
