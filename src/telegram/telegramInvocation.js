function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post ?? null;
}

function hasMention(message, botUsername) {
  if (!botUsername) return false;
  const username = botUsername.replace(/^@/, '').toLowerCase();
  const text = message?.text ?? message?.caption ?? '';
  return (message?.entities ?? message?.caption_entities ?? []).some((entity) => {
    if (entity.type !== 'mention') return false;
    return text.slice(entity.offset, entity.offset + entity.length).replace(/^@/, '').toLowerCase() === username;
  });
}

function hasBotCommandEntity(message, botUsername) {
  const text = message?.text ?? message?.caption ?? '';
  const entities = message?.entities ?? message?.caption_entities ?? [];
  const username = botUsername ? botUsername.replace(/^@/, '').toLowerCase() : null;
  return entities.some((entity) => {
    if (entity.type !== 'bot_command') return false;
    const token = text.slice(entity.offset, entity.offset + entity.length);
    const target = token.includes('@') ? token.slice(token.indexOf('@') + 1).toLowerCase() : null;
    return target == null || username == null || target === username;
  });
}

export function evaluateTelegramInvocation(update, { botUserId = null, botUsername = null } = {}) {
  const message = messageFrom(update);
  if (!message || message.from?.is_bot) return Object.freeze({ accepted: false, reason: 'unsupported-update', message: null });
  const text = message.text ?? message.caption ?? '';
  if (!text.trim()) return Object.freeze({ accepted: false, reason: 'empty-message', message });

  const chatType = message.chat?.type;
  if (chatType === 'private') return Object.freeze({ accepted: true, reason: 'private-message', message });

  if (!['group', 'supergroup'].includes(chatType)) {
    return Object.freeze({ accepted: false, reason: 'unsupported-chat-type', message });
  }

  const repliedToBot = botUserId != null && String(message.reply_to_message?.from?.id ?? '') === String(botUserId);
  const mentioned = hasMention(message, botUsername);
  const platformCommand = hasBotCommandEntity(message, botUsername);
  if (repliedToBot || mentioned || platformCommand) {
    return Object.freeze({
      accepted: true,
      reason: repliedToBot ? 'group-reply' : mentioned ? 'group-mention' : 'group-platform-command',
      message
    });
  }
  return Object.freeze({ accepted: false, reason: 'group-not-invoked', message });
}
