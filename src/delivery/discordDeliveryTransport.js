export function createDiscordDeliveryTransport({ restClient } = {}) {
  if (!restClient || typeof restClient.sendMessage !== 'function') throw new TypeError('restClient.sendMessage is required');
  return Object.freeze({
    name: 'discord',
    async deliver({ request, target }) {
      if (!target?.address) throw new TypeError('discord delivery target address is required');
      const response = await restClient.sendMessage({
        channelId: target.address,
        text: request.message,
        replyToMessageId: target.replyToMessageId ?? null,
        files: request.metadata?.files ?? []
      });
      return Object.freeze({ provider: 'discord', messageId: response?.id ?? null, channelId: response?.channel_id ?? target.address });
    }
  });
}
