function firstNonEmpty(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

function positiveInteger(value, fallback, key) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${key} must be a non-negative integer`);
  return parsed;
}

function normalizeBaseUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function publicBaseUrl(env) {
  const explicit = normalizeBaseUrl(firstNonEmpty(env, ['BASE_URL', 'TELEGRAM_WEBHOOK_URL']));
  if (explicit) return explicit.replace(/\/webhooks\/telegram$/, '');

  const renderUrl = normalizeBaseUrl(env.RENDER_EXTERNAL_URL);
  if (renderUrl) return renderUrl;

  const hostname = String(env.RENDER_EXTERNAL_HOSTNAME ?? '').trim();
  return hostname ? `https://${hostname}` : '';
}

export function loadTelegramConfig(env = process.env) {
  if (!firstNonEmpty(env, ['TELEGRAM_BOT_TOKEN', 'BOT_TOKEN'])) throw new Error('Telegram bot token is required (TELEGRAM_BOT_TOKEN or BOT_TOKEN)');
  const webhookPath = firstNonEmpty(env, ['TELEGRAM_WEBHOOK_PATH']) || '/webhooks/telegram';
  const baseUrl = publicBaseUrl(env);
  if (!baseUrl) throw new Error('Public base URL is required (BASE_URL, RENDER_EXTERNAL_URL or RENDER_EXTERNAL_HOSTNAME)');

  const sandbox = String(env.TELEGRAM_SANDBOX_ENABLED ?? 'false').toLowerCase() === 'true';
  return Object.freeze({
    botTokenCredentialId: 'sg.telegram.bot',
    webhookSecretCredentialId: 'sg.telegram.webhook',
    webhookUrl: `${baseUrl}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`,
    webhookPath: webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`,
    botUserId: firstNonEmpty(env, ['TELEGRAM_BOT_USER_ID']) || null,
    botUsername: firstNonEmpty(env, ['TELEGRAM_BOT_USERNAME']).replace(/^@/, '') || null,
    apiTimeoutMs: positiveInteger(env.TELEGRAM_API_TIMEOUT_MS, 10000, 'TELEGRAM_API_TIMEOUT_MS'),
    apiMaxRetries: positiveInteger(env.TELEGRAM_API_MAX_RETRIES ?? env.WEBHOOK_SET_RETRIES, 2, 'TELEGRAM_API_MAX_RETRIES'),
    sandbox
  });
}
