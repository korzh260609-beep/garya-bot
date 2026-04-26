// src/bot/dispatchers/dispatchProjectMemorySessionCommands.js
// ============================================================================
// PROJECT MEMORY SESSION COMMANDS DISPATCHER
// Purpose:
// - isolate Project Memory work-session command routing
// - keep Telegram transport thin
// - keep business logic inside handlers/services, not dispatcher
// - preserve existing behavior 1:1
// ============================================================================

import { handlePmSession } from "../handlers/pmSession.js";
import { handlePmSessionUpdate } from "../handlers/pmSessionUpdate.js";
import {
  handlePmSessions,
  handlePmSessionShow,
} from "../handlers/pmSessions.js";

export async function dispatchProjectMemorySessionCommands({
  cmd0,
  ctx,
  reply,
}) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/pm_session": {
      if (typeof ctx.recordProjectWorkSession !== "function") {
        await reply("⛔ recordProjectWorkSession недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmSession({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        recordProjectWorkSession: ctx.recordProjectWorkSession,
      });

      return { handled: true };
    }

    case "/pm_session_update": {
      if (typeof ctx.updateProjectWorkSession !== "function") {
        await reply("⛔ updateProjectWorkSession недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmSessionUpdate({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        updateProjectWorkSession: ctx.updateProjectWorkSession,
      });

      return { handled: true };
    }

    case "/pm_sessions": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmSessions({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_session_show": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmSessionShow({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchProjectMemorySessionCommands,
};