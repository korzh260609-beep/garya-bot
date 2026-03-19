// src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.
// TEMP TRACE:
// - logs entry into dispatcher
// - logs selected command
// - logs before and after handler
// - logs thrown error and rethrows it

import { handleDecisionDiag } from "../handlers/decisionDiag.js";
import { handleDecisionDiagLast } from "../handlers/decisionDiagLast.js";
import { handleDecisionDiagStats } from "../handlers/decisionDiagStats.js";
import { handleDecisionDiagDbStats } from "../handlers/decisionDiagDbStats.js";
import { handleDecisionDiagLastDb } from "../handlers/decisionDiagLastDb.js";
import { handleDecisionDiagWindow } from "../handlers/decisionDiagWindow.js";
import { handleDecisionPromotionDiag } from "../handlers/decisionPromotionDiag.js";

export async function dispatchDecisionDiagnosticsCommands({ cmd0, ctx, reply }) {
  const { bot, chatId } = ctx;

  console.log("[TRACE][decision-dispatcher] enter", {
    cmd0,
    chatId: String(chatId ?? ""),
    chatIdStr: String(ctx?.chatIdStr ?? ""),
    senderIdStr: String(ctx?.senderIdStr ?? ""),
    hasReply: typeof reply === "function",
    hasBot: !!bot,
    rest: String(ctx?.rest ?? ""),
  });

  try {
    switch (cmd0) {
      case "/diag_decision": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision", {
          rest: String(ctx?.rest ?? ""),
        });

        await handleDecisionDiag({
          bot,
          chatId,
          reply,
          rest: ctx.rest,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision");
        return { handled: true };
      }

      case "/diag_decision_last": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_last");

        await handleDecisionDiagLast({
          bot,
          chatId,
          reply,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_last");
        return { handled: true };
      }

      case "/diag_decision_stats": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_stats");

        await handleDecisionDiagStats({
          bot,
          chatId,
          reply,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_stats");
        return { handled: true };
      }

      case "/diag_decision_db_stats": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_db_stats");

        await handleDecisionDiagDbStats({
          bot,
          chatId,
          reply,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_db_stats");
        return { handled: true };
      }

      case "/diag_decision_last_db": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_last_db");

        await handleDecisionDiagLastDb({
          bot,
          chatId,
          reply,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_last_db");
        return { handled: true };
      }

      case "/diag_decision_window": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_window", {
          rest: String(ctx?.rest ?? ""),
        });

        await handleDecisionDiagWindow({
          bot,
          chatId,
          reply,
          rest: ctx.rest,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_window");
        return { handled: true };
      }

      case "/diag_decision_promotion": {
        console.log("[TRACE][decision-dispatcher] before /diag_decision_promotion");

        await handleDecisionPromotionDiag({
          bot,
          chatId,
          reply,
        });

        console.log("[TRACE][decision-dispatcher] after /diag_decision_promotion");
        return { handled: true };
      }

      default:
        console.log("[TRACE][decision-dispatcher] miss", { cmd0 });
        return { handled: false };
    }
  } catch (error) {
    console.error("[TRACE][decision-dispatcher] error", {
      cmd0,
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    throw error;
  }
}