function splitDiscordMessage(text, maxLength = 2000) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return [value];
  const chunks = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n', maxLength);
    if (cut < Math.floor(maxLength * 0.5)) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < Math.floor(maxLength * 0.5)) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function createDiscordDeliveryTransport({ restClient } = {}) {
  if (!restClient || typeof restClient.sendMessage !== 'function') throw new TypeError('restClient.sendMessage is required');
  return Object.freeze({
    name: 'discord',
    async deliver({ request, target }) {
      if (!target?.address) throw new TypeError('discord delivery target address is required');
      const chunks = splitDiscordMessage(request.message);
      const responses = [];
      for (let index = 0; index < chunks.length; index += 1) {
        responses.push(await restClient.sendMessage({
          channelId: target.address,
          text: chunks[index],
          replyToMessageId: index === 0 ? target.replyToMessageId ?? null : null,
          files: index === 0 ? request.metadata?.files ?? [] : []
        }));
      }
      const response = responses.at(-1) ?? null;
      return Object.freeze({
        provider: 'discord',
        messageId: response?.id ?? null,
        messageIds: Object.freeze(responses.map((item) => item?.id).filter(Boolean)),
        channelId: response?.channel_id ?? target.address,
        chunks: responses.length
      });
    }
  });
}

export { splitDiscordMessage };
