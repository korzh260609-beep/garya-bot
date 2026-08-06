function required(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} is required`);
  return value.trim();
}

function positiveInteger(value, fallback, key) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${key} must be a non-negative integer`);
  return parsed;
}

export function loadTelegramConfig(env = process.env) {
  const sandbox = String(env.TELEGRAM_SANDBOX_ENABLED ?? 'false').toLowerCase() === 'true';
  return Object.freeze({
    token: required(env, 'TELEGRAM_BOT_TOKEN'),
    webhookSecret: required(env, 'TELEGRAM_WEBHOOK_SECRET'),
    webhookUrl: required(env, 'TELEGRAM_WEBHOOK_URL'),
    webhookPath: env.TELEGRAM_WEBHOOK_PATH?.trim() || '/webhooks/telegram',
    botUserId: env.TELEGRAM_BOT_USER_ID?.trim() || null,
    botUsername: env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || null,
    apiTimeoutMs: positiveInteger(env.TELEGRAM_API_TIMEOUT_MS, 10000, 'TELEGRAM_API_TIMEOUT_MS'),
    apiMaxRetries: positiveInteger(env.TELEGRAM_API_MAX_RETRIES, 2, 'TELEGRAM_API_MAX_RETRIES'),
    sandbox
  });
}
