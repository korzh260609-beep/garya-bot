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
import { handlePmSessionUpdate } from "../handlers/pmSessionUpdate.js";
import { handlePmConfirmedWrite } from "../handlers/pmConfirmedWrite.js";
import { handlePmConfirmedUpdate } from "../handlers/pmConfirmedUpdate.js";
import {
  handlePmConfirmedList,
  handlePmConfirmedLatest,
  handlePmConfirmedDigest,
} from "../handlers/pmConfirmedRead.js";
import { handlePmConfirmedContext } from "../handlers/pmConfirmedContext.js";
import { handlePmDigest } from "../handlers/pmDigest.js";
import { handlePmLatest } from "../handlers/pmLatest.js";
import { handlePmFind } from "../handlers/pmFind.js";
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

    case "/pm_session_update": {
      if (typeof ctx.updateProjectWorkSession !== "function") {
        await reply("⛔ updateProjectWorkSession недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmSessionUpdate({
        bot,
        chatId,
        rest: ctx.rest,
        updateProjectWorkSession: ctx.updateProjectWorkSession,
      });

      return { handled: true };
    }

    case "/pm_confirmed_write": {
      if (typeof ctx.writeConfirmedProjectMemory !== "function") {
        await reply("⛔ writeConfirmedProjectMemory недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedWrite({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        writeConfirmedProjectMemory: ctx.writeConfirmedProjectMemory,
      });

      return { handled: true };
    }

    case "/pm_confirmed_update": {
      if (typeof ctx.updateConfirmedProjectMemoryEntry !== "function") {
        await reply("⛔ updateConfirmedProjectMemoryEntry недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedUpdate({
        bot,
        chatId,
        rest: ctx.rest,
        updateConfirmedProjectMemoryEntry: ctx.updateConfirmedProjectMemoryEntry,
      });

      return { handled: true };
    }

    case "/pm_confirmed_list": {
      if (typeof ctx.listConfirmedProjectMemoryEntries !== "function") {
        await reply("⛔ listConfirmedProjectMemoryEntries недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedList({
        bot,
        chatId,
        rest: ctx.rest,
        listConfirmedProjectMemoryEntries: ctx.listConfirmedProjectMemoryEntries,
      });

      return { handled: true };
    }

    case "/pm_confirmed_latest": {
      if (typeof ctx.getLatestConfirmedProjectMemoryEntry !== "function") {
        await reply("⛔ getLatestConfirmedProjectMemoryEntry недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedLatest({
        bot,
        chatId,
        rest: ctx.rest,
        getLatestConfirmedProjectMemoryEntry: ctx.getLatestConfirmedProjectMemoryEntry,
      });

      return { handled: true };
    }

    case "/pm_confirmed_digest": {
      if (typeof ctx.buildConfirmedProjectMemoryDigest !== "function") {
        await reply("⛔ buildConfirmedProjectMemoryDigest недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedDigest({
        bot,
        chatId,
        rest: ctx.rest,
        buildConfirmedProjectMemoryDigest: ctx.buildConfirmedProjectMemoryDigest,
      });

      return { handled: true };
    }

    case "/pm_confirmed_context": {
      if (typeof ctx.buildConfirmedProjectMemoryContext !== "function") {
        await reply("⛔ buildConfirmedProjectMemoryContext недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmConfirmedContext({
        bot,
        chatId,
        rest: ctx.rest,
        buildConfirmedProjectMemoryContext: ctx.buildConfirmedProjectMemoryContext,
      });

      return { handled: true };
    }

    case "/pm_latest": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmLatest({
        bot,
        chatId,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_digest": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmDigest({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_find": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", { cmd: cmd0 });
        return { handled: true };
      }

      await handlePmFind({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
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