// src/bot/router/testSourceCommand.js

export async function handleTestSourceCommand({
  handleTestSource,
  bot,
  chatId,
  chatIdStr,
  rest,
  testSource,
}) {
  await handleTestSource({
    bot,
    chatId,
    chatIdStr,
    rest,
    testSource,
  });
}