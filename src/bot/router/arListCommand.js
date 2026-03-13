// src/bot/router/arListCommand.js

export async function handleArListCommand({
  handleArList,
  bot,
  chatId,
  rest,
}) {
  await handleArList({
    bot,
    chatId,
    rest,
  });
}