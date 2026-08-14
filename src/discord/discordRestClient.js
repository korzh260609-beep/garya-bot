function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function sleepDefault(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export class DiscordApiError extends Error {
  constructor(message, { code = 'discord-api-error', status = null, retryAfterMs = null, retryable = false } = {}) {
    super(message);
    this.name = 'DiscordApiError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
  }
}

export function createDiscordRestClient({
  token = null,
  credentialManager = null,
  credentialAccessContext = null,
  credentialId = 'sg.discord.bot',
  connectionRegistry = null,
  connectionAccessContext = null,
  connectionId = 'discord',
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://discord.com/api/v10',
  timeoutMs = 10_000,
  maxRetries = 2,
  sleep = sleepDefault
} = {}) {
  const hasCredentialManager = credentialManager && typeof credentialManager.useCredential === 'function';
  const legacyToken = hasCredentialManager ? null : requiredString(token, 'discord bot token');
  if (hasCredentialManager && (!credentialAccessContext?.actor || !credentialAccessContext?.scope)) throw new TypeError('discord credential access context is required');
  if (connectionRegistry && typeof connectionRegistry.requireUsable !== 'function') throw new TypeError('discord connection registry is invalid');
  if (connectionRegistry && (!connectionAccessContext?.actor || !connectionAccessContext?.projectScope)) throw new TypeError('discord connection access context is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  async function withToken(purpose, operation) {
    if (connectionRegistry) await connectionRegistry.requireUsable({ connectionId, capability: 'discord.bot-api', actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope });
    if (!hasCredentialManager) return operation(legacyToken);
    return credentialManager.useCredential({ credentialId, actor: credentialAccessContext.actor, scope: credentialAccessContext.scope, purpose, connectionId, operation });
  }

  async function request(method, path, { body = null, headers = {}, multipart = false } = {}) {
    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await withToken(`discord.api.${method.toLowerCase()}.${path}`, (botToken) => fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: {
            authorization: `Bot ${botToken}`,
            ...(multipart ? {} : { 'content-type': 'application/json' }),
            ...headers
          },
          body: body == null ? undefined : multipart ? body : JSON.stringify(body),
          signal: controller.signal
        }));
        let payload = null;
        try { payload = response.status === 204 ? null : await response.json(); } catch {}
        if (response.ok) return payload;
        const retryAfterSeconds = Number(payload?.retry_after ?? response.headers?.get?.('retry-after') ?? 0) || 0;
        const retryAfterMs = retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds * 1000) : null;
        const retryable = response.status === 429 || response.status >= 500;
        const error = new DiscordApiError(payload?.message ?? `Discord API request failed (${response.status})`, {
          code: response.status === 429 ? 'discord-rate-limited' : 'discord-api-failed',
          status: response.status,
          retryAfterMs,
          retryable
        });
        if (!retryable || attempt > maxRetries + 1) throw error;
        await sleep(retryAfterMs ?? Math.min(2 ** (attempt - 1), 8) * 1000);
      } catch (error) {
        const normalized = error?.name === 'AbortError'
          ? new DiscordApiError('Discord API request timed out', { code: 'discord-timeout', retryable: true })
          : error instanceof DiscordApiError
            ? error
            : error?.name === 'ExternalConnectionError' || error?.name === 'CredentialAccessError'
              ? error
              : new DiscordApiError('Discord network failure', { code: error?.code ?? 'discord-network-failure', retryable: error?.retryable ?? true });
        if (!normalized.retryable || attempt > maxRetries + 1) throw normalized;
        await sleep(normalized.retryAfterMs ?? Math.min(2 ** (attempt - 1), 8) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async function sendMessage({ channelId, text, replyToMessageId = null, files = [] } = {}) {
    const channel = requiredString(String(channelId ?? ''), 'discord channel id');
    const content = requiredString(text, 'discord message text');
    const messageReference = replyToMessageId == null ? null : { message_id: requiredString(String(replyToMessageId), 'discord reply message id'), fail_if_not_exists: false };

    if (!Array.isArray(files) || files.length === 0) {
      return request('POST', `/channels/${encodeURIComponent(channel)}/messages`, {
        body: { content, ...(messageReference ? { message_reference: messageReference } : {}) }
      });
    }

    const form = new FormData();
    const attachments = [];
    files.forEach((file, index) => {
      const name = requiredString(file?.name ?? `attachment-${index}`, 'discord attachment name');
      const data = file?.data;
      if (!(data instanceof Blob) && !(data instanceof Uint8Array) && !Buffer.isBuffer(data)) throw new TypeError('discord attachment data must be Blob, Uint8Array or Buffer');
      const blob = data instanceof Blob ? data : new Blob([data], { type: file?.contentType ?? 'application/octet-stream' });
      form.append(`files[${index}]`, blob, name);
      attachments.push({ id: index, filename: name, ...(file?.description ? { description: String(file.description).slice(0, 1024) } : {}) });
    });
    form.append('payload_json', JSON.stringify({ content, attachments, ...(messageReference ? { message_reference: messageReference } : {}) }));
    return request('POST', `/channels/${encodeURIComponent(channel)}/messages`, { body: form, multipart: true });
  }

  return Object.freeze({
    request,
    sendMessage,
    getCurrentUser: () => request('GET', '/users/@me'),
    getGatewayBot: () => request('GET', '/gateway/bot')
  });
}
