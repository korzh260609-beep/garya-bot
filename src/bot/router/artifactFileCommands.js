// src/bot/router/artifactFileCommands.js

export async function handleArtifactFileCommands({
  cmdBase,
  handleArListCommand,
  handleFileLogsCommand,
  handleArList,
  handleFileLogs,
  bot,
  chatId,
  chatIdStr,
  rest,
}) {
  if (cmdBase === "/ar_list") {
    await handleArListCommand({
      handleArList,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/file_logs") {
    await handleFileLogsCommand({
      handleFileLogs,
      bot,
      chatId,
      chatIdStr,
      rest,
    });
    return true;
  }

  return false;
}