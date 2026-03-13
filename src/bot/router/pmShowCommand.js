// src/bot/router/pmShowCommand.js

export async function handlePmShowCommand({
  handlePmShow,
  bot,
  chatId,
  rest,
  getProjectSection,
}) {
  await handlePmShow({
    bot,
    chatId,
    rest,
    getProjectSection,
  });
}