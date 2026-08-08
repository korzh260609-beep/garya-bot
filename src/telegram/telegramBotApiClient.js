function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

export class TelegramApiError extends Error {
  constructor(message, { code = 'telegram-api-error', status = null, retryAfterSeconds = null, retryable = false } = {}) {
    super(message);
    this.name = 'TelegramApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryable = retryable;
  }
}

export function createTelegramBotApiClient({
  token = null,
  credentialManager = null,
  credentialAccessContext = null,
  credentialId = 'sg.telegram.bot',
  connectionRegistry = null,
  connectionAccessContext = null,
  connectionId = 'telegram',
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://api.telegram.org',
  timeoutMs = 10000,
  maxRetries = 2,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const hasCredentialManager = credentialManager && typeof credentialManager.useCredential === 'function';
  const legacyToken = hasCredentialManager ? null : requiredString(token, 'telegram bot token');
  if (hasCredentialManager && (!credentialAccessContext?.actor || !credentialAccessContext?.scope)) throw new TypeError('telegram credential access context is required');
  if (connectionRegistry && typeof connectionRegistry.requireUsable !== 'function') throw new TypeError('telegram connection registry is invalid');
  if (connectionRegistry && (!connectionAccessContext?.actor || !connectionAccessContext?.projectScope)) throw new TypeError('telegram connection access context is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  async function withToken(purpose, operation) {
    if (connectionRegistry) await connectionRegistry.requireUsable({ connectionId, capability: 'telegram.bot-api', actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope });
    if (!hasCredentialManager) return operation(legacyToken);
    return credentialManager.useCredential({ credentialId, actor: credentialAccessContext.actor, scope: credentialAccessContext.scope, purpose, connectionId, operation });
  }

  async function call(method, payload = {}) {
    const methodName = requiredString(method, 'telegram method');
    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await withToken(`telegram.api.${methodName}`, (botToken) => fetchImpl(`${baseUrl}/bot${botToken}/${methodName}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        }));
        let body;
        try { body = await response.json(); } catch { body = null; }
        if (response.ok && body?.ok) return body.result;
        const retryAfterSeconds = Number(body?.parameters?.retry_after ?? 0) || null;
        const retryable = response.status === 429 || response.status >= 500;
        const error = new TelegramApiError(body?.description ?? `Telegram API ${methodName} failed`, {
          code: response.status === 429 ? 'telegram-flood-control' : 'telegram-api-failed',
          status: response.status,
          retryAfterSeconds,
          retryable
        });
        if (!retryable || attempt > maxRetries + 1) throw error;
        await sleep((retryAfterSeconds ?? Math.min(2 ** (attempt - 1), 8)) * 1000);
      } catch (error) {
        const normalized = error?.name === 'AbortError'
          ? new TelegramApiError(`Telegram API ${methodName} timed out`, { code: 'telegram-timeout', retryable: true })
          : error instanceof TelegramApiError
            ? error
            : error?.name === 'ExternalConnectionError'
              ? error
              : new TelegramApiError('Telegram network failure', { code: error?.code ?? 'telegram-network-failure', retryable: error?.retryable ?? true });
        if (!normalized.retryable || attempt > maxRetries + 1) throw normalized;
        await sleep(Math.min(2 ** (attempt - 1), 8) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return Object.freeze({
    call,
    sendMessage: ({ chatId, text, messageThreadId = null, replyToMessageId = null }) => call('sendMessage', {
      chat_id: chatId,
      text: requiredString(text, 'telegram message text'),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId }),
      ...(replyToMessageId == null ? {} : { reply_parameters: { message_id: replyToMessageId } })
    }),
    setWebhook: ({ url, secretToken, allowedUpdates = ['message', 'edited_message'] }) => call('setWebhook', {
      url: requiredString(url, 'webhook url'),
      secret_token: requiredString(secretToken, 'webhook secret'),
      allowed_updates: allowedUpdates,
      drop_pending_updates: false
    }),
    deleteWebhook: ({ dropPendingUpdates = false } = {}) => call('deleteWebhook', { drop_pending_updates: dropPendingUpdates }),
    getWebhookInfo: () => call('getWebhookInfo')
  });
}
