// src/bot/router/repoDiffCommand.js

export async function handleRepoDiffCommand({
  handleRepoDiff,
  bot,
  chatId,
  rest,
}) {
  await handleRepoDiff({
    bot,
    chatId,
    rest,
  });
}