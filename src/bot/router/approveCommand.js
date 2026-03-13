// src/bot/router/approveCommand.js

export async function handleApproveCommand({ handleApprove, bot, chatId, rest }) {
  await handleApprove({ bot, chatId, rest });
}