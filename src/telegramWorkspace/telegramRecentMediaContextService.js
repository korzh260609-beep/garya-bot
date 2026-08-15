function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? null;
}

function extractMedia(update) {
  const message = messageFrom(update);
  if (!message) return null;
  if (Array.isArray(message.photo) && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    if (!photo?.file_id) return null;
    return Object.freeze({ mediaType: 'photo', fileId: String(photo.file_id), fileUniqueId: photo.file_unique_id ?? null, fileName: null, mimeType: 'image/jpeg', caption: message.caption ?? '', updateId: update?.update_id ?? null });
  }
  if (message.video?.file_id) return Object.freeze({ mediaType: 'video', fileId: String(message.video.file_id), fileUniqueId: message.video.file_unique_id ?? null, fileName: message.video.file_name ?? null, mimeType: message.video.mime_type ?? 'video/mp4', caption: message.caption ?? '', updateId: update?.update_id ?? null });
  if (message.document?.file_id) return Object.freeze({ mediaType: 'document', fileId: String(message.document.file_id), fileUniqueId: message.document.file_unique_id ?? null, fileName: message.document.file_name ?? null, mimeType: message.document.mime_type ?? null, caption: message.caption ?? '', updateId: update?.update_id ?? null });
  return null;
}

export function createTelegramRecentMediaContextService({ identityResolver, store, projectScope = 'sg2.1' } = {}) {
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof store?.put !== 'function' || typeof store?.getLatest !== 'function') throw new TypeError('recent media context store is required');
  const project = required(projectScope, 'projectScope');

  async function identify(update) {
    const message = messageFrom(update);
    const source = message?.from;
    if (!source?.id || !message?.chat?.id) return null;
    const chatId = String(message.chat.id);
    const platformUserId = String(source.id);
    const resolution = await identityResolver(Object.freeze({
      transport: 'telegram',
      platformFacts: Object.freeze({
        platform: 'telegram',
        platformUserId,
        platformChatId: chatId,
        profile: Object.freeze({
          displayName: [source.first_name, source.last_name].filter(Boolean).join(' ').trim() || source.username || null,
          firstName: source.first_name ?? null,
          lastName: source.last_name ?? null,
          username: source.username ?? null,
          languageCode: source.language_code ?? null,
          source: 'telegram'
        })
      }),
      scopeFacts: Object.freeze({
        projectId: project,
        groupId: ['group', 'supergroup'].includes(message.chat.type) ? chatId : null,
        threadId: message.message_thread_id == null ? null : String(message.message_thread_id)
      })
    }));
    const actorGlobalUserId = required(resolution?.identityContext?.globalUserId, 'resolved globalUserId');
    return Object.freeze({ actorGlobalUserId, chatId });
  }

  async function capture(update) {
    const media = extractMedia(update);
    if (!media) return Object.freeze({ captured: false, reason: 'no-media' });
    const actor = await identify(update);
    if (!actor) return Object.freeze({ captured: false, reason: 'no-actor' });
    const saved = await store.put({ actorGlobalUserId: actor.actorGlobalUserId, chatId: actor.chatId, media });
    return Object.freeze({ captured: true, actorGlobalUserId: actor.actorGlobalUserId, chatId: actor.chatId, mediaType: saved.mediaType, expiresAt: saved.expiresAt });
  }

  return Object.freeze({ capture });
}
