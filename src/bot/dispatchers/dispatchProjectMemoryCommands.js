// src/bot/dispatchers/dispatchProjectMemoryCommands.js
// ============================================================================
// PROJECT MEMORY COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// - ONLY routing isolation
// ============================================================================

import { handlePmSet } from "../handlers/pmSet.js";
import { handlePmShow } from "../handlers/pmShow.js";
import { handlePmList } from "../handlers/pmList.js";
import { handlePmSession } from "../handlers/pmSession.js";
import {
  handlePmSessions,
  handlePmSessionShow,
} from "../handlers/pmSessions.js";

export async function dispatchProjectMemoryCommands({ cmd0, ctx, reply }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/pm_show": {
      if (typeof ctx.getProjectSection !== "function") {
        await reply("⛔ getProjectSection недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmShow({
        bot,
        chatId,
        rest: ctx.rest,
        getProjectSection: ctx.getProjectSection,
      });

      return { handled: true };
    }

    case "/pm_set": {
      if (typeof ctx.upsertProjectSection !== "function") {
        await reply("⛔ upsertProjectSection недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmSet({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        upsertProjectSection: ctx.upsertProjectSection,
      });

      return { handled: true };
    }

    case "/pm_list": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmList({
        bot,
        chatId,
        rest: ctx.rest,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_session": {
      if (typeof ctx.recordProjectWorkSession !== "function") {
        await reply("⛔ recordProjectWorkSession недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmSession({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        recordProjectWorkSession: ctx.recordProjectWorkSession,
      });

      return { handled: true };
    }

    case "/pm_sessions": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
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
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
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
  dispatchProjectMemoryCommands,
};