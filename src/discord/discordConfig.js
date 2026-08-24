function firstNonEmpty(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function positiveInteger(value, fallback, key) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

function nonNegativeInteger(value, fallback, key) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${key} must be a non-negative integer`);
  return parsed;
}

function snowflake(value, key) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{15,22}$/.test(normalized)) throw new Error(`${key} must be a Discord snowflake`);
  return normalized;
}

export const DEFAULT_DISCORD_GATEWAY_INTENTS = 1 | 512 | 4096 | 32768;

export function loadDiscordConfig(env = process.env) {
  const isEnabled = enabled(firstNonEmpty(env, ['SG_DISCORD_ENABLED', 'DISCORD_ENABLED']));
  const applicationIdRaw = firstNonEmpty(env, ['DISCORD_APPLICATION_ID', 'DISCORD_CLIENT_ID']);
  const botUserIdRaw = firstNonEmpty(env, ['DISCORD_BOT_USER_ID']) || applicationIdRaw;

  if (!isEnabled) {
    return Object.freeze({
      enabled: false,
      botTokenCredentialId: 'sg.discord.bot',
      applicationId: applicationIdRaw || null,
      botUserId: botUserIdRaw || null,
      gatewayIntents: DEFAULT_DISCORD_GATEWAY_INTENTS,
      apiTimeoutMs: 10_000,
      apiMaxRetries: 2,
      gatewayReadyTimeoutMs: 15_000,
      reconnectMinMs: 1_000,
      reconnectMaxMs: 30_000
    });
  }

  if (!firstNonEmpty(env, ['DISCORD_BOT_TOKEN'])) throw new Error('DISCORD_BOT_TOKEN is required when SG_DISCORD_ENABLED=true');

  return Object.freeze({
    enabled: true,
    botTokenCredentialId: 'sg.discord.bot',
    applicationId: snowflake(applicationIdRaw, 'DISCORD_APPLICATION_ID'),
    botUserId: snowflake(botUserIdRaw, 'DISCORD_BOT_USER_ID'),
    gatewayIntents: nonNegativeInteger(env.DISCORD_GATEWAY_INTENTS, DEFAULT_DISCORD_GATEWAY_INTENTS, 'DISCORD_GATEWAY_INTENTS'),
    apiTimeoutMs: positiveInteger(env.DISCORD_API_TIMEOUT_MS, 10_000, 'DISCORD_API_TIMEOUT_MS'),
    apiMaxRetries: nonNegativeInteger(env.DISCORD_API_MAX_RETRIES, 2, 'DISCORD_API_MAX_RETRIES'),
    gatewayReadyTimeoutMs: positiveInteger(env.DISCORD_GATEWAY_READY_TIMEOUT_MS, 15_000, 'DISCORD_GATEWAY_READY_TIMEOUT_MS'),
    reconnectMinMs: positiveInteger(env.DISCORD_GATEWAY_RECONNECT_MIN_MS, 1_000, 'DISCORD_GATEWAY_RECONNECT_MIN_MS'),
    reconnectMaxMs: positiveInteger(env.DISCORD_GATEWAY_RECONNECT_MAX_MS, 30_000, 'DISCORD_GATEWAY_RECONNECT_MAX_MS')
  });
}
