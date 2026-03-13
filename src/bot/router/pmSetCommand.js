// src/bot/router/pmSetCommand.js

export async function handlePmSetCommand({
  handlePmSet,
  bot,
  chatId,
  chatIdStr,
  rest,
  upsertProjectSection,
}) {
  await handlePmSet({
    bot,
    chatId,
    chatIdStr,
    rest,
    upsertProjectSection,
    bypass: true,
  });
}