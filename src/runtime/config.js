function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function positiveInteger(value, name, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
}

function boolean(value, fallback = false) {
  if (value == null) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new TypeError('boolean configuration value must be true or false');
}

export function loadRuntimeConfig(env = process.env) {
  const environment = required(env.SG_ENVIRONMENT ?? 'local', 'SG_ENVIRONMENT');
  const revision = required(env.SG_REVISION ?? 'dev', 'SG_REVISION');
  const projectScope = required(env.SG_PROJECT_SCOPE ?? 'sg2.1', 'SG_PROJECT_SCOPE');
  const shutdownTimeoutMs = positiveInteger(env.SG_SHUTDOWN_TIMEOUT_MS, 'SG_SHUTDOWN_TIMEOUT_MS', 5000);
  const persistenceMode = required(env.SG_PERSISTENCE_MODE ?? 'memory', 'SG_PERSISTENCE_MODE');
  if (!['memory', 'postgres'].includes(persistenceMode)) throw new TypeError('SG_PERSISTENCE_MODE must be memory or postgres');
  const databaseUrl = persistenceMode === 'postgres' ? required(env.DATABASE_URL, 'DATABASE_URL') : null;
  const databaseSsl = boolean(env.DATABASE_SSL, false);
  return Object.freeze({ environment, revision, projectScope, shutdownTimeoutMs, persistenceMode, databaseUrl, databaseSsl });
}
