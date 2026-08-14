function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createPostgresLanguageStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  return Object.freeze({
    async get(globalUserId) {
      const result = await database.query('SELECT profile FROM users WHERE global_user_id=$1', [required(globalUserId, 'globalUserId')]);
      const settings = result.rows[0]?.profile?.languageSettings ?? null;
      if (!settings?.language) return null;
      return Object.freeze({
        language: settings.language,
        locale: settings.locale ?? null,
        source: settings.source ?? null,
        provenance: settings.provenance ?? null,
        updatedAt: settings.updatedAt ?? null
      });
    },
    async set(globalUserId, record) {
      const id = required(globalUserId, 'globalUserId');
      const language = required(record?.language, 'record.language').toLowerCase();
      const updatedAt = new Date().toISOString();
      const settings = { language, locale: record.locale ?? null, source: record.source ?? null, provenance: record.provenance ?? null, updatedAt };
      const result = await database.query(`INSERT INTO users(global_user_id, profile)
        VALUES ($1, jsonb_build_object('languageSettings', $2::jsonb))
        ON CONFLICT(global_user_id) DO UPDATE SET profile = COALESCE(users.profile, '{}'::jsonb) || jsonb_build_object('languageSettings', $2::jsonb), updated_at=now()
        RETURNING profile`, [id, JSON.stringify(settings)]);
      return Object.freeze({ ...result.rows[0].profile.languageSettings });
    }
  });
}
