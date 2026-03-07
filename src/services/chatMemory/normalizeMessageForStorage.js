'use strict';

const DEFAULT_MAX_BYTES = 12 * 1024; // 12 KB

function safeTrimToUtf8Bytes(value, maxBytes) {
  let result = String(value);

  while (Buffer.byteLength(result, 'utf8') > maxBytes) {
    result = result.slice(0, -1);
  }

  return result;
}

function normalizeMessageForStorage(input, options = {}) {
  const maxBytes = Number.isInteger(options.maxBytes)
    ? options.maxBytes
    : DEFAULT_MAX_BYTES;

  if (input === null || input === undefined) {
    return {
      text: '',
      truncated: false,
      byteLength: 0,
    };
  }

  let text = String(input);

  const originalBytes = Buffer.byteLength(text, 'utf8');
  if (originalBytes <= maxBytes) {
    return {
      text,
      truncated: false,
      byteLength: originalBytes,
    };
  }

  text = safeTrimToUtf8Bytes(text, maxBytes);

  return {
    text,
    truncated: true,
    byteLength: Buffer.byteLength(text, 'utf8'),
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  normalizeMessageForStorage,
};