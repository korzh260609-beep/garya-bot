function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function pollOptions(options) {
  if (!Array.isArray(options)) throw new TypeError('telegram poll options are required');
  return options.map((option, index) => {
    if (typeof option === 'string') return { text: requiredString(option, `telegram poll option ${index + 1}`) };
    if (!option || typeof option !== 'object') throw new TypeError(`telegram poll option ${index + 1} is invalid`);
    return { ...option, text: requiredString(option.text, `telegram poll option ${index + 1}`) };
  });
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
    getMe: () => call('getMe'),
    getChatMember: ({ chatId, userId }) => call('getChatMember', {
      chat_id: chatId,
      user_id: userId
    }),
    sendMessage: ({ chatId, text, messageThreadId = null, replyToMessageId = null, replyMarkup = null }) => call('sendMessage', {
      chat_id: chatId,
      text: requiredString(text, 'telegram message text'),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId }),
      ...(replyToMessageId == null ? {} : { reply_parameters: { message_id: replyToMessageId } }),
      ...(replyMarkup == null ? {} : { reply_markup: replyMarkup })
    }),
    sendPhoto: ({ chatId, photo, caption = null, messageThreadId = null }) => call('sendPhoto', {
      chat_id: chatId,
      photo: requiredString(photo, 'telegram photo'),
      ...(caption == null || caption === '' ? {} : { caption: String(caption) }),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId })
    }),
    sendVideo: ({ chatId, video, caption = null, messageThreadId = null }) => call('sendVideo', {
      chat_id: chatId,
      video: requiredString(video, 'telegram video'),
      ...(caption == null || caption === '' ? {} : { caption: String(caption) }),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId })
    }),
    sendDocument: ({ chatId, document, caption = null, messageThreadId = null }) => call('sendDocument', {
      chat_id: chatId,
      document: requiredString(document, 'telegram document'),
      ...(caption == null || caption === '' ? {} : { caption: String(caption) }),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId })
    }),
    sendPoll: ({ chatId, question, options, isAnonymous = true, allowsMultipleAnswers = false, type = 'regular', correctOptionId = null, explanation = null, messageThreadId = null }) => call('sendPoll', {
      chat_id: chatId,
      question: requiredString(question, 'telegram poll question'),
      options: pollOptions(options),
      is_anonymous: isAnonymous === true,
      type: type === 'quiz' ? 'quiz' : 'regular',
      allows_multiple_answers: allowsMultipleAnswers === true,
      ...(type === 'quiz' && correctOptionId != null ? { correct_option_id: Number(correctOptionId) } : {}),
      ...(explanation == null || explanation === '' ? {} : { explanation: String(explanation) }),
      ...(messageThreadId == null ? {} : { message_thread_id: messageThreadId })
    }),
    stopPoll: ({ chatId, messageId, replyMarkup = null }) => call('stopPoll', {
      chat_id: chatId,
      message_id: Number(messageId),
      ...(replyMarkup == null ? {} : { reply_markup: replyMarkup })
    }),
    deleteMessage: ({ chatId, messageId }) => call('deleteMessage', {
      chat_id: chatId,
      message_id: Number(messageId)
    }),
    restrictChatMember: ({ chatId, userId, permissions, useIndependentChatPermissions = null, untilDate = null }) => call('restrictChatMember', {
      chat_id: chatId,
      user_id: Number(userId),
      permissions: permissions ?? {},
      ...(useIndependentChatPermissions == null ? {} : { use_independent_chat_permissions: useIndependentChatPermissions === true }),
      ...(untilDate == null ? {} : { until_date: Number(untilDate) })
    }),
    createChatInviteLink: ({ chatId, name = null, expireDate = null, memberLimit = null, createsJoinRequest = false }) => call('createChatInviteLink', {
      chat_id: chatId,
      ...(name == null ? {} : { name: String(name).slice(0, 32) }),
      ...(expireDate == null ? {} : { expire_date: Number(expireDate) }),
      ...(memberLimit == null ? {} : { member_limit: Number(memberLimit) }),
      creates_join_request: createsJoinRequest === true
    }),
    approveChatJoinRequest: ({ chatId, userId }) => call('approveChatJoinRequest', {
      chat_id: chatId,
      user_id: Number(userId)
    }),
    declineChatJoinRequest: ({ chatId, userId }) => call('declineChatJoinRequest', {
      chat_id: chatId,
      user_id: Number(userId)
    }),
    banChatMember: ({ chatId, userId, untilDate = null, revokeMessages = false }) => call('banChatMember', {
      chat_id: chatId,
      user_id: Number(userId),
      ...(untilDate == null ? {} : { until_date: Number(untilDate) }),
      revoke_messages: revokeMessages === true
    }),
    unbanChatMember: ({ chatId, userId, onlyIfBanned = true }) => call('unbanChatMember', {
      chat_id: chatId,
      user_id: Number(userId),
      only_if_banned: onlyIfBanned === true
    }),
    editMessageText: ({ chatId, messageId, text, replyMarkup = null }) => call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: requiredString(text, 'telegram message text'),
      ...(replyMarkup == null ? {} : { reply_markup: replyMarkup })
    }),
    answerCallbackQuery: ({ callbackQueryId, text = null, showAlert = false }) => call('answerCallbackQuery', {
      callback_query_id: requiredString(callbackQueryId, 'callback query id'),
      ...(text == null ? {} : { text: String(text).slice(0, 200) }),
      show_alert: showAlert === true
    }),
    setChatMenuButton: ({ chatId = null, text = 'Управление', webAppUrl = null }) => {
      const normalizedWebAppUrl = typeof webAppUrl === 'string' ? webAppUrl.trim() : '';
      return call('setChatMenuButton', {
        ...(chatId == null ? {} : { chat_id: chatId }),
        menu_button: normalizedWebAppUrl
          ? {
              type: 'web_app',
              text: requiredString(text, 'menu button text').slice(0, 64),
              web_app: { url: normalizedWebAppUrl }
            }
          : { type: 'default' }
      });
    },
    setWebhook: ({ url, secretToken, allowedUpdates = ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query', 'my_chat_member', 'chat_join_request', 'chat_member', 'poll', 'poll_answer'] }) => call('setWebhook', {
      url: requiredString(url, 'webhook url'),
      secret_token: requiredString(secretToken, 'webhook secret'),
      allowed_updates: allowedUpdates,
      drop_pending_updates: false
    }),
    deleteWebhook: ({ dropPendingUpdates = false } = {}) => call('deleteWebhook', { drop_pending_updates: dropPendingUpdates }),
    getWebhookInfo: () => call('getWebhookInfo')
  });
}
