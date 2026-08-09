import { createMemory2Record } from './memory2.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function toDb(record) {
  const r = createMemory2Record(record);
  return {
    id: r.id,
    ownerGlobalUserId: r.memoryScope.ownerGlobalUserId,
    projectScope: r.memoryScope.projectScope,
    groupScope: r.memoryScope.groupScope,
    threadScope: r.memoryScope.threadScope,
    scopeKind: r.memoryScope.kind,
    layer: r.layer,
    key: r.key,
    value: r.value,
    privacyClass: r.privacyClass,
    provenance: r.provenance,
    trust: r.trust,
    confirmed: r.confirmed,
    confirmationState: r.confirmationState,
    lifecycleState: r.lifecycleState,
    lastAccessedAt: r.lastAccessedAt,
    expiresAt: r.expiresAt,
    supersededAt: r.supersededAt,
    supersededBy: r.supersededBy,
    archivedAt: r.archivedAt,
    deletedAt: r.deletedAt,
    tags: r.tags,
    confidence: r.confidence,
    retentionClass: r.retentionClass,
    recordVersion: r.recordVersion,
    semanticFingerprint: r.semanticFingerprint,
    metadata: r.metadata,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}
function fromRow(row) {
  return createMemory2Record({
    id: row.memory_id,
    layer: row.memory_layer,
    key: row.memory_key,
    value: row.value,
    memoryScope: { kind: row.scope_kind, ownerGlobalUserId: row.owner_global_user_id, projectScope: row.project_scope, groupScope: row.group_scope, threadScope: row.thread_scope },
    privacyClass: row.privacy_class,
    provenance: row.provenance,
    trust: row.trust,
    confirmed: row.confirmed,
    confirmationState: row.confirmation_state,
    lifecycleState: row.lifecycle_state,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    supersededAt: row.superseded_at ? new Date(row.superseded_at).toISOString() : null,
    supersededBy: row.superseded_by,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    tags: row.tags,
    confidence: row.confidence == null ? null : Number(row.confidence),
    retentionClass: row.retention_class,
    recordVersion: row.record_version,
    semanticFingerprint: row.semantic_fingerprint,
    metadata: row.metadata
  });
}

export function createPostgresMemory2Store({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async insert(raw, db = database) {
      const r = toDb(raw);
      const result = await db.query(`INSERT INTO memory_records(
        memory_id,global_user_id,owner_global_user_id,project_scope,group_scope,thread_scope,scope_kind,memory_layer,memory_key,value,privacy_class,provenance,trust,confirmed,confirmation_state,lifecycle_state,last_accessed_at,expires_at,superseded_at,superseded_by,archived_at,deleted_at,tags,confidence,retention_class,record_version,semantic_fingerprint,metadata,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,$25,$26,$27,$28::jsonb,$29,$30)
        RETURNING *`, [r.id, r.ownerGlobalUserId, r.ownerGlobalUserId, r.projectScope, r.groupScope, r.threadScope, r.scopeKind, r.layer, r.key, JSON.stringify(r.value), r.privacyClass, JSON.stringify(r.provenance), r.trust, r.confirmed, r.confirmationState, r.lifecycleState, r.lastAccessedAt, r.expiresAt, r.supersededAt, r.supersededBy, r.archivedAt, r.deletedAt, JSON.stringify(r.tags), r.confidence, r.retentionClass, r.recordVersion, r.semanticFingerprint, JSON.stringify(r.metadata), r.createdAt, r.updatedAt]);
      return fromRow(result.rows[0]);
    },
    async get(memoryId, db = database) {
      const result = await db.query('SELECT * FROM memory_records WHERE memory_id=$1', [required(memoryId,'memoryId')]);
      return result.rows[0] ? fromRow(result.rows[0]) : null;
    },
    async update(memoryId, patch = {}, db = database) {
      const existing = await this.get(memoryId, db);
      if (!existing) return null;
      const merged = createMemory2Record({ ...existing, ...patch, memoryScope: existing.memoryScope, provenance: patch.provenance ?? existing.provenance, metadata: patch.metadata ?? existing.metadata });
      const r = toDb(merged);
      const result = await db.query(`UPDATE memory_records SET value=$2::jsonb,privacy_class=$3,provenance=$4::jsonb,trust=$5,confirmed=$6,confirmation_state=$7,lifecycle_state=$8,last_accessed_at=$9,expires_at=$10,superseded_at=$11,superseded_by=$12,archived_at=$13,deleted_at=$14,tags=$15::jsonb,confidence=$16,retention_class=$17,record_version=$18,semantic_fingerprint=$19,metadata=$20::jsonb,updated_at=$21 WHERE memory_id=$1 RETURNING *`, [r.id, JSON.stringify(r.value), r.privacyClass, JSON.stringify(r.provenance), r.trust, r.confirmed, r.confirmationState, r.lifecycleState, r.lastAccessedAt, r.expiresAt, r.supersededAt, r.supersededBy, r.archivedAt, r.deletedAt, JSON.stringify(r.tags), r.confidence, r.retentionClass, r.recordVersion, r.semanticFingerprint, JSON.stringify(r.metadata), r.updatedAt]);
      return result.rows[0] ? fromRow(result.rows[0]) : null;
    },
    async list({ projectScope = null, groupScope = undefined, threadScope = undefined, ownerGlobalUserId = undefined, includeHistory = false, limit = 500 } = {}, db = database) {
      const clauses = []; const values = [];
      const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
      if (projectScope != null) add('project_scope=?', required(projectScope,'projectScope'));
      if (groupScope !== undefined) add('group_scope IS NOT DISTINCT FROM ?', optional(groupScope));
      if (threadScope !== undefined) add('thread_scope IS NOT DISTINCT FROM ?', optional(threadScope));
      if (ownerGlobalUserId !== undefined) {
        values.push(optional(ownerGlobalUserId));
        clauses.push(`(owner_global_user_id IS NOT DISTINCT FROM $${values.length} OR owner_global_user_id IS NULL)`);
      }
      if (!includeHistory) clauses.push(`lifecycle_state IN ('active','temporary')`);
      values.push(Math.max(1, Math.min(5000, Number(limit) || 500)));
      const result = await db.query(`SELECT * FROM memory_records${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC,memory_id LIMIT $${values.length}`, values);
      return result.rows.map(fromRow);
    }
  });
}
