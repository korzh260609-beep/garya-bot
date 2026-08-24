function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value, fallback = null) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}
function boolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (value === true || ['1','true','yes','on'].includes(String(value).trim().toLowerCase())) return true;
  if (value === false || ['0','false','no','off'].includes(String(value).trim().toLowerCase())) return false;
  throw new TypeError('PDK4 boolean configuration must be true or false');
}
function integer(value, name, fallback, { min, max }) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${name} must be between ${min} and ${max}`);
  return number;
}
function repository(value) {
  const repo = required(value, 'SG_PDK4_REPOSITORY').toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo)) throw new TypeError('SG_PDK4_REPOSITORY must be owner/name');
  return repo;
}
function projectKey(value) {
  const key = required(value, 'SG_PDK4_PROJECT_KEY').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key)) throw new TypeError('SG_PDK4_PROJECT_KEY contains unsupported characters');
  return key;
}

export const PDK4_PRODUCTION_CONFIG_DEFAULTS = Object.freeze({
  repository: 'korzh260609-beep/garya-bot',
  branch: 'dev/sg2.1-semantic',
  pollIntervalMs: 300000,
  batchSize: 50,
  maxCommitsPerRun: 200,
  requestTimeoutMs: 15000,
  credentialId: 'sg.github.pdk4'
});

export function loadProductionDevelopmentKnowledgeConfig(env = process.env, { defaultProjectKey = 'sg2.1' } = {}) {
  const enabled = boolean(env.SG_PDK4_ENABLED, false);
  const project = projectKey(optional(env.SG_PDK4_PROJECT_KEY, defaultProjectKey));
  const repo = repository(optional(env.SG_PDK4_REPOSITORY, PDK4_PRODUCTION_CONFIG_DEFAULTS.repository));
  const branch = required(optional(env.SG_PDK4_BRANCH, PDK4_PRODUCTION_CONFIG_DEFAULTS.branch), 'SG_PDK4_BRANCH');
  const pollIntervalMs = integer(env.SG_PDK4_POLL_INTERVAL_MS, 'SG_PDK4_POLL_INTERVAL_MS', PDK4_PRODUCTION_CONFIG_DEFAULTS.pollIntervalMs, { min: 1000, max: 86400000 });
  const batchSize = integer(env.SG_PDK4_BATCH_SIZE, 'SG_PDK4_BATCH_SIZE', PDK4_PRODUCTION_CONFIG_DEFAULTS.batchSize, { min: 1, max: 100 });
  const maxCommitsPerRun = integer(env.SG_PDK4_MAX_COMMITS_PER_RUN, 'SG_PDK4_MAX_COMMITS_PER_RUN', PDK4_PRODUCTION_CONFIG_DEFAULTS.maxCommitsPerRun, { min: 1, max: 250 });
  const requestTimeoutMs = integer(env.SG_PDK4_REQUEST_TIMEOUT_MS, 'SG_PDK4_REQUEST_TIMEOUT_MS', PDK4_PRODUCTION_CONFIG_DEFAULTS.requestTimeoutMs, { min: 1000, max: 120000 });
  const credentialId = required(optional(env.SG_PDK4_GITHUB_CREDENTIAL_ID, PDK4_PRODUCTION_CONFIG_DEFAULTS.credentialId), 'SG_PDK4_GITHUB_CREDENTIAL_ID');
  if (enabled && maxCommitsPerRun < batchSize) throw new TypeError('SG_PDK4_MAX_COMMITS_PER_RUN must be >= SG_PDK4_BATCH_SIZE when PDK4 is enabled');
  return Object.freeze({ enabled, projectKey: project, repository: repo, branch, pollIntervalMs, batchSize, maxCommitsPerRun, requestTimeoutMs, credentialId });
}
