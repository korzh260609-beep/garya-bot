// src/bot/router/utilityStatusCommands.js

export async function handleUtilityStatusEarlyCommands({
  cmdBase,
  handleBuildInfoCommand,
  ctxReply,
  getPublicEnvSnapshot,
  upsertProjectSection,
}) {
  if (cmdBase === "/build_info") {
    await handleBuildInfoCommand({
      ctxReply,
      getPublicEnvSnapshot,
      upsertProjectSection,
      cmdBase,
    });
    return true;
  }

  return false;
}

export async function handleUtilityStatusLateCommands({
  cmdBase,
  handleCodeOutputStatusCommand,
  handleWorkflowCheckCommand,
  handleWorkflowCheck,
  ctxReply,
  getCodeOutputMode,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  if (cmdBase === "/code_output_status") {
    await handleCodeOutputStatusCommand({
      ctxReply,
      getCodeOutputMode,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/workflow_check") {
    await handleWorkflowCheckCommand({
      handleWorkflowCheck,
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  return false;
}