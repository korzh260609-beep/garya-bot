// src/bot/router/artifactFileCommands.js

import { handleFileLogs } from "../handlers/fileLogs.js";
import { handleArList } from "../handlers/arList.js";

export async function handleArtifactFileCommands({
  cmdBase,
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