export function createTelegramDeliveryTransport({ botClient } = {}) {
  if (!botClient || typeof botClient.sendMessage !== 'function') throw new TypeError('botClient.sendMessage is required');
  return Object.freeze({
    name: 'telegram',
    async deliver({ request, target }) {
      if (!target?.address) throw new TypeError('telegram delivery target address is required');
      const response = await botClient.sendMessage({
        chatId: target.address,
        text: request.message,
        messageThreadId: target.threadId ?? null,
        replyToMessageId: target.replyToMessageId ?? null
      });
      return Object.freeze({ provider: 'telegram', messageId: response?.result?.message_id ?? response?.message_id ?? null });
    }
  });
}
