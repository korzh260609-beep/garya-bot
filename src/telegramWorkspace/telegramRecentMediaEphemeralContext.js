const DEFAULT_TTL_MS = 10 * 60 * 1000;
const entries = new Map();

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? null;
}

function key(update) {
  const message = messageFrom(update);
  const actorId = message?.from?.id;
  const chatId = message?.chat?.id;
  if (actorId == null || chatId == null) return null;
  return `${String(actorId)}:${String(chatId)}`;
}

function extract(update) {
  const message = messageFrom(update);
  if (!message) return null;
  if (Array.isArray(message.photo) && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    if (!photo?.file_id) return null;
    return Object.freeze({
      mediaType: 'photo',
      fileId: String(photo.file_id),
      fileUniqueId: photo.file_unique_id ?? null,
      fileName: null,
      mimeType: 'image/jpeg',
      caption: message.caption ?? '',
      updateId: update?.update_id ?? null
    });
  }
  if (message.video?.file_id) return Object.freeze({
    mediaType: 'video', fileId: String(message.video.file_id), fileUniqueId: message.video.file_unique_id ?? null,
    fileName: message.video.file_name ?? null, mimeType: message.video.mime_type ?? 'video/mp4', caption: message.caption ?? '', updateId: update?.update_id ?? null
  });
  if (message.document?.file_id) return Object.freeze({
    mediaType: 'document', fileId: String(message.document.file_id), fileUniqueId: message.document.file_unique_id ?? null,
    fileName: message.document.file_name ?? null, mimeType: message.document.mime_type ?? null, caption: message.caption ?? '', updateId: update?.update_id ?? null
  });
  return null;
}

function currentMedia(update) {
  return extract(update);
}

function captureRecentMedia(update, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  const media = extract(update);
  const contextKey = key(update);
  if (!media || !contextKey) return Object.freeze({ captured: false });
  entries.set(contextKey, Object.freeze({ media, expiresAt: Number(now) + Number(ttlMs) }));
  return Object.freeze({ captured: true, mediaType: media.mediaType });
}

function getRecentMedia(update, { now = Date.now() } = {}) {
  const contextKey = key(update);
  if (!contextKey) return null;
  const entry = entries.get(contextKey);
  if (!entry) return null;
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= Number(now)) {
    entries.delete(contextKey);
    return null;
  }
  return entry.media;
}

function injectMedia(update, media) {
  if (!media || currentMedia(update)) return update;
  const message = messageFrom(update);
  if (!message) return update;
  const synthetic = { ...message };
  if (media.mediaType === 'photo') {
    synthetic.photo = [{ file_id: media.fileId, file_unique_id: media.fileUniqueId ?? undefined }];
  } else if (media.mediaType === 'video') {
    synthetic.video = { file_id: media.fileId, file_unique_id: media.fileUniqueId ?? undefined, file_name: media.fileName ?? undefined, mime_type: media.mimeType ?? undefined };
  } else if (media.mediaType === 'document') {
    synthetic.document = { file_id: media.fileId, file_unique_id: media.fileUniqueId ?? undefined, file_name: media.fileName ?? undefined, mime_type: media.mimeType ?? undefined };
  } else {
    return update;
  }
  if (media.caption && typeof synthetic.caption !== 'string') synthetic.caption = media.caption;
  if (update.message === message) return Object.freeze({ ...update, message: Object.freeze(synthetic) });
  if (update.edited_message === message) return Object.freeze({ ...update, edited_message: Object.freeze(synthetic) });
  return update;
}

function clearRecentMediaForTests() {
  entries.clear();
}

export {
  DEFAULT_TTL_MS as TELEGRAM_RECENT_MEDIA_TTL_MS,
  captureRecentMedia,
  getRecentMedia,
  injectMedia,
  currentMedia,
  clearRecentMediaForTests
};
