// src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleDecisionDiag } from "../handlers/decisionDiag.js";
import { handleDecisionDiagLast } from "../handlers/decisionDiagLast.js";
import { handleDecisionDiagStats } from "../handlers/decisionDiagStats.js";
import { handleDecisionDiagDbStats } from "../handlers/decisionDiagDbStats.js";
import { handleDecisionDiagLastDb } from "../handlers/decisionDiagLastDb.js";
import { handleDecisionDiagWindow } from "../handlers/decisionDiagWindow.js";
import { handleDecisionPromotionDiag } from "../handlers/decisionPromotionDiag.js";

export async function dispatchDecisionDiagnosticsCommands({ cmd0, ctx, reply }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/diag_decision": {
      await handleDecisionDiag({
        bot,
        chatId,
        reply,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    case "/diag_decision_last": {
      await handleDecisionDiagLast({
        bot,
        chatId,
        reply,
      });
      return { handled: true };
    }

    case "/diag_decision_stats": {
      await handleDecisionDiagStats({
        bot,
        chatId,
        reply,
      });
      return { handled: true };
    }

    case "/diag_decision_db_stats": {
      await handleDecisionDiagDbStats({
        bot,
        chatId,
        reply,
      });
      return { handled: true };
    }

    case "/diag_decision_last_db": {
      await handleDecisionDiagLastDb({
        bot,
        chatId,
        reply,
      });
      return { handled: true };
    }

    case "/diag_decision_window": {
      await handleDecisionDiagWindow({
        bot,
        chatId,
        reply,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    case "/diag_decision_promotion": {
      await handleDecisionPromotionDiag({
        bot,
        chatId,
        reply,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}