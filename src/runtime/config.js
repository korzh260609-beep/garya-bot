function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function positiveInteger(value, name, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
}

export function loadRuntimeConfig(env = process.env) {
  const environment = required(env.SG_ENVIRONMENT ?? 'local', 'SG_ENVIRONMENT');
  const revision = required(env.SG_REVISION ?? 'dev', 'SG_REVISION');
  const projectScope = required(env.SG_PROJECT_SCOPE ?? 'sg2.1', 'SG_PROJECT_SCOPE');
  const shutdownTimeoutMs = positiveInteger(env.SG_SHUTDOWN_TIMEOUT_MS, 'SG_SHUTDOWN_TIMEOUT_MS', 5000);
  return Object.freeze({ environment, revision, projectScope, shutdownTimeoutMs });
}
