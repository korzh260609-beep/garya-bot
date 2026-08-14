import { normalizeFeatureFlag } from './featureFlags.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function rowToFlag(row) {
  if (!row) return null;
  return Object.freeze({
    featureId: row.feature_id,
    enabled: row.enabled,
    killSwitch: row.kill_switch,
    securityMode: row.security_mode,
    environments: Object.freeze(row.environments ?? []),
    projects: Object.freeze(row.projects ?? []),
    roles: Object.freeze(row.roles ?? []),
    users: Object.freeze(row.users ?? []),
    resources: Object.freeze(row.resources ?? []),
    cohorts: Object.freeze(row.cohorts ?? []),
    percentage: row.percentage,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    reviewAt: row.review_at ? new Date(row.review_at).toISOString() : null,
    temporary: row.temporary,
    metadata: Object.freeze(row.metadata ?? {}),
    version: row.version,
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

export function createPostgresFeatureFlagStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  return Object.freeze({
    async upsert(input) {
      const flag = normalizeFeatureFlag(input);
      const result = await database.query(`
        INSERT INTO feature_flags(
          feature_id,enabled,kill_switch,security_mode,environments,projects,roles,users,resources,cohorts,
          percentage,expires_at,review_at,temporary,metadata,version,updated_at
        ) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16,NOW())
        ON CONFLICT(feature_id) DO UPDATE SET
          enabled=EXCLUDED.enabled,kill_switch=EXCLUDED.kill_switch,security_mode=EXCLUDED.security_mode,
          environments=EXCLUDED.environments,projects=EXCLUDED.projects,roles=EXCLUDED.roles,users=EXCLUDED.users,
          resources=EXCLUDED.resources,cohorts=EXCLUDED.cohorts,percentage=EXCLUDED.percentage,
          expires_at=EXCLUDED.expires_at,review_at=EXCLUDED.review_at,temporary=EXCLUDED.temporary,
          metadata=EXCLUDED.metadata,version=EXCLUDED.version,updated_at=NOW()
        RETURNING *`, [
          flag.featureId, flag.enabled, flag.killSwitch, flag.securityMode,
          JSON.stringify(flag.environments), JSON.stringify(flag.projects), JSON.stringify(flag.roles), JSON.stringify(flag.users),
          JSON.stringify(flag.resources), JSON.stringify(flag.cohorts), flag.percentage, flag.expiresAt, flag.reviewAt,
          flag.temporary, JSON.stringify(flag.metadata), flag.version
        ]);
      return rowToFlag(result.rows[0]);
    },
    async get(featureId) {
      const result = await database.query('SELECT * FROM feature_flags WHERE feature_id=$1', [required(featureId,'featureId')]);
      return rowToFlag(result.rows[0]);
    },
    async list() {
      const result = await database.query('SELECT * FROM feature_flags ORDER BY feature_id');
      return result.rows.map(rowToFlag);
    },
    async remove(featureId) {
      const result = await database.query('DELETE FROM feature_flags WHERE feature_id=$1', [required(featureId,'featureId')]);
      return result.rowCount > 0;
    }
  });
}
