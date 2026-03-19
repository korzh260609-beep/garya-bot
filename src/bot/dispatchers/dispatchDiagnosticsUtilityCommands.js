// src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleLastErrors } from "../handlers/lastErrors.js";
import { handleTaskStatus } from "../handlers/taskStatus.js";
import { handleFileLogs } from "../handlers/fileLogs.js";

export async function dispatchDiagnosticsUtilityCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/last_errors": {
      await handleLastErrors({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/task_status": {
      await handleTaskStatus({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/file_logs": {
      await handleFileLogs({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}