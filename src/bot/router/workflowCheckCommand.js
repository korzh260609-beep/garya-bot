// src/bot/router/workflowCheckCommand.js

export async function handleWorkflowCheckCommand({
  handleWorkflowCheck,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  await handleWorkflowCheck({
    bot,
    chatId,
    rest,
    senderIdStr,
  });
}