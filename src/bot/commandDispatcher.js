// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handleArList } from "./handlers/arList.js";
import { handleRepoStatus } from "./handlers/repoStatus.js";
import { handleWorkflowCheck } from "./handlers/workflowCheck.js";
import { handleReindexRepo } from "./handlers/reindexRepo.js";
import { handleRepoTree } from "./handlers/repoTree.js";
import { handleRepoFile } from "./handlers/repoFile.js";
import { handleRepoAnalyze } from "./handlers/repoAnalyze.js";
import { handleRepoSearch } from "./handlers/repoSearch.js";
import { handleCodeOutputStatus } from "./handlers/codeOutputStatus.js";

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

// ✅ MEMORY DIAGNOSTICS dispatcher (extracted 1:1 block)
import { dispatchMemoryDiagnosticsCommands } from "./dispatchers/dispatchMemoryDiagnosticsCommands.js";

// ✅ DECISION DIAGNOSTICS dispatcher (extracted 1:1 block)
import { dispatchDecisionDiagnosticsCommands } from "./dispatchers/dispatchDecisionDiagnosticsCommands.js";

// ✅ PROFILE / MODE dispatcher (extracted 1:1 block)
import { dispatchProfileModeCommands } from "./dispatchers/dispatchProfileModeCommands.js";

// ✅ SYSTEM INFO dispatcher (extracted 1:1 block)
import { dispatchSystemInfoCommands } from "./dispatchers/dispatchSystemInfoCommands.js";

// ✅ DIAGNOSTICS / UTILITY dispatcher (extracted 1:1 block)
import { dispatchDiagnosticsUtilityCommands } from "./dispatchers/dispatchDiagnosticsUtilityCommands.js";

// ✅ RENDER BRIDGE dispatcher
import { dispatchRenderBridgeCommands } from "./dispatchers/dispatchRenderBridgeCommands.js";

// ✅ META DEBUG dispatcher (extracted 1:1 block)
import { dispatchMetaDebugCommands } from "./dispatchers/dispatchMetaDebugCommands.js";

// ✅ PRICE dispatcher (extracted 1:1 block)
import { dispatchPriceCommands } from "./dispatchers/dispatchPriceCommands.js";

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
      ctxObj.rest = rawText.trim().split(/\s+/).slice(1).join(" ");
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

  const { bot, chatId } = ctx;

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
    (effectiveChatIdStr &&
      effectiveFromIdStr &&
      effectiveChatIdStr === effectiveFromIdStr);

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
    "/okx_candles",
    "/okx_candles_full",
    "/okx_snapshot",
    "/okx_snapshot_full",
    "/okx_diag",
    "/okx_diag_full",

    "/file_intake_diag",
    "/file_intake_diag_full",

    "/vision_diag",

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

    "/render_diag",
    "/render_log_set",
    "/render_diag_last",
    "/render_log_show",
    "/render_errors_last",
    "/render_deploys_last",

    "/render_bridge_service",
    "/render_bridge_services",
    "/render_bridge_errors",
    "/render_bridge_logs",
    "/render_bridge_diagnose",
    "/render_bridge_deploys",
    "/render_bridge_deploy",
    "/render_bridge_diag",

    "/reindex",
    "/repo_status",
    "/repo_tree",
    "/repo_file",
    "/repo_analyze",
    "/repo_search",
    "/code_output_status",

    "/capabilities",
    "/capability",
    "/cap_diagram",
    "/cap_doc",
    "/cap_automation",
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

  const memoryDiagnosticsHandled = await dispatchMemoryDiagnosticsCommands({
    cmd0,
    ctx,
    reply,
  });

  if (memoryDiagnosticsHandled?.handled) {
    return memoryDiagnosticsHandled;
  }

  const decisionDiagnosticsHandled = await dispatchDecisionDiagnosticsCommands({
    cmd0,
    ctx,
    reply,
  });

  if (decisionDiagnosticsHandled?.handled) {
    return decisionDiagnosticsHandled;
  }

  const profileModeHandled = await dispatchProfileModeCommands({
    cmd0,
    ctx,
    reply,
  });

  if (profileModeHandled?.handled) {
    return profileModeHandled;
  }

  const systemInfoHandled = await dispatchSystemInfoCommands({
    cmd0,
    ctx,
    reply,
  });

  if (systemInfoHandled?.handled) {
    return systemInfoHandled;
  }

  const diagnosticsUtilityHandled = await dispatchDiagnosticsUtilityCommands({
    cmd0,
    ctx,
    reply,
  });

  if (diagnosticsUtilityHandled?.handled) {
    return diagnosticsUtilityHandled;
  }

  const renderBridgeHandled = await dispatchRenderBridgeCommands({
    cmd0,
    ctx,
    reply,
  });

  if (renderBridgeHandled?.handled) {
    return renderBridgeHandled;
  }

  const metaDebugHandled = await dispatchMetaDebugCommands({
    cmd0,
    ctx,
    reply,
  });

  if (metaDebugHandled?.handled) {
    return metaDebugHandled;
  }

  const priceHandled = await dispatchPriceCommands({
    cmd0,
    ctx,
    reply,
  });

  if (priceHandled?.handled) {
    return priceHandled;
  }

  switch (cmd0) {
    case "/reindex": {
      await handleReindexRepo({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/repo_status": {
      await handleRepoStatus({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/repo_tree": {
      await handleRepoTree({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/repo_file": {
      await handleRepoFile({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/repo_analyze": {
      await handleRepoAnalyze({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/repo_search": {
      await handleRepoSearch({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/code_output_status": {
      await handleCodeOutputStatus({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
    }

    case "/workflow_check": {
      await handleWorkflowCheck({
        bot,
        chatId,
        chatIdStr: ctx.chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply,
      });
      return { handled: true };
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

    case "/help": {
      if (typeof ctx.handleHelpLegacy !== "function") return { handled: false };
      await ctx.handleHelpLegacy();
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}