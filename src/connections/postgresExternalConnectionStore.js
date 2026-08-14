function rowToRecord(row) {
  if (!row) return null;
  return {
    connectionId: row.connection_id,
    provider: row.provider,
    serviceType: row.service_type,
    ownerGlobalUserId: row.owner_global_user_id,
    projectScope: row.project_scope,
    externalAccountId: row.external_account_id,
    externalAccount: row.external_account ?? {},
    credentialId: row.credential_id,
    grantedScopes: row.granted_scopes ?? [],
    permissions: row.permissions ?? [],
    capabilities: row.capabilities ?? [],
    status: row.status,
    healthState: row.health_state,
    lastVerifiedAt: row.last_verified_at?.toISOString?.() ?? row.last_verified_at ?? null,
    lastSuccessfulVerificationAt: row.last_successful_verification_at?.toISOString?.() ?? row.last_successful_verification_at ?? null,
    revokedAt: row.revoked_at?.toISOString?.() ?? row.revoked_at ?? null,
    provenance: row.provenance ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at
  };
}

export function createPostgresExternalConnectionStore({ database } = {}) {
  if (!database || typeof database.query !== 'function') throw new TypeError('database.query is required');
  return Object.freeze({
    async put(record) {
      const result = await database.query(`INSERT INTO external_connections(
        connection_id,provider,service_type,owner_global_user_id,project_scope,external_account_id,external_account,
        credential_id,granted_scopes,permissions,capabilities,status,health_state,last_verified_at,
        last_successful_verification_at,revoked_at,provenance,metadata,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20)
        ON CONFLICT(connection_id) DO UPDATE SET
          provider=EXCLUDED.provider,service_type=EXCLUDED.service_type,owner_global_user_id=EXCLUDED.owner_global_user_id,
          project_scope=EXCLUDED.project_scope,external_account_id=EXCLUDED.external_account_id,external_account=EXCLUDED.external_account,
          credential_id=EXCLUDED.credential_id,granted_scopes=EXCLUDED.granted_scopes,permissions=EXCLUDED.permissions,
          capabilities=EXCLUDED.capabilities,status=EXCLUDED.status,health_state=EXCLUDED.health_state,
          last_verified_at=EXCLUDED.last_verified_at,last_successful_verification_at=EXCLUDED.last_successful_verification_at,
          revoked_at=EXCLUDED.revoked_at,provenance=EXCLUDED.provenance,metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at
        WHERE external_connections.project_scope=EXCLUDED.project_scope
          AND external_connections.owner_global_user_id IS NOT DISTINCT FROM EXCLUDED.owner_global_user_id
        RETURNING *`, [record.connectionId, record.provider, record.serviceType, record.ownerGlobalUserId, record.projectScope,
          record.externalAccountId, JSON.stringify(record.externalAccount ?? {}), record.credentialId,
          JSON.stringify(record.grantedScopes ?? []), JSON.stringify(record.permissions ?? []), JSON.stringify(record.capabilities ?? []),
          record.status, record.healthState, record.lastVerifiedAt, record.lastSuccessfulVerificationAt, record.revokedAt,
          JSON.stringify(record.provenance ?? {}), JSON.stringify(record.metadata ?? {}), record.createdAt, record.updatedAt]);
      if (result.rowCount === 0) throw new Error('external connection scope mismatch');
      return rowToRecord(result.rows[0]);
    },
    async get(connectionId) {
      const result = await database.query('SELECT * FROM external_connections WHERE connection_id=$1', [connectionId]);
      return rowToRecord(result.rows[0]);
    },
    async list({ projectScope, ownerGlobalUserId = null, provider = null } = {}) {
      const result = await database.query(`SELECT * FROM external_connections WHERE project_scope=$1
        AND ($2::text IS NULL OR owner_global_user_id=$2)
        AND ($3::text IS NULL OR provider=$3)
        ORDER BY provider, external_account_id, connection_id`, [projectScope, ownerGlobalUserId, provider]);
      return result.rows.map(rowToRecord);
    }
  });
}
