// src/bot/dispatchers/dispatchProjectMemoryCommands.js
// ============================================================================
// PROJECT MEMORY COMMANDS DISPATCHER
// Purpose:
// - route Project Memory command groups
// - keep Telegram transport thin
// - keep business logic inside handlers/services, not dispatcher
// - confirmed commands are delegated to dedicated confirmed dispatcher
// - session commands are delegated to dedicated session dispatcher
// ============================================================================

import { handlePmSet } from "../handlers/pmSet.js";
import { handlePmShow } from "../handlers/pmShow.js";
import { handlePmList } from "../handlers/pmList.js";
import { handlePmDigest } from "../handlers/pmDigest.js";
import { handlePmLatest } from "../handlers/pmLatest.js";
import { handlePmFind } from "../handlers/pmFind.js";

import { dispatchProjectMemoryConfirmedCommands } from "./dispatchProjectMemoryConfirmedCommands.js";
import { dispatchProjectMemorySessionCommands } from "./dispatchProjectMemorySessionCommands.js";

export async function dispatchProjectMemoryCommands({ cmd0, ctx, reply }) {
  const { bot, chatId, chatIdStr } = ctx;

  const confirmedHandled = await dispatchProjectMemoryConfirmedCommands({
    cmd0,
    ctx,
    reply,
  });

  if (confirmedHandled?.handled) {
    return confirmedHandled;
  }

  const sessionHandled = await dispatchProjectMemorySessionCommands({
    cmd0,
    ctx,
    reply,
  });

  if (sessionHandled?.handled) {
    return sessionHandled;
  }

  switch (cmd0) {
    case "/pm_show": {
      if (typeof ctx.getProjectSection !== "function") {
        await reply("⛔ getProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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
        await reply("⛔ upsertProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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

    case "/pm_latest": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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

    default:
      return { handled: false };
  }
}

export default {
  dispatchProjectMemoryCommands,
};