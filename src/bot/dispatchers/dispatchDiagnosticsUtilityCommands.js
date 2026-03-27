// src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleLastErrors } from "../handlers/lastErrors.js";
import { handleTaskStatus } from "../handlers/taskStatus.js";
import { handleFileLogs } from "../handlers/fileLogs.js";
import { handleRenderDiag } from "../handlers/renderDiag.js";
import { handleRenderLogSet } from "../handlers/renderLogSet.js";
import { handleRenderDiagLast } from "../handlers/renderDiagLast.js";
import { handleRenderLogShow } from "../handlers/renderLogShow.js";
import { handleRenderErrorsLast } from "../handlers/renderErrorsLast.js";
import { handleRenderDeploysLast } from "../handlers/renderDeploysLast.js";

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

    case "/render_diag": {
      await handleRenderDiag({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
        msg: ctx.msg,
      });
      return { handled: true };
    }

    case "/render_log_set": {
      await handleRenderLogSet({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        msg: ctx.msg,
      });
      return { handled: true };
    }

    case "/render_diag_last": {
      await handleRenderDiagLast({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_log_show": {
      await handleRenderLogShow({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_errors_last": {
      await handleRenderErrorsLast({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_deploys_last": {
      await handleRenderDeploysLast({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
