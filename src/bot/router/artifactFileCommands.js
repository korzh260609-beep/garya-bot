// src/bot/router/artifactFileCommands.js

export async function handleArtifactFileCommands({
  cmdBase,
  handleArList,
  handleFileLogs,
  bot,
  chatId,
  chatIdStr,
  rest,
}) {
  if (cmdBase === "/ar_list") {
    await handleArList({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/file_logs") {
    await handleFileLogs({
      bot,
      chatId,
      chatIdStr,
      rest,
    });
    return true;
  }

  return false;
}