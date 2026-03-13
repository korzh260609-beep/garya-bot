// src/bot/router/runTaskCmdCommand.js

export async function handleRunTaskCmdCommand({
  handleRunTaskCmd,
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
}) {
  await handleRunTaskCmd({
    bot,
    chatId,
    chatIdStr,
    rest,
    access,
    callWithFallback,
  });
}