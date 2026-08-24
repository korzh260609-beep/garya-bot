import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelegramDeliveryTransport,
  splitTelegramText,
  TELEGRAM_SAFE_CHUNK_LIMIT
} from '../src/delivery/telegramDeliveryTransport.js';

test('telegram delivery splits long Unicode text into safe ordered chunks without loss', () => {
  const paragraph = 'Гуси підняли бунт проти людей, уклали союз з інопланетянами й створили власний ШІ. 🪿🚀\n';
  const source = paragraph.repeat(90).trim();
  const chunks = splitTelegramText(source);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(Array.from(chunk).length <= TELEGRAM_SAFE_CHUNK_LIMIT);
  assert.equal(chunks.join('').replace(/\s+/gu, ''), source.replace(/\s+/gu, ''));
});

test('telegram delivery sends every chunk in order and replies only with the first chunk', async () => {
  const calls = [];
  const botClient = {
    async sendMessage(input) {
      calls.push(input);
      return { message_id: calls.length };
    }
  };
  const transport = createTelegramDeliveryTransport({ botClient });
  const message = 'A'.repeat(9000);

  const result = await transport.deliver({
    request: { message },
    target: { address: '123', threadId: '77', replyToMessageId: '55' }
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((item) => item.text).join(''), message);
  assert.equal(calls[0].replyToMessageId, '55');
  assert.equal(calls[1].replyToMessageId, null);
  assert.equal(calls[2].replyToMessageId, null);
  assert.ok(calls.every((item) => item.messageThreadId === '77'));
  assert.equal(result.chunkCount, 3);
  assert.deepEqual(result.messageIds, [1, 2, 3]);
  assert.equal(result.messageId, 1);
});
