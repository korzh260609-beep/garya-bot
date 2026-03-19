// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handleChatMetaDebug } from "./handlers/chatMetaDebug.js";
import { handleWebhookInfo } from "./handlers/webhookInfo.js";
import { handleProjectStatus } from "./handlers/projectStatus.js";
import { handlePrices } from "./handlers/prices.js";
import { handlePrice } from "./handlers/price.js";
import { handleProfile } from "./handlers/profile.js";
import { handleMode } from "./handlers/mode.js";
import { handleHealth } from "./handlers/health.js"; // Stage 5 — skeleton
import { handleDecisionDiag } from "./handlers/decisionDiag.js";
import { handleDecisionDiagLast } from "./handlers/decisionDiagLast.js";
import { handleDecisionDiagStats } from "./handlers/decisionDiagStats.js";
import { handleDecisionDiagDbStats } from "./handlers/decisionDiagDbStats.js";
import { handleDecisionDiagLastDb } from "./handlers/decisionDiagLastDb.js";
import { handleDecisionDiagWindow } from "./handlers/decisionDiagWindow.js";
import { handleDecisionPromotionDiag } from "./handlers/decisionPromotionDiag.js";
import { handleLastErrors } from "./handlers/lastErrors.js"; // Stage 5.6 — read-only
import { handleTaskStatus } from "./handlers/taskStatus.js";
import { handleArList } from "./handlers/arList.js";
import { handleFileLogs } from "./handlers/fileLogs.js";

// ✅ Stage 5.16 — behavior events verification
import { handleBehaviorEventsLast } from "./handlers/behaviorEventsLast.js";
// ✅ Stage 5.16 — behavior events test emitter (DEV)
import { handleBeEmit } from "./handlers/beEmit.js";

// ✅ STAGE 7 — Memory diagnostics (enforced pipeline)
import { MemoryDiagnosticsService } from "../core/MemoryDiagnosticsService.js";

// ✅ /build_info (public env snapshot)
import { getPublicEnvSnapshot } from "../core/config.js";

// ✅ CRYPTO DEV dispatcher (extracted 1:1 block)
import { dispatchCryptoDevCommands } from "./dispatchers/dispatchCryptoDevCommands.js";

// ✅ SOURCES dispatcher (extracted 1:1 block)
import { dispatchSourcesCommands } from "./dispatchers/dispatchSourcesCommands.js";

// ✅ PROJECT MEMORY dispatcher (extracted 1:1 block)
import { dispatchProjectMemoryCommands } from "./dispatchers/dispatchProjectMemoryCommands.js";

// ✅ IDENTITY / LINK dispatcher (extracted 1:1 block)
import { dispatchIdentityCommands } from "./dispatchers/dispatchIdentityCommands.js";

// ✅ TASK dispatcher (extracted 1:1 block)
import { dispatchTaskCommands } from "./dispatchers/dispatchTaskCommands.js";

// ✅ RECALL dispatcher (extracted 1:1 block)
import { dispatchRecallCommands } from "./dispatchers/dispatchRecallCommands.js";

// ✅ Singleton service (safe: no side-effects)
const memoryDiagSvc = new MemoryDiagnosticsService();

/**
 * Backward-compatible dispatcher.
 *
 * Supports BOTH call styles:
 * 1) dispatchCommand(cmd, ctx)  // expected
 * 2) dispatchCommand(ctx)       // legacy / accidental call (prevents crash)
 */
export async function dispatchCommand(cmd, ctx) {
  if (ctx === undefined && cmd && typeof cmd === "object") {
    const ctxObj = cmd;

    let derivedCmd = ctxObj.cmd || ctxObj.command;

    const rawText =
      typeof ctxObj?.msg?.text === "string"
        ? ctxObj.msg.text
        : typeof ctxObj?.message?.text === "string"
          ? ctxObj.message.text
          : null;

    if (!derivedCmd && rawText) {
      derivedCmd = rawText.trim().split(/\s+/)[0];
    }

    if (ctxObj && (ctxObj.rest === undefined || ctxObj.rest === null) && rawText) {
      const parts = rawText.trim().split(/\s+/);
      ctxObj.rest = parts.slice(1).join(" ");
    }

    ctx = ctxObj;
    cmd = derivedCmd;
  }

  if (!ctx || typeof ctx !== "object") {
    return { handled: false, error: "CTX_MISSING" };
  }

  if (typeof cmd !== "string" || !cmd.startsWith("/")) {
    return { handled: false };
  }

  const { bot, chatId, chatIdStr, rest } = ctx;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => bot.sendMessage(chatId, String(text ?? ""));

  if (!bot || !chatId) {
    return { handled: false, error: "CTX_INVALID" };
  }

  const cmd0 = cmd.split("@")[0];

  const chatType =
    ctx?.chatType ||
    ctx?.identityCtx?.chat_type ||
    ctx?.identityCtx?.chatType ||
    null;

  const fromId = ctx?.senderIdStr ?? "";

  const effectiveChatIdStr = String(ctx?.chatIdStr ?? ctx?.chatId ?? chatId ?? "");
  const effectiveFromIdStr = String(fromId ?? "");

  const isPrivate =
    ctx?.isPrivateChat === true ||
    ctx?.identityCtx?.isPrivateChat === true ||
    chatType === "private" ||
    (effectiveChatIdStr && effectiveFromIdStr && effectiveChatIdStr === effectiveFromIdStr);

  const PRIVATE_ONLY_COMMANDS = new Set([
    "/build_info",
    "/chat_meta_debug",
    "/webhook_info",
    "/identity_diag",
    "/identity_backfill",
    "/identity_upgrade_legacy",
    "/identity_orphans",
    "/identity_legacy_tg",

    "/chat_on",
    "/chat_off",
    "/chat_status",

    "/group_source_on",
    "/group_source_off",
    "/group_sources",
    "/my_seen_chats",
    "/group_source_meta",
    "/group_source_topic_diag",

    "/grant",
    "/revoke",
    "/grants",

    "/behavior_events_last",
    "/be_emit",

    "/ta_debug",
    "/ta_debug_full",
    "/ta_snapshot",
    "/ta_snapshot_full",
    "/ta_core",
    "/ta_core_full",

    "/news_rss",
    "/news_rss_full",

    "/multi_monitor",
    "/multi_monitor_full",

    "/crypto_diag",
    "/crypto_diag_full",

    "/cg_vfuse",
    "/cg_vfuse_full",

    "/bn_ticker",
    "/bn_ticker_full",

    "/okx_ticker",
    "/okx_ticker_full",

    "/memory_status",
    "/memory_diag",
    "/memory_integrity",
    "/memory_backfill",
    "/memory_user_chats",
    "/diag_decision",
    "/diag_decision_last",
    "/diag_decision_stats",
    "/diag_decision_db_stats",
    "/diag_decision_last_db",
    "/diag_decision_window",
    "/diag_decision_promotion",

    "/pm_set",
    "/pm_list",
  ]);

  if (!isPrivate && PRIVATE_ONLY_COMMANDS.has(cmd0)) {
    await reply(
      [
        "⛔ DEV only.",
        `cmd=${cmd0}`,
        `chatType=${chatType || "unknown"}`,
        `private=${String(isPrivate)}`,
        `monarch=${String(!!ctx?.bypass)}`,
        `from=${String(fromId)}`,
      ].join("\n"),
      { cmd: cmd0, handler: "commandDispatcher", event: "private_only_gate" }
    );

    return { handled: true };
  }

  const cryptoHandled = await dispatchCryptoDevCommands({
    cmd0,
    ctx,
    reply,
  });

  if (cryptoHandled?.handled) {
    return cryptoHandled;
  }

  const sourcesHandled = await dispatchSourcesCommands({
    cmd0,
    ctx,
    reply,
  });

  if (sourcesHandled?.handled) {
    return sourcesHandled;
  }

  const projectMemoryHandled = await dispatchProjectMemoryCommands({
    cmd0,
    ctx,
    reply,
  });

  if (projectMemoryHandled?.handled) {
    return projectMemoryHandled;
  }

  const identityHandled = await dispatchIdentityCommands({
    cmd0,
    ctx,
    reply,
  });

  if (identityHandled?.handled) {
    return identityHandled;
  }

  const taskHandled = await dispatchTaskCommands({
    cmd0,
    ctx,
    reply,
  });

  if (taskHandled?.handled) {
    return taskHandled;
  }

  const recallHandled = await dispatchRecallCommands({
    cmd0,
    ctx,
    reply,
  });

  if (recallHandled?.handled) {
    return recallHandled;
  }

  switch (cmd0) {
    case "/profile":
    case "/me":
    case "/whoami": {
      await handleProfile({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
      });
      return { handled: true };
    }

    case "/mode": {
      await handleMode({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        getAnswerMode: ctx.getAnswerMode,
        setAnswerMode: ctx.setAnswerMode,
        globalUserId: ctx.user?.global_user_id ?? null,
      });
      return { handled: true };
    }

    case "/price": {
      return await handlePrice({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceById: ctx.getCoinGeckoSimplePriceById,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
    }

    case "/prices": {
      return await handlePrices({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceMulti: ctx.getCoinGeckoSimplePriceMulti,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
    }

    case "/ar_list": {
      await handleArList({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
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

    case "/memory_status": {
      const cols = await memoryDiagSvc.getChatMemoryV2Columns();
      await reply(
        [
          "🧪 MEMORY STATUS",
          `global_user_id: ${cols.global_user_id ? "true ✅" : "false ⛔"}`,
          `transport: ${cols.transport ? "true ✅" : "false ⛔"}`,
          `metadata: ${cols.metadata ? "true ✅" : "false ⛔"}`,
          `schema_version: ${cols.schema_version ? "true ✅" : "false ⛔"}`,
        ].join("\n"),
        { cmd: cmd0, handler: "commandDispatcher" }
      );
      return { handled: true };
    }

    case "/memory_diag": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryDiag({ chatIdStr, globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_integrity": {
      const text = await memoryDiagSvc.memoryIntegrity({ chatIdStr });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_backfill": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const limitStr = String(ctx?.rest || "").trim();
      const limit = limitStr ? Number(limitStr) : 200;
      const text = await memoryDiagSvc.memoryBackfill({ chatIdStr, globalUserId, limit });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_user_chats": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryUserChats({ globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/health": {
      await handleHealth({ bot, chatId });
      return { handled: true };
    }

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

    case "/chat_meta_debug": {
      await handleChatMetaDebug({
        bot,
        chatId,
        chatIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/webhook_info": {
      await handleWebhookInfo({ bot, chatId });
      return { handled: true };
    }

    case "/last_errors": {
      await handleLastErrors({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/task_status": {
      await handleTaskStatus({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/behavior_events_last": {
      await handleBehaviorEventsLast({
        bot,
        chatId,
        rest: ctx.rest,
        senderIdStr: ctx.senderIdStr,
      });
      return { handled: true };
    }

    case "/be_emit": {
      await handleBeEmit({
        bot,
        chatId,
        rest: ctx.rest,
        senderIdStr: ctx.senderIdStr,
        chatIdStr,
        transport: ctx?.identityCtx?.transport || "telegram",
        globalUserId: ctx?.user?.global_user_id ?? null,
        bypass: !!ctx.bypass,
      });
      return { handled: true };
    }

    case "/project_status": {
      await handleProjectStatus({ bot, chatId });
      return { handled: true };
    }

    case "/build_info": {
      const pub = getPublicEnvSnapshot();

      const commit =
        String(pub.RENDER_GIT_COMMIT || "").trim() ||
        String(pub.GIT_COMMIT || "").trim() ||
        "unknown";

      const serviceId = String(pub.RENDER_SERVICE_ID || "").trim() || "unknown";

      const instanceId =
        String(pub.RENDER_INSTANCE_ID || "").trim() ||
        String(pub.HOSTNAME || "").trim() ||
        "unknown";

      const nodeEnv = String(pub.NODE_ENV || "").trim() || "unknown";

      await reply(
        ["🧩 BUILD INFO", `commit: ${commit}`, `service: ${serviceId}`, `instance: ${instanceId}`, `node_env: ${nodeEnv}`].join(
          "\n"
        ),
        { cmd: cmd0, handler: "commandDispatcher" }
      );

      return { handled: true };
    }

    case "/help": {
      if (typeof ctx.handleHelpLegacy !== "function") return { handled: false };
      await ctx.handleHelpLegacy();
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}