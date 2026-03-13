// src/bot/router/repoAnalyzeCommand.js

export async function handleRepoAnalyzeCommand({
  handleRepoAnalyze,
  bot,
  chatId,
  rest,
}) {
  await handleRepoAnalyze({
    bot,
    chatId,
    rest,
  });
}