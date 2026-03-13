// src/bot/router/denyCommand.js

export async function handleDenyCommand({ handleDeny, bot, chatId, rest }) {
  await handleDeny({ bot, chatId, rest });
}