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
import { handleLastErrors } from "./handlers/lastErrors.js"; // Stage 5.6 — read-only
import { handleTaskStatus } from "./handlers/taskStatus.js"; // Stage 5.7 — read-only
import { handleTasksList } from "./handlers/tasksList.js";
import { handleArList } from "./handlers/arList.js";
import { handleLinkStart } from "./handlers/linkStart.js";
import { handleLinkConfirm } from "./handlers/linkConfirm.js";
import { handleLinkStatus } from "./handlers/linkStatus.js";
import { handleRecall } from "./handlers/recall.js";
import { handleIdentityDiag } from "./handlers/identityDiag.js";
import { handleIdentityBackfill } from "./handlers/identityBackfill.js";
import pool from "../../db.js";

import { handleStopTasksType } from "./handlers/stopTasksType.js";
import { handleUsersStats } from "./handlers/usersStats.js";
import { handleStopAllTasks } from "./handlers/stopAllTasks.js"; // ✅ /stop_all_tasks

// ✅ STAGE 4.3 — Chat Gate admin handlers (monarch)
import { handleChatSetActive } from "./handlers/chatSetActive.js";
import { handleChatStatus } from "./handlers/chatStatus.js";

// ✅ Stage 5–6: manual /run must write task_runs via JobRunner
import { jobRunner } from "../jobs/jobRunnerInstance.js";
import { makeTaskRunKey } from "../jobs/jobRunner.js";

/**
 * Backward-compatible dispatcher.
 *
 * Supports BOTH call styles:
 * 1) dispatchCommand(cmd, ctx)  // expected
 * 2) dispatchCommand(ctx)       // legacy / accidental call (prevents crash)
 */
export async function dispatchCommand(cmd, ctx) {
  // ---- Normalize arguments (prevent "ctx is undefined" crash) ----
  // If called as dispatchCommand(ctxObj), then `cmd` is actually ctxObj and ctx is undefined.
  if (ctx === undefined && cmd && typeof cmd === "object") {
    const ctxObj = cmd;

    // Try to derive command string:
    // 1) ctx.cmd / ctx.command
    // 2) first token of msg.text
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

    // Ensure "rest" exists if we had raw text
    if (ctxObj && (ctxObj.rest === undefined || ctxObj.rest === null) && rawText) {
      const parts = rawText.trim().split(/\s+/);
      ctxObj.rest = parts.slice(1).join(" ");
    }

    ctx = ctxObj;
    cmd = derivedCmd;
  }

  // Guard: still no ctx -> nothing to do (but do NOT crash)
  if (!ctx || typeof ctx !== "object") {
    return { handled: false, error: "CTX_MISSING" };
  }

  // Guard: command must be a string
  if (typeof cmd !== "string" || !cmd.startsWith("/")) {
    return { handled: false };
  }

  const { bot, chatId, chatIdStr, rest } = ctx;

  // If critical fields missing, don't crash
  if (!bot || !chatId) {
    return { handled: false, error: "CTX_INVALID" };
  }

  // ✅ Telegram can send commands as "/cmd@BotName" (especially in groups).
  // Normalize so switch-cases match reliably.
  const cmd0 = cmd.split("@")[0];

  // ==========================
  // PRIVATE-ONLY GATE (Stage 7 policy hardening)
  // ==========================
  // NOTE: We intentionally block these commands in non-private chats
  // even for monarch, to avoid leaking sensitive debug/runtime info in groups.
  //
  // ✅ CHANGE: stop relying on ctx.msg / ctx.message here.
  // Router now passes: chatType, isPrivateChat, identityCtx, senderIdStr, chatIdStr.
  const chatType =
    ctx?.chatType ||
    ctx?.identityCtx?.chat_type ||
    ctx?.identityCtx?.chatType ||
    null;

  // Robust private detection:
  // 1) chatType === "private"
  // 2) Telegram private chat usually has chat.id === from.id (works even if chatType is missing)
  // 3) ctx.isPrivateChat (explicit) or identityCtx.isPrivateChat if provided by router
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

    // ✅ STAGE 4.3 — Chat Gate admin
    "/chat_on",
    "/chat_off",
    "/chat_status",
  ]);

  if (!isPrivate && PRIVATE_ONLY_COMMANDS.has(cmd0)) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ DEV only.",
        `cmd=${cmd0}`,
        `chatType=${chatType || "unknown"}`,
        `private=${String(isPrivate)}`,
        `monarch=${String(!!ctx?.bypass)}`,
        `from=${String(fromId)}`,
      ].join("\n")
    );

    return { handled: true };
  }

  switch (cmd0) {
    case "/profile":
    case "/me":
    case "/whoami": {
      // ✅ Stage 4: pass senderIdStr (msg.from.id) to enable identity-first profile lookup
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

    // ✅ STAGE 4.3 — Chat Gate admin
    case "/chat_on": {
      await handleChatSetActive({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        isActive: true,
      });
      return { handled: true };
    }

    case "/chat_off": {
      await handleChatSetActive({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        isActive: false,
      });
      return { handled: true };
    }

    case "/chat_status": {
      await handleChatStatus({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/users_stats": {
      await handleUsersStats({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/identity_diag": {
      await handleIdentityDiag({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/identity_backfill": {
      await handleIdentityBackfill({
        bot,
        chatId,
        bypass: ctx.bypass,
        rest: ctx.rest,
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

    case "/link_start": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkStart({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        provider,
      });
      return { handled: true };
    }

    case "/link_confirm": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkConfirm({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        provider,
      });
      return { handled: true };
    }

    case "/link_status": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkStatus({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        provider,
      });
      return { handled: true };
    }

    // ==========================
    // TASKS (Stage 2.x)
    // ==========================

    case "/tasks": {
      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user, // identity-first
      };

      await handleTasksList({
        bot,
        chatId,
        chatIdStr,
        getUserTasks: ctx.getUserTasks,
        access,
      });

      return { handled: true };
    }

    case "/newtask": {
      const raw = String(rest || "").trim();

      if (!raw) {
        await bot.sendMessage(
          chatId,
          [
            "Использование:",
            "- /newtask <title> | <note>  (manual, legacy)",
            '- /newtask price_monitor {"symbol":"BTCUSDT","interval_minutes":1,"threshold_percent":1}',
            "",
            "Примечание: price_monitor сейчас создаётся тестовым шаблоном (payload из JSON может игнорироваться).",
          ].join("\n")
        );
        return { handled: true };
      }

      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      // Legacy manual format: "title | note"
      if (raw.includes("|")) {
        const parts = raw.split("|").map((s) => s.trim());
        const title = parts[0] || "Новая задача";
        const note = parts.slice(1).join(" | ").trim() || "";

        if (typeof ctx.createManualTask !== "function") {
          await bot.sendMessage(chatId, "⛔ createManualTask недоступен (ошибка wiring).");
          return { handled: true };
        }

        try {
          const row = await ctx.createManualTask(chatIdStr, title, note, access);
          const id = row?.id ?? "?";
          await bot.sendMessage(chatId, `✅ Задача создана: #${id}\n${title}\nТип: manual`);
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
        }

        return { handled: true };
      }

      // New format: "<type> <json>"
      const firstSpace = raw.indexOf(" ");
      const type = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).trim();
      const jsonPart = (firstSpace === -1 ? "" : raw.slice(firstSpace + 1)).trim();

      if (type === "price_monitor") {
        if (typeof ctx.createTestPriceMonitorTask !== "function") {
          await bot.sendMessage(chatId, "⛔ createTestPriceMonitorTask недоступен (ошибка wiring).");
          return { handled: true };
        }

        // JSON пока парсим только для валидации/диагностики (может быть проигнорирован в createTestPriceMonitorTask)
        if (jsonPart) {
          try {
            JSON.parse(jsonPart);
          } catch (e) {
            await bot.sendMessage(
              chatId,
              '⛔ Неверный JSON. Пример: /newtask price_monitor {"symbol":"BTCUSDT","interval_minutes":1,"threshold_percent":1}'
            );
            return { handled: true };
          }
        }

        try {
          const id = await ctx.createTestPriceMonitorTask(chatIdStr, access);
          await bot.sendMessage(
            chatId,
            [
              `✅ Тест price_monitor создан!`,
              `ID: ${id}`,
              jsonPart ? "ℹ️ JSON принят, но сейчас может игнорироваться (тестовый шаблон)." : "",
            ]
              .filter(Boolean)
              .join("\n")
          );
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
        }

        return { handled: true };
      }

      // Fallback: treat as manual title without note
      if (typeof ctx.createManualTask !== "function") {
        await bot.sendMessage(chatId, "⛔ createManualTask недоступен (ошибка wiring).");
        return { handled: true };
      }

      try {
        const row = await ctx.createManualTask(chatIdStr, raw, "", access);
        const id = row?.id ?? "?";
        await bot.sendMessage(chatId, `✅ Задача создана: #${id}\n${raw}\nТип: manual`);
      } catch (e) {
        await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
      }

      return { handled: true };
    }

    case "/run": {
      const raw = String(rest || "").trim();
      const taskId = parseInt(raw, 10);

      if (!raw || Number.isNaN(taskId)) {
        await bot.sendMessage(chatId, "Использование: /run <id>");
        return { handled: true };
      }

      if (typeof ctx.getTaskById !== "function" || typeof ctx.runTaskWithAI !== "function") {
        await bot.sendMessage(chatId, "⛔ TaskEngine недоступен (ошибка wiring).");
        return { handled: true };
      }

      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      const task = await ctx.getTaskById(chatIdStr, taskId, access);

      if (!task) {
        await bot.sendMessage(chatId, `⛔ Задача #${taskId} не найдена`);
        return { handled: true };
      }

      const runKey = makeTaskRunKey({
        taskId: task.id,
        scheduledForIso: new Date().toISOString(),
      });

      await jobRunner.enqueue(
        {
          taskId: task.id,
          runKey,
          meta: { source: "manual" },
        },
        { idempotencyKey: runKey }
      );

      await jobRunner.runOnce(async () => {
        await ctx.runTaskWithAI(task, chatId, bot, access);
      });

      return { handled: true };
    }

    case "/stop_tasks_type": {
      await handleStopTasksType({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
        pool,
      });
      return { handled: true };
    }

    // ✅ FIX: pass bypass correctly (handler checks bypass)
    case "/stop_all_tasks": {
      await handleStopAllTasks({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/recall": {
      await handleRecall({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    // Stage 5 — Observability V1 (READ-ONLY)
    case "/health": {
      await handleHealth({ bot, chatId });
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

    case "/project_status": {
      await handleProjectStatus({ bot, chatId });
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
