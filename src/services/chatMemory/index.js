'use strict';

const { buildStoredMessage } = require('./buildStoredMessage');
const { insertChatMessage } = require('./chatMessagesRepo');

async function saveIncomingMessage(payload) {
  const message = buildStoredMessage({
    ...payload,
    direction: 'incoming',
  });

  if (!message.chatId) {
    throw new Error('saveIncomingMessage: chatId is required');
  }

  if (!message.platform) {
    throw new Error('saveIncomingMessage: platform is required');
  }

  if (!message.platformMessageId) {
    throw new Error('saveIncomingMessage: platformMessageId is required');
  }

  return insertChatMessage(message);
}

async function saveOutgoingMessage(payload) {
  const message = buildStoredMessage({
    ...payload,
    direction: 'outgoing',
  });

  if (!message.chatId) {
    throw new Error('saveOutgoingMessage: chatId is required');
  }

  if (!message.platform) {
    throw new Error('saveOutgoingMessage: platform is required');
  }

  if (!message.platformMessageId) {
    throw new Error('saveOutgoingMessage: platformMessageId is required');
  }

  return insertChatMessage(message);
}

module.exports = {
  saveIncomingMessage,
  saveOutgoingMessage,
};