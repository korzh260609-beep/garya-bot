// src/media/fileIntake.js
// === FILE-INTAKE V1 — краткое описание вложений из Telegram-сообщения ===
//
// Задача: по объекту msg из Telegram определить,
// есть ли вложение (фото/документ/аудио/видео/voice) и вернуть
// краткую структуру, с которой дальше сможет работать ИИ-слой.
//
// Этап 7: без скачивания файлов, только метаданные.

/**
 * Определяет главное вложение в сообщении и возвращает краткое описание.
 *
 * @param {Object} msg - объект Telegram Message
 * @returns {Object|null} summary
 *
 * Пример ответа:
 *   {
 *     kind: "photo" | "document" | "audio" | "voice" | "video",
 *     chatId: number,
 *     messageId: number,
 *     fileId: string,
 *     fileUniqueId: string | undefined,
 *     fileName?: string,
 *     mimeType?: string,
 *     fileSize?: number,
 *     width?: number,
 *     height?: number,
 *   }
 */
export function summarizeMediaAttachment(msg) {
  if (!msg || typeof msg !== "object") return null;

  const chatId = msg.chat?.id ?? null;
  const messageId = msg.message_id ?? null;

  // 1) PHOTO
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    // Берём самое большое фото (последний элемент массива)
    const photo = msg.photo[msg.photo.length - 1];
    return {
      kind: "photo",
      chatId,
      messageId,
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      width: photo.width,
      height: photo.height,
      fileSize: photo.file_size,
    };
  }

  // 2) DOCUMENT
  if (msg.document) {
    const d = msg.document;
    return {
      kind: "document",
      chatId,
      messageId,
      fileId: d.file_id,
      fileUniqueId: d.file_unique_id,
      fileName: d.file_name || null,
      mimeType: d.mime_type || null,
      fileSize: d.file_size,
    };
  }

  // 3) AUDIO
  if (msg.audio) {
    const a = msg.audio;
    return {
      kind: "audio",
      chatId,
      messageId,
      fileId: a.file_id,
      fileUniqueId: a.file_unique_id,
      mimeType: a.mime_type || null,
      fileSize: a.file_size,
      duration: a.duration,
      title: a.title || null,
      performer: a.performer || null,
    };
  }

  // 4) VOICE (голосовые)
  if (msg.voice) {
    const v = msg.voice;
    return {
      kind: "voice",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      duration: v.duration,
    };
  }

  // 5) VIDEO
  if (msg.video) {
    const v = msg.video;
    return {
      kind: "video",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      width: v.width,
      height: v.height,
      duration: v.duration,
    };
  }

  // Можно расширять дальше (sticker, video_note, animation, etc.)

  // Если вложений нет — возвращаем null
  return null;
}
