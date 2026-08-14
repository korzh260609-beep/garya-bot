function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function rowToRecord(row) {
  if (!row) return null;
  return Object.freeze({
    globalUserId: row.global_user_id,
    projectScope: row.project_scope ?? null,
    settings: row.settings ?? {},
    explicitFields: row.explicit_fields ?? [],
    inferredFields: row.inferred_fields ?? [],
    source: row.source ?? null,
    provenance: row.provenance ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  });
}

export function createPostgresUserSettingsStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  return Object.freeze({
    async get(globalUserId, projectScope = null) {
      const result = await database.query(`SELECT global_user_id, project_scope, settings, explicit_fields, inferred_fields, source, provenance, updated_at
        FROM user_settings WHERE global_user_id=$1 AND project_scope IS NOT DISTINCT FROM $2`, [required(globalUserId, 'globalUserId'), projectScope]);
      return rowToRecord(result.rows[0]);
    },
    async set(record) {
      const id = required(record?.globalUserId, 'record.globalUserId');
      const result = await database.query(`INSERT INTO users(global_user_id, profile) VALUES ($1,'{}'::jsonb) ON CONFLICT(global_user_id) DO NOTHING`, [id]);
      void result;
      const saved = await database.query(`INSERT INTO user_settings(global_user_id, project_scope, settings, explicit_fields, inferred_fields, source, provenance, updated_at)
        VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8)
        ON CONFLICT(global_user_id, project_scope_key) DO UPDATE SET settings=EXCLUDED.settings, explicit_fields=EXCLUDED.explicit_fields,
          inferred_fields=EXCLUDED.inferred_fields, source=EXCLUDED.source, provenance=EXCLUDED.provenance, updated_at=EXCLUDED.updated_at
        RETURNING global_user_id, project_scope, settings, explicit_fields, inferred_fields, source, provenance, updated_at`, [
        id, record.projectScope ?? null, JSON.stringify(record.settings ?? {}), JSON.stringify(record.explicitFields ?? []),
        JSON.stringify(record.inferredFields ?? []), record.source ?? null, JSON.stringify(record.provenance ?? {}), record.updatedAt ?? new Date().toISOString()
      ]);
      return rowToRecord(saved.rows[0]);
    }
  });
}
