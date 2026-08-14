import { createTransportAdapter } from './transportAdapter.js';

function string(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function identifier(value, field) {
  if (value == null || value === '') throw new TypeError(`${field} is required`);
  return string(String(value), field);
}

function base(options, name, metadataResolver) {
  return createTransportAdapter({ ...options, name, metadataResolver });
}

export function createLocalTransportAdapter(options = {}) {
  return base(options, 'local', async (input) => ({
    text: string(input.text, 'text'),
    locale: input.locale ?? 'en',
    channel: 'local',
    platformMessageId: input.messageId ?? null,
    replyToMessageId: input.replyToMessageId ?? null,
    transportSessionId: input.sessionId ?? null,
    continueConversationId: input.continueConversationId ?? null,
    topicShift: input.topicShift === true,
    topicKey: input.topicKey ?? null,
    platformFacts: { platform: 'local', platformUserId: identifier(input.userId ?? 'developer', 'userId'), sessionId: input.sessionId ?? null, profile: input.profile ?? null },
    scopeFacts: { projectId: input.projectId ?? null, groupId: input.groupId ?? null, threadId: input.threadId ?? null },
    attachments: input.attachments ?? []
  }));
}

export function createTelegramTransportAdapter(options = {}) {
  return base(options, 'telegram', async (update) => {
    const message = update.message ?? update.edited_message ?? update.channel_post;
    if (!message) throw new TypeError('telegram update must contain a message');
    const sender = message.from ?? {};
    const displayName = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim() || sender.username || null;
    const chatId = identifier(message.chat?.id, 'telegram chat id');
    return {
      text: string(message.text ?? message.caption, 'telegram message text'),
      locale: sender.language_code ?? update.locale ?? 'ru',
      channel: message.chat?.type ?? 'unknown',
      platformMessageId: identifier(message.message_id, 'telegram message id'),
      replyToMessageId: message.reply_to_message?.message_id == null ? null : String(message.reply_to_message.message_id),
      continueConversationId: update.continueConversationId ?? null,
      topicShift: update.topicShift === true,
      topicKey: update.topicKey ?? null,
      originTarget: {
        transport: 'telegram',
        address: chatId,
        threadId: message.message_thread_id == null ? null : String(message.message_thread_id)
      },
      platformFacts: {
        platform: 'telegram',
        platformUserId: identifier(sender.id, 'telegram user id'),
        platformChatId: chatId,
        profile: {
          displayName,
          firstName: sender.first_name ?? null,
          lastName: sender.last_name ?? null,
          username: sender.username ?? null,
          languageCode: sender.language_code ?? null,
          source: 'telegram'
        }
      },
      scopeFacts: {
        projectId: update.projectId ?? null,
        groupId: ['group', 'supergroup'].includes(message.chat?.type) ? chatId : null,
        threadId: message.message_thread_id == null ? null : String(message.message_thread_id)
      },
      attachments: update.attachments ?? []
    };
  });
}

export function createWebApiTransportAdapter(options = {}) {
  return base(options, 'web-api', async (request) => ({
    text: string(request.body?.text, 'request.body.text'),
    locale: request.body?.locale ?? request.headers?.['accept-language']?.split(',')[0] ?? 'en',
    channel: 'web-api',
    platformMessageId: request.body?.requestId ?? null,
    replyToMessageId: request.body?.replyToMessageId ?? null,
    transportSessionId: request.auth?.sessionId ?? null,
    continueConversationId: request.body?.continueConversationId ?? null,
    topicShift: request.body?.topicShift === true,
    topicKey: request.body?.topicKey ?? null,
    platformFacts: {
      platform: 'web-api',
      platformUserId: identifier(request.auth?.subject, 'request.auth.subject'),
      sessionId: request.auth?.sessionId ?? null,
      profile: request.auth?.profile ?? null
    },
    scopeFacts: {
      projectId: request.body?.projectId ?? null,
      groupId: request.body?.groupId ?? null,
      threadId: request.body?.threadId ?? null
    },
    attachments: request.body?.attachments ?? []
  }));
}

export function createDiscordTransportAdapter(options = {}) {
  return base(options, 'discord', async (event) => ({
    text: string(event.content, 'discord content'),
    locale: event.locale ?? event.guild_locale ?? 'en',
    channel: event.guild_id ? 'guild' : 'direct',
    platformMessageId: identifier(event.id, 'discord message id'),
    replyToMessageId: event.message_reference?.message_id ?? null,
    transportSessionId: event.sessionId ?? null,
    continueConversationId: event.continueConversationId ?? null,
    topicShift: event.topicShift === true,
    topicKey: event.topicKey ?? null,
    platformFacts: {
      platform: 'discord',
      platformUserId: identifier(event.author?.id, 'discord author id'),
      platformChannelId: identifier(event.channel_id, 'discord channel id'),
      platformGuildId: event.guild_id ?? null,
      sessionId: event.sessionId ?? null,
      profile: event.author ? { displayName: event.member?.nick ?? event.author.global_name ?? event.author.username ?? null, username: event.author.username ?? null, source: 'discord' } : null
    },
    scopeFacts: {
      projectId: event.projectId ?? null,
      groupId: event.guild_id ?? null,
      threadId: event.thread_id ?? null
    },
    attachments: event.attachments ?? []
  }));
}

export function createEmailTransportAdapter(options = {}) {
  return base(options, 'email', async (message) => ({
    text: string(message.text ?? message.subject, 'email text'),
    locale: message.locale ?? message.language ?? 'en',
    channel: 'email',
    platformMessageId: identifier(message.messageId, 'email message id'),
    replyToMessageId: message.inReplyTo ?? null,
    transportSessionId: message.threadId ?? null,
    continueConversationId: message.continueConversationId ?? null,
    topicShift: message.topicShift === true,
    topicKey: message.topicKey ?? null,
    platformFacts: { platform: 'email', platformUserId: string(message.from, 'email sender'), sessionId: message.threadId ?? null, profile: message.profile ?? null },
    scopeFacts: { projectId: message.projectId ?? null, groupId: null, threadId: null },
    attachments: message.attachments ?? []
  }));
}

export function createVoiceTransportAdapter(options = {}) {
  return base(options, 'voice', async (utterance) => ({
    text: string(utterance.transcript, 'voice transcript'),
    locale: utterance.locale ?? utterance.language ?? 'en',
    channel: 'voice',
    platformMessageId: utterance.utteranceId ?? null,
    transportSessionId: utterance.sessionId ?? null,
    continueConversationId: utterance.continueConversationId ?? null,
    topicShift: utterance.topicShift === true,
    topicKey: utterance.topicKey ?? null,
    platformFacts: {
      platform: 'voice',
      platformUserId: identifier(utterance.speakerId, 'voice speaker id'),
      deviceId: utterance.deviceId ?? null,
      sessionId: utterance.sessionId ?? null,
      profile: utterance.profile ?? null
    },
    scopeFacts: { projectId: utterance.projectId ?? null, groupId: utterance.groupId ?? null, threadId: utterance.threadId ?? null },
    attachments: utterance.attachments ?? []
  }));
}
