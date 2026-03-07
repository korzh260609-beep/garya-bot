'use strict';

const { redactMessage } = require('./redactMessage');
const { normalizeMessageForStorage } = require('./normalizeMessageForStorage');
const { computeTextHash } = require('./computeTextHash');

function buildStoredMessage(payload = {}) {
  const rawInput = payload.textRaw ?? '';
  const redacted = redactMessage(rawInput);
  const normalized = normalizeMessageForStorage(redacted);

  return {
    chatId: payload.chatId ? String(payload.chatId) : null,
    platform: payload.platform ? String(payload.platform) : null,
    platformMessageId: payload.platformMessageId
      ? String(payload.platformMessageId)
      : null,
    direction: payload.direction ? String(payload.direction) : null, // incoming | outgoing
    userId: payload.userId ? String(payload.userId) : null,
    role: payload.role ? String(payload.role) : null,
    textRaw: rawInput === null || rawInput === undefined ? '' : String(rawInput),
    textRedacted: normalized.text,
    textHash: computeTextHash(normalized.text),
    truncated: normalized.truncated,
  };
}

module.exports = {
  buildStoredMessage,
};