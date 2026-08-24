const TELEGRAM_MESSAGE_CHARACTER_LIMIT = 4096;
const TELEGRAM_SAFE_CHUNK_LIMIT = 4000;

function codePoints(value) {
  return Array.from(String(value ?? ''));
}

function splitTelegramText(text, maxCharacters = TELEGRAM_SAFE_CHUNK_LIMIT) {
  const source = String(text ?? '').trim();
  if (!source) throw new TypeError('telegram delivery message is required');
  const points = codePoints(source);
  if (points.length <= maxCharacters) return Object.freeze([source]);

  const chunks = [];
  let offset = 0;
  while (offset < points.length) {
    const remaining = points.length - offset;
    if (remaining <= maxCharacters) {
      chunks.push(points.slice(offset).join(''));
      break;
    }

    const window = points.slice(offset, offset + maxCharacters);
    let splitAt = -1;
    for (let index = window.length - 1; index >= Math.floor(maxCharacters * 0.6); index -= 1) {
      const current = window[index];
      if (current === '\n') { splitAt = index + 1; break; }
      if (splitAt < 0 && /\s/u.test(current)) splitAt = index + 1;
    }
    if (splitAt <= 0) splitAt = maxCharacters;

    const chunk = points.slice(offset, offset + splitAt).join('').trim();
    if (chunk) chunks.push(chunk);
    offset += splitAt;
    while (offset < points.length && /\s/u.test(points[offset])) offset += 1;
  }

  return Object.freeze(chunks);
}

export function createTelegramDeliveryTransport({ botClient } = {}) {
  if (!botClient || typeof botClient.sendMessage !== 'function') throw new TypeError('botClient.sendMessage is required');
  return Object.freeze({
    name: 'telegram',
    async deliver({ request, target }) {
      if (!target?.address) throw new TypeError('telegram delivery target address is required');
      const chunks = splitTelegramText(request.message);
      const messageIds = [];

      for (let index = 0; index < chunks.length; index += 1) {
        const response = await botClient.sendMessage({
          chatId: target.address,
          text: chunks[index],
          messageThreadId: target.threadId ?? null,
          replyToMessageId: index === 0 ? target.replyToMessageId ?? null : null
        });
        messageIds.push(response?.result?.message_id ?? response?.message_id ?? null);
      }

      return Object.freeze({
        provider: 'telegram',
        messageId: messageIds[0] ?? null,
        messageIds: Object.freeze(messageIds),
        chunkCount: chunks.length
      });
    }
  });
}

export { TELEGRAM_MESSAGE_CHARACTER_LIMIT, TELEGRAM_SAFE_CHUNK_LIMIT, splitTelegramText };
