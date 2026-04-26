// src/bot/dispatchers/dispatchProjectMemoryConfirmedCommands.js
// ============================================================================
// PROJECT MEMORY CONFIRMED COMMANDS DISPATCHER
// Purpose:
// - isolate confirmed Project Memory command routing
// - keep Telegram transport thin
// - keep core/service logic outside transport layer
// - preserve existing behavior 1:1
// - expose Stage 7A.12 short test-surface aliases without duplicating logic
// ============================================================================

import { handlePmConfirmedWrite } from "../handlers/pmConfirmedWrite.js";
import { handlePmConfirmedUpdate } from "../handlers/pmConfirmedUpdate.js";
import {
  handlePmConfirmedList,
  handlePmConfirmedLatest,
  handlePmConfirmedDigest,
} from "../handlers/pmConfirmedRead.js";
import { handlePmConfirmedContext } from "../handlers/pmConfirmedContext.js";
import { handlePmConfirmedScopeDebug } from "../handlers/pmConfirmedScopeDebug.js";

export async function dispatchProjectMemoryConfirmedCommands({
  cmd0,
  ctx,
  reply,
}) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/pm_confirmed_write": {
      if (typeof ctx.writeConfirmedProjectMemory !== "function") {
        await reply("⛔ writeConfirmedProjectMemory недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmConfirmedWrite({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        writeConfirmedProjectMemory: ctx.writeConfirmedProjectMemory,
      });

      return { handled: true };
    }

    case "/pm_confirmed_update":
    case "/pm_update": {
      if (typeof ctx.updateConfirmedProjectMemoryEntry !== "function") {
        await reply("⛔ updateConfirmedProjectMemoryEntry недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmConfirmedUpdate({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        updateConfirmedProjectMemoryEntry: ctx.updateConfirmedProjectMemoryEntry,
      });

      return { handled: true };
    }

    case "/pm_confirmed_list": {
      if (typeof ctx.listConfirmedProjectMemoryEntries !== "function") {
        await reply("⛔ listConfirmedProjectMemoryEntries недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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

    case "/pm_confirmed_latest":
    case "/pm_last": {
      if (typeof ctx.getLatestConfirmedProjectMemoryEntry !== "function") {
        await reply("⛔ getLatestConfirmedProjectMemoryEntry недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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
        await reply("⛔ buildConfirmedProjectMemoryDigest недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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

    case "/pm_confirmed_context":
    case "/pm_context": {
      if (typeof ctx.buildConfirmedProjectMemoryContext !== "function") {
        await reply("⛔ buildConfirmedProjectMemoryContext недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
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

    case "/pm_confirmed_scope_debug": {
      if (typeof ctx.listConfirmedProjectMemoryEntries !== "function") {
        await reply("⛔ listConfirmedProjectMemoryEntries недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmConfirmedScopeDebug({
        bot,
        chatId,
        rest: ctx.rest,
        listConfirmedProjectMemoryEntries: ctx.listConfirmedProjectMemoryEntries,
      });

      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchProjectMemoryConfirmedCommands,
};