// src/bot/dispatchers/dispatchSourcesCommands.js
// ============================================================================
// SOURCES COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - updated wiring for mature Sources Layer handlers
// ============================================================================

import { handleSourcesList } from "../handlers/sourcesList.js";
import { handleSourcesDiag } from "../handlers/sources_diag.js";
import { handleSource } from "../handlers/source.js";
import { handleDiagSource } from "../handlers/diagSource.js";
import { handleTestSource } from "../handlers/testSource.js";

export async function dispatchSourcesCommands({ cmd0, ctx, reply }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/sources": {
      if (typeof ctx.getAllSourcesSafe !== "function") {
        await reply("⛔ getAllSourcesSafe недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      await handleSourcesList({
        bot,
        chatId,
        listSources: ctx.getAllSourcesSafe,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });

      return { handled: true };
    }

    case "/sources_diag": {
      if (typeof ctx.runSourceDiagnosticsOnce !== "function") {
        await reply("⛔ runSourceDiagnosticsOnce недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      await handleSourcesDiag({
        bot,
        chatId,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
        runSourceDiagnosticsOnce: ctx.runSourceDiagnosticsOnce,
      });
      return { handled: true };
    }

    case "/source": {
      if (typeof ctx.fetchFromSourceKey !== "function") {
        await reply("⛔ fetchFromSourceKey недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      await handleSource({
        bot,
        chatId,
        rest: ctx.rest,
        fetchFromSourceKey: ctx.fetchFromSourceKey,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/diag_source": {
      if (typeof ctx.diagnoseSource !== "function") {
        await reply("⛔ diagnoseSource недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      await handleDiagSource({
        bot,
        chatId,
        rest: ctx.rest,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
        diagnoseSource: ctx.diagnoseSource,
      });
      return { handled: true };
    }

    case "/test_source": {
      if (typeof ctx.testSource !== "function") {
        await reply("⛔ testSource недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      await handleTestSource({
        bot,
        chatId,
        rest: ctx.rest,
        testSource: ctx.testSource,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchSourcesCommands,
};
