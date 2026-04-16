// ============================================================================
// === src/bot/handlers/stageCheck.js — Telegram transport adapter only
// ============================================================================

import { requireMonarchPrivateAccess } from "./handlerAccess.js";

import { runStageCheckCore } from "../../core/stageCheck/stageCheckCore.js";
import {
  WORKFLOW_PATH,
  RULES_PATH,
  detectLanguageFromContext,
  parseMode,
  createTranslator,
  formatSingleItemOutput,
  formatAllStagesOutput,
  formatCurrentOutput,
  formatDiagOutput,
} from "./stage-check/formatters.js";

export async function handleStageCheck(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => ctx.bot.sendMessage(ctx.chatId, String(text ?? ""));

  const lang = detectLanguageFromContext(ctx);
  const { t, humanStatus } = createTranslator({
    lang,
    workflowPath: WORKFLOW_PATH,
    rulesPath: RULES_PATH,
  });

  const modeInfo = parseMode(ctx.rest);
  const result = await runStageCheckCore({ modeInfo });

  if (!result?.ok) {
    if (result?.errorCode === "cannot_read_workflow") {
      await reply(t("cannot_read_workflow"));
      return;
    }

    if (result?.errorCode === "cannot_read_rules") {
      await reply(t("cannot_read_rules"));
      return;
    }

    if (result?.errorCode === "invalid_rules") {
      await reply(t("invalid_rules"));
      return;
    }

    if (result?.errorCode === "item_not_found") {
      await reply(
        `${t("header_single", { code: result.itemCode })}\n${t("status")}: ${t("item_not_found")}`
      );
      return;
    }

    await reply(t("runtime_failed"));
    return;
  }

  if (result.kind === "diag") {
    await reply(
      formatDiagOutput({
        modeInfo: result.modeInfo,
        source: result.source,
        repoFiles: result.repoFiles,
        searchableFiles: result.searchableFiles,
        workflowItems: result.workflowItems,
        topLevelStages: result.topLevelStages,
        evaluationCtx: result.evaluationCtx,
        targetItem: result.targetItem,
        itemDiag: result.itemDiag,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_diag",
      }
    );
    return;
  }

  if (result.kind === "all") {
    await reply(
      formatAllStagesOutput({
        topLevelItems: result.topLevelStages,
        evaluatedItems: result.evaluatedItems,
        t,
        humanStatus,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_all",
      }
    );
    return;
  }

  if (result.kind === "current") {
    await reply(
      formatCurrentOutput({
        topLevelItems: result.topLevelStages,
        evaluatedItems: result.evaluatedItems,
        t,
        humanStatus,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_current",
      }
    );
    return;
  }

  await reply(
    formatSingleItemOutput({
      baseItem: result.baseItem,
      scopeItems: result.scopeItems,
      aggregate: result.aggregate,
      t,
      humanStatus,
    }),
    {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_single",
    }
  );
}

export default handleStageCheck;