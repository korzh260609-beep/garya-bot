function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createPostgresTimezoneStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');

  return Object.freeze({
    async get(globalUserId) {
      const result = await database.query(`SELECT timezone, timezone_source, timezone_provenance, timezone_updated_at
        FROM users WHERE global_user_id=$1`, [required(globalUserId, 'globalUserId')]);
      const row = result.rows[0];
      if (!row?.timezone) return null;
      return Object.freeze({
        timeZone: row.timezone,
        source: row.timezone_source ?? null,
        provenance: row.timezone_provenance ?? null,
        updatedAt: row.timezone_updated_at ? new Date(row.timezone_updated_at).toISOString() : null
      });
    },

    async set(globalUserId, record) {
      const id = required(globalUserId, 'globalUserId');
      const timeZone = required(record?.timeZone, 'record.timeZone');
      const result = await database.query(`INSERT INTO users(global_user_id, profile, timezone, timezone_source, timezone_provenance, timezone_updated_at)
        VALUES ($1,'{}'::jsonb,$2,$3,$4::jsonb,now())
        ON CONFLICT(global_user_id) DO UPDATE SET timezone=EXCLUDED.timezone, timezone_source=EXCLUDED.timezone_source,
          timezone_provenance=EXCLUDED.timezone_provenance, timezone_updated_at=now(), updated_at=now()
        RETURNING timezone, timezone_source, timezone_provenance, timezone_updated_at`,
      [id, timeZone, record.source ?? null, JSON.stringify(record.provenance ?? {})]);
      const row = result.rows[0];
      return Object.freeze({
        timeZone: row.timezone,
        source: row.timezone_source ?? null,
        provenance: row.timezone_provenance ?? null,
        updatedAt: new Date(row.timezone_updated_at).toISOString()
      });
    }
  });
}
