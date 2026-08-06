const COMMANDS = new Set(['/start', '/help', '/profile', '/tasks', '/health']);

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post ?? null;
}

function commandFrom(text = '') {
  const token = text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
  const command = token.includes('@') ? token.slice(0, token.indexOf('@')) : token;
  return COMMANDS.has(command) ? command : null;
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

export function evaluateTelegramInvocation(update, { botUserId = null, botUsername = null } = {}) {
  const message = messageFrom(update);
  if (!message || message.from?.is_bot) return Object.freeze({ accepted: false, reason: 'unsupported-update', command: null, message: null });
  const text = message.text ?? message.caption ?? '';
  if (!text.trim()) return Object.freeze({ accepted: false, reason: 'empty-message', command: null, message });

  const command = commandFrom(text);
  const chatType = message.chat?.type;
  if (chatType === 'private') return Object.freeze({ accepted: true, reason: command ? 'private-command' : 'private-message', command, message });

  if (!['group', 'supergroup'].includes(chatType)) {
    return Object.freeze({ accepted: false, reason: 'unsupported-chat-type', command: null, message });
  }

  const repliedToBot = botUserId != null && String(message.reply_to_message?.from?.id ?? '') === String(botUserId);
  const mentioned = hasMention(message, botUsername);
  if (command || repliedToBot || mentioned) {
    return Object.freeze({ accepted: true, reason: command ? 'group-command' : repliedToBot ? 'group-reply' : 'group-mention', command, message });
  }
  return Object.freeze({ accepted: false, reason: 'group-not-invoked', command: null, message });
}

export function renderTelegramCommand(command, { profile = null, tasks = null, health = null } = {}) {
  switch (command) {
    case '/start':
      return 'СГ подключён. Напишите сообщение или используйте /help.';
    case '/help':
      return 'Команды: /start, /help, /profile, /tasks, /health.';
    case '/profile':
      return profile ? `Профиль: ${profile}` : 'Профиль доступен через Identity and Scope.';
    case '/tasks':
      return tasks ? `Задачи:\n${tasks}` : 'Активных задач нет.';
    case '/health':
      return health ? `Состояние СГ: ${health}` : 'Состояние СГ: доступен.';
    default:
      return null;
  }
}
