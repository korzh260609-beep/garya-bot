// media/fileIntake.js
// Обработка вложений (фото, видео и др.) из Telegram.

import TelegramBot from "node-telegram-bot-api";

/**
 * Анализ вложений сообщения Telegram.
 * Выдаёт строку с информацией для удобной вставки в контекст ИИ.
 *
 * ⚠️ Это упрощённая версия. Позже (Этап 7–8) появится полноценный File-Intake модуль.
 */
export function describeMediaAttachments(msg) {
  if (!msg || !msg.photo || !Array.isArray(msg.photo)) {
    return null;
  }

  const photoArray = msg.photo;

  // Берём самое большое фото (последний элемент массива)
  const biggestPhoto = photoArray[photoArray.length - 1];

  return `📷 Вложено изображение (file_id=${biggestPhoto.file_id}, размер=${biggestPhoto.width}x${biggestPhoto.height}).`;
}

