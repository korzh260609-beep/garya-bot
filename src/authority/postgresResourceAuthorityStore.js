function rowResource(row) {
  if (!row) return null;
  return {
    resourceId: row.resource_id,
    resourceType: row.resource_type,
    provider: row.provider,
    projectScope: row.project_scope,
    connectionId: row.connection_id,
    externalResourceId: row.external_resource_id,
    parentResourceId: row.parent_resource_id,
    verificationState: row.verification_state,
    metadata: row.metadata ?? {},
    provenance: row.provenance ?? {},
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}
function rowAuthority(row) {
  if (!row) return null;
  return {
    authorityId: row.authority_id,
    resourceId: row.resource_id,
    actorGlobalUserId: row.actor_global_user_id,
    projectScope: row.project_scope,
    relation: row.relation,
    appliesToDescendants: row.applies_to_descendants,
    delegatedByGlobalUserId: row.delegated_by_global_user_id,
    verificationState: row.verification_state,
    verificationSource: row.verification_source,
    provenance: row.provenance ?? {},
    state: row.state,
    verifiedAt: row.verified_at instanceof Date ? row.verified_at.toISOString() : row.verified_at,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    revokedAt: row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}

export function createPostgresResourceAuthorityStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async putResource(record) {
      const result = await database.query(`INSERT INTO managed_resources(resource_id,resource_type,provider,project_scope,connection_id,external_resource_id,parent_resource_id,verification_state,metadata,provenance,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
        ON CONFLICT(resource_id) DO UPDATE SET resource_type=EXCLUDED.resource_type,provider=EXCLUDED.provider,project_scope=EXCLUDED.project_scope,connection_id=EXCLUDED.connection_id,external_resource_id=EXCLUDED.external_resource_id,parent_resource_id=EXCLUDED.parent_resource_id,verification_state=EXCLUDED.verification_state,metadata=EXCLUDED.metadata,provenance=EXCLUDED.provenance,updated_at=EXCLUDED.updated_at RETURNING *`, [record.resourceId, record.resourceType, record.provider, record.projectScope, record.connectionId, record.externalResourceId, record.parentResourceId, record.verificationState, JSON.stringify(record.metadata ?? {}), JSON.stringify(record.provenance ?? {}), record.createdAt, record.updatedAt]);
      return rowResource(result.rows[0]);
    },
    async getResource(resourceId) {
      const result = await database.query('SELECT * FROM managed_resources WHERE resource_id=$1', [resourceId]);
      return rowResource(result.rows[0]);
    },
    async listResources({ projectScope, provider = null } = {}) {
      const result = await database.query(`SELECT * FROM managed_resources WHERE project_scope=$1 AND ($2::text IS NULL OR provider=$2) ORDER BY provider,resource_type,resource_id`, [projectScope, provider]);
      return result.rows.map(rowResource);
    },
    async putAuthority(record) {
      const result = await database.query(`INSERT INTO resource_authorities(authority_id,resource_id,actor_global_user_id,project_scope,relation,applies_to_descendants,delegated_by_global_user_id,verification_state,verification_source,provenance,state,verified_at,expires_at,revoked_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16)
        ON CONFLICT(authority_id) DO UPDATE SET resource_id=EXCLUDED.resource_id,actor_global_user_id=EXCLUDED.actor_global_user_id,project_scope=EXCLUDED.project_scope,relation=EXCLUDED.relation,applies_to_descendants=EXCLUDED.applies_to_descendants,delegated_by_global_user_id=EXCLUDED.delegated_by_global_user_id,verification_state=EXCLUDED.verification_state,verification_source=EXCLUDED.verification_source,provenance=EXCLUDED.provenance,state=EXCLUDED.state,verified_at=EXCLUDED.verified_at,expires_at=EXCLUDED.expires_at,revoked_at=EXCLUDED.revoked_at,updated_at=EXCLUDED.updated_at RETURNING *`, [record.authorityId, record.resourceId, record.actorGlobalUserId, record.projectScope, record.relation, record.appliesToDescendants, record.delegatedByGlobalUserId, record.verificationState, record.verificationSource, JSON.stringify(record.provenance ?? {}), record.state, record.verifiedAt, record.expiresAt, record.revokedAt, record.createdAt, record.updatedAt]);
      return rowAuthority(result.rows[0]);
    },
    async getAuthority(authorityId) {
      const result = await database.query('SELECT * FROM resource_authorities WHERE authority_id=$1', [authorityId]);
      return rowAuthority(result.rows[0]);
    },
    async listAuthorities({ projectScope, actorGlobalUserId = null, resourceId = null, includeRevoked = false } = {}) {
      const result = await database.query(`SELECT * FROM resource_authorities WHERE project_scope=$1
        AND ($2::text IS NULL OR actor_global_user_id=$2)
        AND ($3::text IS NULL OR resource_id=$3)
        AND ($4::boolean OR state='active')
        ORDER BY resource_id,actor_global_user_id,relation,authority_id`, [projectScope, actorGlobalUserId, resourceId, includeRevoked]);
      return result.rows.map(rowAuthority);
    }
  });
}
